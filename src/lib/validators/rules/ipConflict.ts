import type { RuleFn, IssueDef } from '../types';

export const ipConflict: RuleFn = (ctx) => {
  const issues: IssueDef[] = [];
  const addrMap = new Map<string, { deviceId: string; deviceHostname: string; interfaceId: string; interfaceName: string }[]>();

  for (const device of ctx.devices) {
    for (const iface of device.interfaces) {
      for (const addr of iface.addresses) {
        const key = `${addr.address}`;
        const entry = { deviceId: device.id, deviceHostname: device.hostname, interfaceId: iface.id, interfaceName: iface.name };
        if (addrMap.has(key)) {
          addrMap.get(key)!.push(entry);
        } else {
          addrMap.set(key, [entry]);
        }
      }
    }
  }

  for (const [addr, entries] of addrMap) {
    if (entries.length > 1) {
      // Check if any is not loopback to differentiate severity
      const isLoopbackConflict = entries.every(e => {
        const device = ctx.devices.find(d => d.id === e.deviceId);
        const iface = device?.interfaces.find(i => i.id === e.interfaceId);
        return iface?.type === 'loopback';
      });

      issues.push({
        id: `ipconflict-${addr.replace(/\./g, '-')}`,
        ruleId: 'ip-conflict',
        ruleName: 'IP Conflict',
        severity: isLoopbackConflict ? 'warning' : 'error',
        message: `IP ${addr} digunakan oleh ${entries.map(e => `${e.deviceHostname}:${e.interfaceName}`).join(' dan ')}`,
        suggestion: 'Gunakan IP unik per interface dalam subnet yang sama',
      });
    }
  }

  return issues;
};