// RouterOS section parser — token stream → ParsedDevice
import type { ParsedDevice, NetInterface, IpAddress, StaticRoute,
  OspfConfig, BgpConfig, BgpNeighbor, BridgeConfig, NatRule, OspfArea, OspfInterface,
  RipConfig, MplsConfig, MplsInterface, VplsInstance } from '../types';
import { parseCidr } from '../../topology/subnetUtils';
import { tokenizeRouterOS, tokensToSections, parseKeyValueLine } from './tokenizer';
import { v4 as uuid } from 'uuid';

export function parseRouterOSConfig(configId: string, content: string, hostname?: string): ParsedDevice {
  const device: ParsedDevice = {
    id: uuid(),
    hostname: hostname || 'MikroTik',
    vendor: 'routeros',
    role: 'router',
    rawConfigId: configId,
    rawConfig: content,
    interfaces: [],
    routes: [],
    bridges: [],
    natRules: [],
    parseWarnings: [],
    parseErrors: [],
  };

  const warnings = device.parseWarnings;
  const errors = device.parseErrors;

  try {
    const tokens = tokenizeRouterOS(content);
    const sectionMap = tokensToSections(tokens);

    for (const [path, itemGroups] of sectionMap) {
      try {
        switch (true) {
          case path.startsWith('/system identity'): {
            for (const items of itemGroups) {
              for (const tok of items) {
                const kv = parseKeyValueLine(tok.value);
                if (kv.name) device.hostname = kv.name;
              }
            }
            break;
          }

          case path.startsWith('/interface'): {
            for (const items of itemGroups) {
              for (const tok of items) {
                try {
                  const kv = parseKeyValueLine(tok.value === 'add' ? tok.value : tok.value.replace(/^add\s+/, ''));
                  const iface = parseRouterOSInterface(kv, device.id, tok.line);
                  if (iface) device.interfaces.push(iface);
                } catch (e: any) {
                  errors.push({ line: tok.line, message: `Interface parse error: ${e.message}`, raw: tok.value });
                }
              }
            }
            // Also handle /interface bridge, /interface bridge port, /interface vlan, /interface bonding
            if (path.startsWith('/interface bridge')) {
              // bridge config with ports nearby — bridge port parsing is done
            }
            break;
          }

          case path.startsWith('/interface vlan'): {
            for (const items of itemGroups) {
              for (const tok of items) {
                const kv = parseKeyValueLine(tok.value);
                const iface: NetInterface = {
                  id: uuid(),
                  deviceId: device.id,
                  name: kv.name || kv['interface'] || `vlan${uuid().slice(0, 4)}`,
                  type: 'vlan',
                  enabled: kv.disabled === 'yes' ? false : true,
                  vlanId: kv['vlan-id'] ? parseInt(kv['vlan-id'], 10) : undefined,
                  parentInterface: kv['interface'] || kv['parent-interface'],
                  addresses: [],
                  mtu: kv.mtu ? parseInt(kv.mtu, 10) : undefined,
                  comment: kv.comment,
                  sourceLineStart: tok.line,
                };
                // Check parent bridge
                if (iface.parentInterface) {
                  const portMatch = Array.from(itemGroups).find(g =>
                    g.some(t => parseKeyValueLine(t.value)['interface'] === iface.name)
                  );
                }
                device.interfaces.push(iface);
              }
            }
            break;
          }

          case path.startsWith('/ip address'): {
            for (const items of itemGroups) {
              for (const tok of items) {
                if (tok.value.startsWith('add') || tok.value.startsWith('set')) {
                  const kv = parseKeyValueLine(tok.value);
                  const ifName = kv.interface;
                  const addrStr = kv.address;
                  if (addrStr) {
                    let ipStr = addrStr;
                    let prefixLen = 24;
                    if (addrStr.includes('/')) {
                      const [ip, p] = addrStr.split('/');
                      ipStr = ip;
                      prefixLen = parseInt(p, 10);
                    }
                    try {
                      const parsed = parseCidr(ipStr, prefixLen);
                      const addr: IpAddress = {
                        address: parsed.ipStr,
                        prefixLength: prefixLen,
                        network: parsed.networkStr,
                        broadcast: parsed.broadcastStr,
                        version: 4,
                      };
                      // Attach to interface
                      if (ifName) {
                        const iface = device.interfaces.find(i => i.name === ifName);
                        if (iface) {
                          iface.addresses.push(addr);
                        } else {
                          // Auto-create interface
                          const newIface: NetInterface = {
                            id: uuid(),
                            deviceId: device.id,
                            name: ifName,
                            type: 'ethernet',
                            enabled: true,
                            addresses: [addr],
                            sourceLineStart: tok.line,
                          };
                          device.interfaces.push(newIface);
                        }
                      }
                    } catch (e: any) {
                      warnings.push({ line: tok.line, message: `Invalid IP address: ${addrStr}`, raw: tok.value });
                    }
                  }
                }
              }
            }
            break;
          }

          case path.startsWith('/ip route'): {
            for (const items of itemGroups) {
              for (const tok of items) {
                const kv = parseKeyValueLine(tok.value);
                if (kv['dst-address'] || kv['gateway']) {
                  const route: StaticRoute = {
                    id: uuid(),
                    deviceId: device.id,
                    destination: kv['dst-address'] || '0.0.0.0/0',
                    gateway: kv['gateway'] || '',
                    distance: kv.distance ? parseInt(kv.distance, 10) : undefined,
                    interfaceName: kv['gateway']?.match(/^([a-zA-Z0-9-]+)$/) ? kv['gateway'] : undefined,
                    sourceLine: tok.line,
                    type: 'static',
                  };
                  device.routes.push(route);
                }
              }
            }
            break;
          }

          case path.startsWith('/routing ospf'): {
            if (!device.ospf) device.ospf = { routerId: '', areas: [], interfaces: [] };
            if (path.startsWith('/routing ospf instance') || path.startsWith('/routing ospf area') ||
                path.startsWith('/routing ospf interface-template')) {
              for (const items of itemGroups) {
                for (const tok of items) {
                  const kv = parseKeyValueLine(tok.value);
                  if (path.includes('instance') && kv['router-id']) {
                    device.ospf.routerId = kv['router-id'];
                  }
                  if (path.includes('area') && kv['name']) {
                    // OSPF area definition: /routing ospf area add name=backbone area-id=0.0.0.0
                    const existing = device.ospf.areas.find(a => a.name === kv['name']);
                    if (!existing) {
                      device.ospf.areas.push({
                        name: kv['name'],
                        areaId: kv['area-id'] || kv['id'] || kv['name'],
                        type: kv['type'] === 'stub' || kv['type'] === 'nssa' ? kv['type'] : 'normal',
                        networks: [],
                      });
                    }
                  }
                  if (path.includes('interface-template')) {
                    const ospfIface: OspfInterface = {
                      interfaceName: kv['interface'] || kv['network'] || '',
                      area: kv['area'] || kv['cost'] || '',
                      cost: kv['cost'] ? parseInt(kv['cost'], 10) : undefined,
                      priority: kv['priority'] ? parseInt(kv['priority'], 10) : undefined,
                    };
                    device.ospf.interfaces.push(ospfIface);
                  }
                }
              }
            }
            break;
          }

          case path.startsWith('/routing rip'): {
            if (!device.rip) device.rip = { enabled: true, redistributes: [], networks: [], interfaces: [] };
            for (const items of itemGroups) {
              for (const tok of items) {
                const kv = parseKeyValueLine(tok.value);
                if (path.includes('instance') && kv.name) {
                  if (kv['redistribute']) device.rip!.redistributes = kv['redistribute'].split(',');
                  device.rip!.enabled = kv['disabled'] !== 'yes';
                }
                if (path.includes('interface-template')) {
                  if (kv.interfaces) device.rip!.interfaces.push(...kv.interfaces.split(','));
                }
              }
            }
            break;
          }

          case path.startsWith('/mpls ldp'): {
            if (!device.mpls) device.mpls = { enabled: true, ldpEnabled: false, rsvpEnabled: false, interfaces: [] };
            if (path === '/mpls ldp') {
              for (const items of itemGroups) {
                for (const tok of items) {
                  const kv = parseKeyValueLine(tok.value);
                  if (tok.value.startsWith('add') && kv['lsr-id']) {
                    device.mpls!.enabled = true;
                    device.mpls!.ldpEnabled = true;
                  }
                }
              }
            }
            if (path === '/mpls ldp interface') {
              for (const items of itemGroups) {
                for (const tok of items) {
                  const kv = parseKeyValueLine(tok.value);
                  if (kv['interface']) {
                    device.mpls!.interfaces.push({
                      interfaceName: kv['interface'],
                      transportLdp: true,
                    });
                  }
                }
              }
            }
            break;
          }

          case path.startsWith('/routing bgp'): {
            if (!device.bgp) {
              device.bgp = { asn: 0, routerId: '', neighbors: [], networks: [] };
            }
            if (path.includes('connection') || path.includes('template')) {
              for (const items of itemGroups) {
                for (const tok of items) {
                  const kv = parseKeyValueLine(tok.value);
                  const remoteAddr = kv['remote-address'] || kv['remote.address'] || kv['address'] || '0.0.0.0';
                  const remoteAs = kv['remote-as'] || kv['remote.as'];
                  const neighbor: BgpNeighbor = {
                    address: remoteAddr,
                    remoteAsn: remoteAs ? parseInt(remoteAs, 10) : 0,
                    description: kv.comment,
                    updateSource: kv['update-source'] || kv['local.address'],
                    nextHopSelf: kv['nexthop-choice'] ? kv['nexthop-choice'] === 'force' : undefined,
                    ebgpMultihop: kv['multihop'] ? parseInt(kv['multihop'], 10) : undefined,
                    activated: kv['disabled'] !== 'yes',
                  };
                  if (kv['local-as'] || kv['as']) {
                    device.bgp.asn = parseInt(kv['local-as'] || kv['as'], 10);
                  }
                  // Also extract ASN from bgp connection templates
                  if (kv['local.as']) {
                    device.bgp.asn = parseInt(kv['local.as'], 10);
                  }
                  // Only push if it has a real remote address (skip templates)
                  if (remoteAddr !== '0.0.0.0') {
                    device.bgp.neighbors.push(neighbor);
                  }
                }
              }
            }
            break;
          }

          case path.startsWith('/ip firewall nat'): {
            for (const items of itemGroups) {
              for (const tok of items) {
                const kv = parseKeyValueLine(tok.value);
                const nat: NatRule = {
                  id: uuid(),
                  chain: kv.chain === 'srcnat' ? 'srcnat' : 'dstnat',
                  action: kv.action || 'accept',
                  outInterface: kv['out-interface'],
                  inInterface: kv['in-interface'],
                  srcAddress: kv['src-address'],
                  dstAddress: kv['dst-address'],
                  comment: kv.comment,
                  position: itemGroups.indexOf(items) + 1,
                };
                device.natRules.push(nat);
              }
            }
            break;
          }
        }
      } catch (sectionError: any) {
        errors.push({ line: 0, message: `Error parsing section ${path}: ${sectionError.message}`, raw: path });
      }
    }
  } catch (parseError: any) {
    errors.push({ line: 0, message: `Fatal parse error: ${parseError.message}`, raw: '' });
  }

  // Detect device role
  if (device.bgp || device.ospf || device.rip) device.role = 'router';
  if (device.natRules.length > 0) device.role = 'firewall';
  if (device.interfaces.length <= 1 && !device.bgp && !device.ospf && !device.rip) device.role = 'host';

  return device;
}

function parseRouterOSInterface(kv: Record<string, string>, deviceId: string, line: number): NetInterface | null {
  if (!kv.name) return null;

  let type: NetInterface['type'] = 'ethernet';
  if (kv.type === 'vlan') type = 'vlan';
  else if (kv.type === 'bridge') type = 'bridge';
  else if (kv.type === 'bonding') type = 'bonding';
  else if (kv.type === 'loopback') type = 'loopback';
  else if (kv.type === 'pppoe-out') type = 'pppoe';
  else if (kv.type === 'wireless' || kv.type === 'wlan') type = 'wireless';

  const iface: NetInterface = {
    id: uuid(),
    deviceId,
    name: kv.name,
    type,
    enabled: kv.disabled === 'yes' ? false : (kv['disabled'] === 'yes' ? false : true),
    mtu: kv.mtu ? parseInt(kv.mtu, 10) : undefined,
    vlanId: kv['vlan-id'] ? parseInt(kv['vlan-id'], 10) : undefined,
    parentInterface: kv['master-interface'] || kv['parent-interface'],
    macAddress: kv['mac-address'] || kv['address'],
    addresses: [],
    comment: kv.comment,
    sourceLineStart: line,
  };

  if (kv.ssid) iface.ssid = kv.ssid;
  if (kv['slaves']) iface.bondSlaves = kv['slaves'].split(',');

  return iface;
}

export function detectRouterOS(content: string): boolean {
  const lines = content.split('\n').slice(0, 50);
  return lines.some(l =>
    l.trim().startsWith('/interface') ||
    l.trim().startsWith('/ip') ||
    l.trim().startsWith('/system') ||
    l.trim().startsWith('/routing') ||
    l.trim().startsWith('/routing') ||
    (l.trim().startsWith('#') && (
      l.includes('RouterOS') || l.includes('MikroTik') || l.includes('CHR')
    ))
  );
}