// Topology auto-discovery engine
// Matches interfaces by subnet + gateway to build network topology graph

import type { ParsedDevice, TopologyGraph, TopoNode, TopoEdge, TopoNodeKind, LinkKind, LinkType, LinkEndpoint } from '../parsers/types';
import { parseCidr, networkKey, isSameSubnet } from './subnetUtils';
import { v4 as uuid } from 'uuid';

interface EndpointEntry {
  deviceId: string;
  deviceHostname: string;
  interfaceId: string;
  interfaceName: string;
  address: string;
  network: number;
  prefixLength: number;
}

export function buildTopology(devices: ParsedDevice[]): TopologyGraph {
  const nodes: TopoNode[] = [];
  const edges: TopoEdge[] = [];
  const linkIdSet = new Set<string>();

  // Collect all endpoints
  const allEndpoints: { endpoint: EndpointEntry; device: ParsedDevice; iface: any }[] = [];
  console.log('[NetThir] Building topology for', devices.map(d => d.hostname + '(' + d.interfaces.length + ' interfaces)'));

  for (const device of devices) {
    // Collect primary IPs for display
    const ipAddresses: string[] = [];
    const ifaceList: { name: string; address: string; prefixLength: number; type: string; enabled: boolean; mtu?: number }[] = [];

    for (const iface of device.interfaces) {
      for (const addr of iface.addresses) {
        if (addr.version === 4) {
          ipAddresses.push(`${addr.address}/${addr.prefixLength}`);
          if (ifaceList.length < 3) {
            ifaceList.push({
              name: iface.name,
              address: addr.address,
              prefixLength: addr.prefixLength,
              type: iface.type,
              enabled: iface.enabled,
              mtu: iface.mtu,
            });
          }
        }
      }
    }

    if (ipAddresses.length === 0) {
      console.log('[NetThir] WARN:', device.hostname, 'has 0 IP addresses');
    }

    // Find default gateway
    const defaultRoute = device.routes.find(r => r.destination === '0.0.0.0/0');

    // Detect protocols
    const protocols: TopoNode['data']['protocols'] = {};
    if (device.bgp) {
      protocols.bgp = {
        asn: device.bgp.asn,
        routerId: device.bgp.routerId,
        neighbors: device.bgp.neighbors.length,
      };
    }
    if (device.ospf) {
      protocols.ospf = {
        routerId: device.ospf.routerId,
        areas: device.ospf.areas.map(a => a.areaId),
      };
    }
    if (device.mpls?.enabled) {
      protocols.mpls = true;
    }

    const kind = getNodeKind(device);
    nodes.push({
      id: device.id,
      kind,
      label: device.hostname,
      deviceId: device.id,
      vendor: device.vendor,
      data: {
        hostname: device.hostname,
        kind,
        role: device.role,
        interfaceCount: device.interfaces.length,
        upInterfaceCount: device.interfaces.filter(i => i.enabled).length,
        errorCount: 0,
        warningCount: 0,
        vendor: device.vendor,
        ipAddresses: ipAddresses.slice(0, 5),
        gateway: defaultRoute?.gateway,
        protocols: Object.keys(protocols).length > 0 ? protocols : undefined,
        interfaces: ifaceList,
      },
    });

    for (const iface of device.interfaces) {
      if (!iface.enabled) continue;
      for (const addr of iface.addresses) {
        if (addr.version === 4 && addr.prefixLength < 32) { // skip /32 loopbacks
          try {
            const parsed = parseCidr(addr.address, addr.prefixLength);
            allEndpoints.push({
              endpoint: {
                deviceId: device.id,
                deviceHostname: device.hostname,
                interfaceId: iface.id,
                interfaceName: iface.name,
                address: addr.address,
                network: parsed.network,
                prefixLength: parsed.prefix,
              },
              device,
              iface,
            });
          } catch {
            // skip invalid addresses
          }
        }
      }
    }
  }

  console.log('[NetThir] allEndpoints:', allEndpoints.length, 'entries');
  if (allEndpoints.length === 0) {
    console.log('[NetThir] DEBUG: device IPs:');
    devices.forEach(d => {
      d.interfaces.forEach(i => {
        console.log('   ', d.hostname, '/', i.name, 'enabled:', i.enabled, 'addrs:', i.addresses.map(a => a.address + '/' + a.prefixLength));
      });
    });
  }

  // Group endpoints by network/prefixLength
  const groups = new Map<string, EndpointEntry[]>();

  for (const { endpoint } of allEndpoints) {
    const key = networkKey(endpoint.network, endpoint.prefixLength);
    const existing = groups.get(key) || [];
    existing.push(endpoint);
    groups.set(key, existing);
  }

  // Process each group
  for (const [netKey, members] of groups) {
    if (members.length === 0) continue;

    // Unique devices in this group
    const deviceIds = [...new Set(members.map(m => m.deviceId))];

    // Single endpoint = unconnected interface (Cisco-style: no cloud nodes)
    // Interface shows in device detail panel, no edge drawn
    if (members.length === 1) continue;

    if (members.length === 2) {
      // Point-to-point link — direct device-to-device
      const [a, b] = members;
      const kind: LinkKind = getLinkKindForDevices(a, b, devices);
      const edgeId = `edge-${a.deviceId}-${b.deviceId}-${netKey.replace(/\//g, '_')}`;

      if (!linkIdSet.has(edgeId)) {
        linkIdSet.add(edgeId);
        edges.push({
          id: edgeId,
          source: a.deviceId,
          target: b.deviceId,
          kind,
          type: 'p2p',
          network: netKey,
          label: `${a.address} ↔ ${b.address}`,
          status: 'ok',
          issueIds: [],
          endpoints: [
            {
              deviceId: a.deviceId,
              deviceHostname: a.deviceHostname,
              interfaceId: a.interfaceId,
              interfaceName: a.interfaceName,
              address: a.address,
              network: netKey,
              prefixLength: a.prefixLength,
            },
            {
              deviceId: b.deviceId,
              deviceHostname: b.deviceHostname,
              interfaceId: b.interfaceId,
              interfaceName: b.interfaceName,
              address: b.address,
              network: netKey,
              prefixLength: b.prefixLength,
            },
          ],
        });
      }
    } else {
      // 3+ endpoints on same subnet → switch fan-out
      const isLan = members.some(m => m.prefixLength <= 24);
      if (!isLan && members.length <= 4) {
        // Full mesh for small /30 /29 groups
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const a = members[i];
            const b = members[j];
            const edgeId = `edge-${a.deviceId}-${b.deviceId}-${netKey.replace(/\//g, '_')}`;
            if (!linkIdSet.has(edgeId)) {
              linkIdSet.add(edgeId);
              edges.push({
                id: edgeId,
                source: a.deviceId,
                target: b.deviceId,
                kind: 'ethernet',
                type: 'p2p',
                network: netKey,
                label: `${a.address} ↔ ${b.address}`,
                status: 'ok',
                issueIds: [],
                endpoints: [
                  { deviceId: a.deviceId, deviceHostname: a.deviceHostname, interfaceId: a.interfaceId, interfaceName: a.interfaceName, address: a.address, network: netKey, prefixLength: a.prefixLength },
                  { deviceId: b.deviceId, deviceHostname: b.deviceHostname, interfaceId: b.interfaceId, interfaceName: b.interfaceName, address: b.address, network: netKey, prefixLength: b.prefixLength },
                ],
              });
            }
          }
        }
      } else {
        // Broadcast segment — virtual switch
        const switchId = `switch-${netKey.replace(/\//g, '_')}`;
        nodes.push({
          id: switchId,
          kind: 'switch',
          label: `Switch (${netKey})`,
          data: {
            hostname: `Switch-${netKey}`,
            kind: 'switch',
            role: 'switch',
            interfaceCount: members.length,
            upInterfaceCount: members.length,
            errorCount: 0,
            warningCount: 0,
            ipAddresses: [],
          },
        });

        for (const ep of members) {
          const edgeId = `edge-${ep.deviceId}-${ep.interfaceId}-${switchId}`;
          if (!linkIdSet.has(edgeId)) {
            linkIdSet.add(edgeId);
            edges.push({
              id: edgeId,
              source: ep.deviceId,
              target: switchId,
              kind: 'ethernet',
              type: 'broadcast',
              network: netKey,
              label: ep.address,
              status: 'ok',
              issueIds: [],
              endpoints: [{
                deviceId: ep.deviceId,
                deviceHostname: ep.deviceHostname,
                interfaceId: ep.interfaceId,
                interfaceName: ep.interfaceName,
                address: ep.address,
                network: netKey,
                prefixLength: ep.prefixLength,
              }],
            });
          }
        }
      }
    }
  }

  // Gateway-based connections: connect devices when one's gateway matches another's IP
  for (const device of devices) {
    for (const route of device.routes) {
      if (route.destination === '0.0.0.0/0' || route.type !== 'static') continue;
      const targetDevice = devices.find(d =>
        d.interfaces.some(i =>
          i.addresses.some(a =>
            a.address === route.gateway
          )
        )
      );
      if (targetDevice && targetDevice.id !== device.id) {
        const edgeId = `gw-${device.id}-${targetDevice.id}`;
        if (!linkIdSet.has(edgeId)) {
          linkIdSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: device.id,
            target: targetDevice.id,
            kind: 'ethernet',
            type: 'p2p',
            network: `${route.gateway}/32`,
            label: `→ ${route.gateway}`,
            status: 'ok',
            issueIds: [],
            endpoints: [],
          });
        }
      }
    }
  }

  // Detect link types more specifically
  for (const edge of edges) {
    const srcDevice = devices.find(d => d.id === edge.source);
    const tgtDevice = devices.find(d => d.id === edge.target);

    if (srcDevice && tgtDevice) {
      if (srcDevice.ospf && tgtDevice.ospf) {
        const hasOspfOnLink = srcDevice.ospf.interfaces.some(i =>
          edge.endpoints.some(e => e.interfaceName === i.interfaceName)
        );
        if (hasOspfOnLink) edge.kind = 'mpls';
      }
      if (srcDevice.bgp && tgtDevice.bgp) {
        const bgpPeer = srcDevice.bgp.neighbors.find(n =>
          tgtDevice.interfaces.some(i =>
            i.addresses.some(a => a.address === n.address)
          )
        );
        if (bgpPeer) edge.kind = 'bgp';
      }
    }

    // Check for VPLS: PE routers with iBGP for L2VPN
    if (srcDevice?.bgp && tgtDevice?.bgp && srcDevice.bgp.neighbors.some(n => n.address.startsWith('10.')) && tgtDevice.bgp.neighbors.some(n => n.address.startsWith('10.'))) {
      (edge as any).vpls = true;
    }

    // Check for wireless
    const srcIface = srcDevice?.interfaces.find(i =>
      edge.endpoints.some(e => e.interfaceId === i.id)
    );
    if (srcIface?.type === 'wireless') {
      edge.kind = 'wireless';
    }
  }

  // Mark edges connected to cloud as 'cloud' type
  for (const edge of edges) {
    const tgtNode = nodes.find(n => n.id === edge.target);
    if (tgtNode?.kind === 'cloud') {
      edge.type = 'cloud';
    }
    const srcNode = nodes.find(n => n.id === edge.source);
    if (srcNode?.kind === 'cloud') {
      edge.type = 'cloud';
    }
  }

  const stats = {
    totalDevices: devices.length,
    totalLinks: edges.length,
    totalInterfaces: devices.reduce((sum, d) => sum + d.interfaces.length, 0),
    detectedSubnets: groups.size,
  };

  return { nodes, edges, stats };
}

function getLinkKindForDevices(a: EndpointEntry, b: EndpointEntry, devices: ParsedDevice[]): LinkKind {
  const da = devices.find(d => d.id === a.deviceId);
  const db = devices.find(d => d.id === b.deviceId);
  if (da?.bgp && db?.bgp) return 'bgp';
  if (da?.ospf && db?.ospf) return 'mpls';
  return 'ethernet';
}

function getNodeKind(device: ParsedDevice): TopoNodeKind {
  switch (device.role) {
    case 'router': return 'router';
    case 'switch': return 'switch';
    case 'firewall': return 'firewall';
    case 'host': return 'host';
    default: {
      if (device.ospf || device.bgp || device.mpls) return 'router';
      if (device.natRules.length > 0) return 'firewall';
      if (device.bridges.length > 0) return 'switch';
      return 'host';
    }
  }
}
