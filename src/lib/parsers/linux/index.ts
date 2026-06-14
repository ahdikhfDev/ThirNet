// Linux config parsers
// Supports: ip addr, ip route, /etc/network/interfaces, netplan YAML

import type { ParsedDevice, NetInterface, IpAddress, StaticRoute } from '../types';
import { parseCidr } from '../../topology/subnetUtils';
import { v4 as uuid } from 'uuid';

export function parseLinuxIpAddr(content: string): { interfaces: NetInterface[]; warnings: { line: number; message: string }[] } {
  const interfaces: NetInterface[] = [];
  const warnings: { line: number; message: string }[] = [];
  let currentInterface: NetInterface | null = null;
  const lines = content.split('\n');

  const IP_ADDR_REGEX = /^\d+:\s+(\S+)(?:@(\S+))?:\s*<(.+?)>/;
  const ADDR_REGEX = /^\s+inet\s+(\S+)(?:\s+(\S+))?\s*(?:->\s*(\S+))?\s*(?:scope\s+(\S+))?/;
  const MAC_REGEX = /^\s+link\/ether\s+([0-9a-f:]+)/;
  const MTU_REGEX = /^\s+mtu\s+(\d+)/;

  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();

    if (!trimmed) continue;

    const ifaceMatch = trimmed.match(IP_ADDR_REGEX);
    if (ifaceMatch) {
      if (currentInterface) {
        interfaces.push(currentInterface);
      }
      const [, name, parent, flags] = ifaceMatch;
      const isUp = !flags.includes('DOWN');
      currentInterface = {
        id: uuid(),
        deviceId: '',
        name,
        type: 'ethernet',
        enabled: isUp,
        addresses: [],
        sourceLineStart: lineNum,
        parentInterface: parent,
      };
      continue;
    }

    if (!currentInterface) continue;

    const addrMatch = trimmed.match(ADDR_REGEX);
    if (addrMatch) {
      const [, addrFull, brd, gateway] = addrMatch;
      try {
        const parsed = parseCidr(addrFull);
        const addr: IpAddress = {
          address: parsed.ipStr,
          prefixLength: parsed.prefix,
          network: parsed.networkStr,
          broadcast: brd && brd !== '' ? brd : parsed.broadcastStr,
          version: parsed.ipStr.includes(':') ? 6 : 4,
        };
        currentInterface.addresses.push(addr);
      } catch (e: any) {
        warnings.push({ line: lineNum, message: `Invalid address: ${addrFull}` });
      }
      continue;
    }

    const macMatch = trimmed.match(MAC_REGEX);
    if (macMatch) {
      currentInterface.macAddress = macMatch[1];
      continue;
    }

    const mtuMatch = trimmed.match(MTU_REGEX);
    if (mtuMatch) {
      currentInterface.mtu = parseInt(mtuMatch[1], 10);
    }
  }

  if (currentInterface) interfaces.push(currentInterface);

  return { interfaces, warnings };
}

export function parseLinuxIpRoute(content: string): { routes: StaticRoute[]; warnings: { line: number; message: string }[] } {
  const routes: StaticRoute[] = [];
  const warnings: { line: number; message: string }[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts[0] === 'default') {
      const gatewayIdx = parts.indexOf('via');
      const devIdx = parts.indexOf('dev');
      routes.push({
        id: uuid(),
        deviceId: '',
        destination: '0.0.0.0/0',
        gateway: gatewayIdx > -1 ? parts[gatewayIdx + 1] : '',
        interfaceName: devIdx > -1 ? parts[devIdx + 1] : undefined,
        sourceLine: i + 1,
        type: 'static',
      });
    } else if (parts[0].includes('/')) {
      // Regular CIDR route
      const dest = parts[0];
      const gatewayIdx = parts.indexOf('via');
      const devIdx = parts.indexOf('dev');
      const metricIdx = parts.indexOf('metric');
      routes.push({
        id: uuid(),
        deviceId: '',
        destination: dest,
        gateway: gatewayIdx > -1 ? parts[gatewayIdx + 1] : '',
        interfaceName: devIdx > -1 ? parts[devIdx + 1] : undefined,
        metric: metricIdx > -1 ? parseInt(parts[metricIdx + 1], 10) : undefined,
        sourceLine: i + 1,
        type: 'static',
      });
    }
  }

  return { routes, warnings };
}

export function parseInterfacesFile(content: string): NetInterface[] {
  const interfaces: NetInterface[] = [];
  const lines = content.split('\n');
  let currentIface: { name: string; type: string; auto: boolean; addresses: IpAddress[]; mtu?: number; gateway?: string; pendingAddress?: string; pendingNetmask?: string } | null = null;

  // First pass: collect auto interfaces
  const autoIfaces = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('auto ')) {
      const autoLine = trimmed.replace('auto ', '');
      autoLine.split(/\s+/).forEach(name => { if (name) autoIfaces.add(name); });
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('iface ')) {
      // Flush any pending address that had a netmask on next line
      if (currentIface && currentIface.pendingAddress) {
        const addr = finalizeAddress(currentIface.pendingAddress, currentIface.pendingNetmask);
        if (addr) currentIface.addresses.push(addr);
      }
      if (currentIface) {
        interfaces.push({
          id: uuid(),
          deviceId: '',
          name: currentIface.name,
          type: currentIface.type === 'loopback' ? 'loopback' : 'ethernet',
          enabled: currentIface.auto,
          addresses: currentIface.addresses,
          mtu: currentIface.mtu,
        });
      }
      const match = trimmed.match(/^iface\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (match) {
        const ifaceName = match[1];
        currentIface = {
          name: ifaceName,
          type: match[2],
          auto: autoIfaces.has(ifaceName),
          addresses: [],
          pendingAddress: undefined,
          pendingNetmask: undefined,
        };
      }
      continue;
    }

    if (currentIface) {
      if (trimmed.startsWith('address ')) {
        // Flush previous pending address if any
        if (currentIface.pendingAddress) {
          const addr = finalizeAddress(currentIface.pendingAddress, currentIface.pendingNetmask);
          if (addr) currentIface.addresses.push(addr);
        }
        currentIface.pendingAddress = trimmed.replace('address ', '');
        // netmask will be set on next line if present — don't push yet
      } else if (trimmed.startsWith('netmask ')) {
        const nm = trimmed.replace('netmask ', '').trim();
        currentIface.pendingNetmask = nm;
        // Immediately flush if we already have pending address
        if (currentIface.pendingAddress) {
          const addr = finalizeAddress(currentIface.pendingAddress, nm);
          if (addr) currentIface.addresses.push(addr);
          currentIface.pendingAddress = undefined;
          currentIface.pendingNetmask = undefined;
        }
      } else if (trimmed.startsWith('mtu ')) {
        currentIface.mtu = parseInt(trimmed.replace('mtu ', ''), 10);
      } else if (trimmed.startsWith('gateway ')) {
        currentIface.gateway = trimmed.replace('gateway ', '');
      }
    }
  }

  // Flush remaining pending address
  if (currentIface) {
    if (currentIface.pendingAddress) {
      const addr = finalizeAddress(currentIface.pendingAddress, currentIface.pendingNetmask);
      if (addr) currentIface.addresses.push(addr);
    }
    interfaces.push({
      id: uuid(),
      deviceId: '',
      name: currentIface.name,
      type: currentIface.type === 'loopback' ? 'loopback' : 'ethernet',
      enabled: currentIface.auto,
      addresses: currentIface.addresses,
      mtu: currentIface.mtu,
    });
  }

  return interfaces;
}

function netmaskToPrefix(netmask: string): number {
  const parts = netmask.split('.').map(Number);
  if (parts.length !== 4) return 32;
  const maskNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  let prefix = 0;
  for (let i = 31; i >= 0; i--) {
    if (maskNum & (1 << i)) prefix++;
    else break;
  }
  return prefix;
}

function finalizeAddress(ipAddr: string, netmask?: string): IpAddress | null {
  try {
    const prefix = netmask ? netmaskToPrefix(netmask) : 32;
    const p = parseCidr(ipAddr, prefix);
    return {
      address: p.ipStr,
      prefixLength: p.prefix,
      network: p.networkStr,
      broadcast: p.broadcastStr,
      version: p.ipStr.includes(':') ? 6 : 4,
    };
  } catch {
    return null;
  }
}

export function parseLinuxConfig(deviceId: string, hostname: string, content: string): ParsedDevice {
  const device: ParsedDevice = {
    id: deviceId,
    hostname,
    vendor: 'linux',
    role: 'host',
    rawConfigId: deviceId,
    rawConfig: content,
    interfaces: [],
    routes: [],
    bridges: [],
    natRules: [],
    parseWarnings: [],
    parseErrors: [],
  };

  // Detect content type
  if (content.includes('ip addr') || content.includes('ip -o addr') || content.match(/\d+:\s+\S+/)) {
    const { interfaces, warnings } = parseLinuxIpAddr(content);
    device.interfaces = interfaces.map(i => ({ ...i, deviceId }));
    device.parseWarnings = warnings.map(w => ({ ...w, raw: '' }));
  }

  if (content.includes('ip route') || content.match(/^default\s+via/m)) {
    const { routes, warnings } = parseLinuxIpRoute(content);
    device.routes = routes.map(r => ({ ...r, deviceId }));
    device.parseWarnings.push(...warnings.map(w => ({ ...w, raw: '' })));
  }

  if (content.includes('iface ') || content.includes('auto ')) {
    const ifaces = parseInterfacesFile(content);
    device.interfaces = ifaces.map(i => ({ ...i, deviceId }));
  }

  // Detect hostname from /etc/hostname
  const hostnameMatch = content.match(/hostname\s+(\S+)/i) || content.match(/^(\S+)$/m);
  if (hostnameMatch) device.hostname = hostnameMatch[1].trim();

  // Detect role
  if (device.routes.some(r => r.destination === '0.0.0.0/0')) device.role = 'router';
  if (device.interfaces.some(i => i.type === 'bridge')) device.role = 'switch';

  return device;
}

export function detectLinux(content: string): boolean {
  return (
    content.includes('ip addr') ||
    content.includes('ip route') ||
    content.includes('ip -o addr') ||
    content.match(/^\d+:\s+\S+/m) !== null ||
    content.includes('iface ') ||
    content.includes('auto ') ||
    content.includes('network:') ||
    content.includes('interfaces:') ||
    /^\d+\.\d+\.\d+\.\d+\/\d+/.test(content)
  );
}