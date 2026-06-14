import type { RuleFn, IssueDef } from '../types';

export const mtuMismatch: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];

  for (const edge of ctx.topology.edges) {
    if (edge.endpoints.length !== 2) continue;
    if (edge.type === 'cloud') continue;

    const [a, b] = edge.endpoints;
    const deviceA = ctx.devices.find(d => d.id === a.deviceId);
    const deviceB = ctx.devices.find(d => d.id === b.deviceId);
    if (!deviceA || !deviceB) continue;

    const ifaceA = deviceA.interfaces.find(i => i.id === a.interfaceId);
    const ifaceB = deviceB.interfaces.find(i => i.id === b.interfaceId);
    if (!ifaceA || !ifaceB) continue;

    const mtuA = ifaceA.mtu;
    const mtuB = ifaceB.mtu;

    if (mtuA && mtuB && mtuA !== mtuB) {
      issues.push({
        id: `mtu-${edge.id}`,
        ruleId: 'mtu-mismatch',
        ruleName: 'MTU Mismatch',
        severity: 'warning',
        edgeId: edge.id,
        message: `MTU mismatch pada link ${edge.network}: ${a.deviceHostname}:${a.interfaceName}=${mtuA}, ${b.deviceHostname}:${b.interfaceName}=${mtuB}`,
        suggestion: 'Samakan MTU kedua sisi untuk menghindari fragmentasi — penting untuk MPLS/VPN',
      });
    }
  }

  return issues;
};

export const duplicateRouterId: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];

  // OSPF router-id check
  const ospfRids = new Map<string, { deviceId: string; hostname: string }[]>();
  for (const device of ctx.devices) {
    if (device.ospf?.routerId) {
      const existing = ospfRids.get(device.ospf.routerId) || [];
      existing.push({ deviceId: device.id, hostname: device.hostname });
      ospfRids.set(device.ospf.routerId, existing);
    }
  }
  for (const [rid, entries] of ospfRids) {
    if (entries.length > 1) {
      const names = entries.map(e => e.hostname).join(', ');
      issues.push({
        id: `ospf-rid-${rid.replace(/\./g, '-')}`,
        ruleId: 'duplicate-router-id',
        ruleName: 'Duplicate OSPF Router-ID',
        severity: 'error',
        message: `OSPF Router-ID ${rid} duplikat: ${names}`,
        suggestion: 'Setiap router OSPF harus punya router-id unik — gunakan loopback IP',
      });
    }
  }

  // BGP router-id check
  const bgpRids = new Map<string, { deviceId: string; hostname: string }[]>();
  for (const device of ctx.devices) {
    if (device.bgp?.routerId) {
      const existing = bgpRids.get(device.bgp.routerId) || [];
      existing.push({ deviceId: device.id, hostname: device.hostname });
      bgpRids.set(device.bgp.routerId, existing);
    }
  }
  for (const [rid, entries] of bgpRids) {
    if (entries.length > 1) {
      const names = entries.map(e => e.hostname).join(', ');
      issues.push({
        id: `bgp-rid-${rid.replace(/\./g, '-')}`,
        ruleId: 'duplicate-router-id',
        ruleName: 'Duplicate BGP Router-ID',
        severity: 'error',
        message: `BGP Router-ID ${rid} duplikat: ${names}`,
        suggestion: 'Setiap router BGP harus punya router-id unik',
      });
    }
  }

  return issues;
};

export const asnMismatch: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];

  for (const device of ctx.devices) {
    if (!device.bgp) continue;
    for (const neighbor of device.bgp.neighbors) {
      // Find target device by IP
      let targetDevice = null;
      for (const d of ctx.devices) {
        if (d.id === device.id) continue;
        for (const iface of d.interfaces) {
          for (const addr of iface.addresses) {
            if (addr.address === neighbor.address) {
              targetDevice = d;
              break;
            }
          }
        }
      }

      if (!targetDevice) {
        issues.push({
          id: `asn-${device.id}-${neighbor.address.replace(/\./g, '-')}`,
          ruleId: 'asn-mismatch',
          ruleName: 'BGP Peer Not Found',
          severity: 'warning',
          deviceId: device.id,
          deviceHostname: device.hostname,
          message: `BGP peer ${neighbor.address} pada ${device.hostname} tidak ditemukan di topologi`,
          suggestion: 'Periksa IP peer BGP — harus match dengan interface device target',
        });
        continue;
      }

      if (!targetDevice.bgp) {
        issues.push({
          id: `asn-no-bgp-${device.id}-${targetDevice.id}`,
          ruleId: 'asn-mismatch',
          ruleName: 'BGP Not Configured',
          severity: 'error',
          deviceId: device.id,
          deviceHostname: device.hostname,
          message: `${device.hostname} mengkonfigurasi BGP ke ${targetDevice.hostname} tapi ${targetDevice.hostname} tidak memiliki konfigurasi BGP`,
          suggestion: 'Konfigurasi BGP pada kedua router, atau hapus peer dari satu sisi',
        });
      } else if (neighbor.remoteAsn !== targetDevice.bgp.asn) {
        issues.push({
          id: `asn-${device.id}-${targetDevice.id}`,
          ruleId: 'asn-mismatch',
          ruleName: 'ASN Mismatch',
          severity: 'error',
          deviceId: device.id,
          deviceHostname: device.hostname,
          message: `${device.hostname} expecting ASN ${neighbor.remoteAsn} from ${targetDevice.hostname}, actual ASN: ${targetDevice.bgp.asn}`,
          suggestion: 'Periksa konfigurasi remote-as pada kedua router',
        });
      }
    }
  }

  return issues;
};

export const disabledInterfaceActive: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];

  for (const device of ctx.devices) {
    for (const iface of device.interfaces) {
      if (iface.enabled) continue;

      if (iface.addresses.length > 0) {
        issues.push({
          id: `disabled-active-${device.id}-${iface.id}`,
          ruleId: 'disabled-interface-active',
          ruleName: 'Disabled Interface with IP',
          severity: 'warning',
          deviceId: device.id,
          deviceHostname: device.hostname,
          interfaceId: iface.id,
          interfaceName: iface.name,
          message: `Interface ${iface.name} pada ${device.hostname} memiliki IP tapi berstatus disabled`,
          suggestion: 'Aktifkan interface atau hapus konfigurasi IP jika tidak dipakai',
        });
      }

      // Check if referenced in routes
      for (const route of device.routes) {
        if (route.interfaceName === iface.name && !iface.enabled) {
          issues.push({
            id: `disabled-route-${device.id}-${iface.id}`,
            ruleId: 'disabled-interface-active',
            ruleName: 'Disabled Interface in Route',
            severity: 'warning',
            deviceId: device.id,
            deviceHostname: device.hostname,
            interfaceId: iface.id,
            interfaceName: iface.name,
            message: `Interface ${iface.name} pada ${device.hostname} dirujuk di route tapi disabled`,
            suggestion: 'Aktifkan interface atau hapus referensi route',
          });
        }
      }
    }
  }

  return issues;
};

export const vlanConfig: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];

  // Check for VLANs used in routing but not defined
  for (const device of ctx.devices) {
    for (const route of device.routes) {
      // Check if route gateway uses a VLAN interface that's not in the device
      for (const iface of device.interfaces) {
        if (iface.type === 'vlan' && iface.name === route.gateway) {
          if (!iface.vlanId) {
            issues.push({
              id: `vlan-no-id-${device.id}-${iface.id}`,
              ruleId: 'vlan-config',
              ruleName: 'VLAN Missing ID',
              severity: 'warning',
              deviceId: device.id,
              deviceHostname: device.hostname,
              interfaceId: iface.id,
              interfaceName: iface.name,
              message: `Interface ${iface.name} adalah VLAN tapi tidak memiliki VLAN ID`,
              suggestion: 'Tambahkan parameter vlan-id pada konfigurasi interface VLAN',
            });
          }
        }
      }
    }
  }

  return issues;
};