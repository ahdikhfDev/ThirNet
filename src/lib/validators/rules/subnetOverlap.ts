import type { RuleFn, IssueDef } from '../types';
import { parseCidr, cidrOverlap } from '../../topology/subnetUtils';

export const subnetOverlap: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];
  const allSubnets: { deviceId: string; deviceHostname: string; interfaceName: string; cidr: string; network: number; prefix: number }[] = [];

  for (const device of ctx.devices) {
    for (const iface of device.interfaces) {
      for (const addr of iface.addresses) {
        try {
          const parsed = parseCidr(addr.address, addr.prefixLength);
          allSubnets.push({
            deviceId: device.id,
            deviceHostname: device.hostname,
            interfaceName: iface.name,
            cidr: `${addr.address}/${addr.prefixLength}`,
            network: parsed.network,
            prefix: parsed.prefix,
          });
        } catch {}
      }
    }
  }

  for (let i = 0; i < allSubnets.length; i++) {
    for (let j = i + 1; j < allSubnets.length; j++) {
      const a = allSubnets[i];
      const b = allSubnets[j];
      if (a.deviceHostname === b.deviceHostname) continue; // same device, skip
      
      try {
        const aParsed = parseCidr('0.0.0.0', a.prefix);
        aParsed.network = a.network;
        aParsed.broadcast = (a.network | (~(prefixToMask(a.prefix)) >>> 0)) >>> 0;

        const bParsed = parseCidr('0.0.0.0', b.prefix);
        bParsed.network = b.network;
        bParsed.broadcast = (b.network | (~(prefixToMask(b.prefix)) >>> 0)) >>> 0;

        if (cidrOverlap(aParsed, bParsed)) {
          issues.push({
            id: `subnet-overlap-${i}-${j}`,
            ruleId: 'subnet-overlap',
            ruleName: 'Subnet Overlap',
            severity: 'error',
            deviceId: a.deviceId,
            deviceHostname: a.deviceHostname,
            interfaceName: a.interfaceName,
            message: `Subnet ${a.cidr} (${a.deviceHostname}:${a.interfaceName}) overlap dengan ${b.cidr} (${b.deviceHostname}:${b.interfaceName})`,
            suggestion: 'Periksa konfigurasi IP address — subnet tidak boleh overlap antar network yang berbeda',
          });
        }
      } catch {}
    }
  }

  return issues;
};

function prefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  return (~((1 << (32 - prefix)) - 1)) >>> 0;
}