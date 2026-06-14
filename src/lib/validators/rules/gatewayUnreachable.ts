import type { RuleFn, IssueDef } from '../types';
import { parseCidr } from '../../topology/subnetUtils';

export const gatewayUnreachable: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];

  for (const device of ctx.devices) {
    // Build set of subnets on this device
    const ownSubnets = new Map<string, { network: string; prefix: number }>();
    for (const iface of device.interfaces) {
      for (const addr of iface.addresses) {
        try {
          const parsed = parseCidr(addr.address, addr.prefixLength);
          ownSubnets.set(`${parsed.networkStr}/${parsed.prefix}`, {
            network: parsed.networkStr,
            prefix: parsed.prefix,
          });
        } catch {}
      }
    }

    // Also check other devices' subnets that are directly connected via topology
    const allSubnets: { network: string; prefix: number; deviceHostname: string }[] = [];
    for (const otherDevice of ctx.devices) {
      if (otherDevice.id === device.id) continue;
      for (const iface of otherDevice.interfaces) {
        for (const addr of iface.addresses) {
          try {
            const parsed = parseCidr(addr.address, addr.prefixLength);
            allSubnets.push({
              network: parsed.networkStr,
              prefix: parsed.prefix,
              deviceHostname: otherDevice.hostname,
            });
          } catch {}
        }
      }
    }

    for (const route of device.routes) {
      if (!route.gateway || route.gateway === '0.0.0.0') continue;

      // Check if gateway is in any own subnet
      let reachable = false;
      for (const [, subnet] of ownSubnets) {
        try {
          const gwParsed = parseCidr(route.gateway);
          const subnetParsed = parseCidr(subnet.network, subnet.prefix);
          const masked = (gwParsed.ip & subnetParsed.mask) >>> 0;
          if (masked === subnetParsed.network) {
            reachable = true;
            break;
          }
        } catch {}
      }

      if (!reachable) {
        issues.push({
          id: `gateway-${route.id}`,
          ruleId: 'gateway-unreachable',
          ruleName: 'Gateway Unreachable',
          severity: 'error',
          deviceId: device.id,
          deviceHostname: device.hostname,
          message: `Gateway ${route.gateway} untuk route ${route.destination} tidak berada di subnet manapun pada ${device.hostname}`,
          suggestion: 'Periksa apakah gateway sesuai dengan subnet link yang menghubungkan ke next-hop',
          sourceLine: route.sourceLine,
        });
      }
    }
  }

  return issues;
};