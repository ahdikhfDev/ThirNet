// Subnet utilities for IP/CIDR math
// All IPv4 operations use 32-bit unsigned integers

export interface ParsedCIDR {
  ip: number;
  network: number;
  broadcast: number;
  mask: number;
  prefix: number;
  ipStr: string;
  networkStr: string;
  broadcastStr: string;
}

export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: ${ip}`);
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.');
}

export function prefixToMask(prefix: number): number {
  if (prefix < 0 || prefix > 32) throw new Error(`Invalid prefix: ${prefix}`);
  if (prefix === 0) return 0;
  return (~((1 << (32 - prefix)) - 1)) >>> 0;
}

export function parseCidr(addr: string, prefixLength?: number): ParsedCIDR {
  let ipStr = addr;
  let prefix = prefixLength ?? 32;

  if (addr.includes('/')) {
    const [ipPart, prefixPart] = addr.split('/');
    ipStr = ipPart;
    prefix = parseInt(prefixPart, 10);
  }

  const ip = ipToInt(ipStr);
  const mask = prefixToMask(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;

  return {
    ip,
    network,
    broadcast,
    mask,
    prefix,
    ipStr,
    networkStr: intToIp(network),
    broadcastStr: intToIp(broadcast),
  };
}

export function networkKey(network: number, prefix: number): string {
  return `${intToIp(network)}/${prefix}`;
}

export function isSameSubnet(a: ParsedCIDR, b: ParsedCIDR): boolean {
  return a.network === b.network && a.prefix === b.prefix;
}

export function cidrOverlap(a: ParsedCIDR, b: ParsedCIDR): boolean {
  if (a.network === b.network && a.prefix === b.prefix) return false; // exact match
  const aStart = a.network;
  const aEnd = a.broadcast;
  const bStart = b.network;
  const bEnd = b.broadcast;
  return aStart <= bEnd && aEnd >= bStart;
}

export function isInSubnet(ip: number, subnetNetwork: number, subnetPrefix: number): boolean {
  const mask = prefixToMask(subnetPrefix);
  return (ip & mask) >>> 0 === subnetNetwork;
}

export function ipInCidr(ipStr: string, cidrStr: string): boolean {
  const parsed = parseCidr(cidrStr);
  const ip = ipToInt(ipStr);
  return isInSubnet(ip, parsed.network, parsed.prefix);
}

export function findBroadcastAddress(address: string, prefixLength: number): string {
  const parsed = parseCidr(address, prefixLength);
  return parsed.broadcastStr;
}

export function findNetworkAddress(address: string, prefixLength: number): string {
  const parsed = parseCidr(address, prefixLength);
  return parsed.networkStr;
}

export function calculateHosts(prefixLength: number): number {
  if (prefixLength === 32) return 1;
  if (prefixLength === 31) return 2;
  return (1 << (32 - prefixLength)) - 2;
}
