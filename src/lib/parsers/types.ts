// Internal Network Model (INM) Type Definitions
// Used by both client-side parser and server-side (if any)

export type Vendor = 'routeros' | 'linux' | 'linux-netplan' | 'unknown';

export type DeviceRole = 'router' | 'host' | 'switch' | 'firewall' | 'unknown';

export interface ParsedDevice {
  id: string;
  hostname: string;
  vendor: Vendor;
  role: DeviceRole;
  rawConfigId: string;
  rawConfig: string;
  interfaces: NetInterface[];
  routes: StaticRoute[];
  ospf?: OspfConfig;
  bgp?: BgpConfig;
  rip?: RipConfig;
  mpls?: MplsConfig;
  bridges: BridgeConfig[];
  natRules: NatRule[];
  parseWarnings: ParseWarning[];
  parseErrors: ParseError[];
}

export interface NetInterface {
  id: string;
  deviceId: string;
  name: string;
  type: 'ethernet' | 'vlan' | 'bridge' | 'bonding' | 'loopback' | 'pppoe' | 'wireless' | 'tunnel' | 'other';
  enabled: boolean;
  mtu?: number;
  vlanId?: number;
  parentInterface?: string;
  macAddress?: string;
  addresses: IpAddress[];
  comment?: string;
  sourceLineStart?: number;
  sourceLineEnd?: number;
  // Wireless specific
  ssid?: string;
  // Bonding specific
  bondSlaves?: string[];
}

export interface IpAddress {
  address: string;
  prefixLength: number;
  network: string;
  broadcast?: string;
  version: 4 | 6;
}

export interface StaticRoute {
  id: string;
  deviceId: string;
  destination: string;
  gateway: string;
  distance?: number;
  metric?: number;
  interfaceName?: string;
  sourceLine?: number;
  type?: 'static' | 'connected' | 'ospf' | 'bgp' | 'blackhole' | 'unreachable';
}

export interface OspfConfig {
  routerId?: string;
  processId?: string;
  referenceBandwidth?: number;
  areas: OspfArea[];
  interfaces: OspfInterface[];
  redistribution?: string[];
}

export interface OspfArea {
  name: string;
  areaId: string;
  networks: string[];
  type: 'normal' | 'stub' | 'nssa';
}

export interface OspfInterface {
  interfaceName: string;
  area: string;
  cost?: number;
  priority?: number;
  helloInterval?: number;
  deadInterval?: number;
  passive?: boolean;
}

export interface RipConfig {
  enabled: boolean;
  routerId?: string;
  redistributes: string[];
  networks: string[];
  interfaces: string[];
  version?: 1 | 2;
}

export interface BgpConfig {
  asn: number;
  routerId?: string;
  processId?: string;
  neighbors: BgpNeighbor[];
  networks: string[];
  redistribute?: string[];
}

export interface BgpNeighbor {
  address: string;
  remoteAsn: number;
  description?: string;
  updateSource?: string;
  nextHopSelf?: boolean;
  password?: string;
  ebgpMultihop?: number;
  activated?: boolean;
}

export interface MplsConfig {
  enabled: boolean;
  ldpEnabled: boolean;
  rsvpEnabled: boolean;
  interfaces: MplsInterface[];
  vplsInstances?: VplsInstance[];
}

export interface MplsInterface {
  interfaceName: string;
  transportLdp?: boolean;
  transportRsvp?: boolean;
}

export interface VplsInstance {
  name: string;
  vplsId: string;
  interfaces: string[];
  remotePeers: string[];
}

export interface BridgeConfig {
  name: string;
  ports: string[];
  vlanFiltering: boolean;
  stpEnabled?: boolean;
  stpPriority?: number;
  taggedVlans?: VlanEntry[];
  untaggedVlans?: VlanEntry[];
}

export interface VlanEntry {
  vlanId: number;
  ports: string[];
}

export interface NatRule {
  id: string;
  chain: 'srcnat' | 'dstnat';
  action: string;
  outInterface?: string;
  inInterface?: string;
  srcAddress?: string;
  dstAddress?: string;
  srcPort?: string;
  dstPort?: string;
  toSrcAddress?: string;
  toSrcPort?: string;
  toDstAddress?: string;
  toDstPort?: string;
  comment?: string;
  position?: number;
}

export interface ParseWarning {
  line: number;
  message: string;
  raw?: string;
}

export interface ParseError {
  line: number;
  message: string;
  raw?: string;
}

// ===== Topology Layer =====

export interface TopologyGraph {
  nodes: TopoNode[];
  edges: TopoEdge[];
  stats: TopologyStats;
}

export interface TopologyStats {
  totalDevices: number;
  totalLinks: number;
  totalInterfaces: number;
  detectedSubnets: number;
}

export type TopoNodeKind = 'router' | 'switch' | 'host' | 'cloud' | 'firewall' | 'wireless-ap';

export interface TopoNode {
  id: string;
  kind: TopoNodeKind;
  label: string;
  deviceId?: string;
  vendor?: Vendor;
  // React Flow position
  position?: { x: number; y: number };
  data: TopoNodeData;
}

export interface TopoNodeData {
  hostname: string;
  kind: TopoNodeKind;
  role: DeviceRole;
  interfaceCount: number;
  upInterfaceCount: number;
  errorCount: number;
  warningCount: number;
  vendor?: Vendor;
  image?: string;
  details?: {
    os?: string;
    model?: string;
    serial?: string;
  };
  // Enriched display fields
  ipAddresses?: string[];
  gateway?: string;
  protocols?: {
    bgp?: { asn: number; routerId?: string; neighbors: number };
    ospf?: { routerId?: string; areas: string[] };
    mpls?: boolean;
  };
  interfaces?: {
    name: string;
    address: string;
    prefixLength: number;
    type: string;
    enabled: boolean;
    mtu?: number;
  }[];
  // Edge display
  linkKind?: LinkKind;
  linkStatus?: LinkStatus;
  linkLabel?: string;
  linkEndpoints?: LinkEndpoint[];
}

export type LinkKind = 'ethernet' | 'wireless' | 'vlan' | 'tunnel' | 'pppoe' | 'mpls' | 'bgp' | 'serial';
export type LinkType = 'p2p' | 'broadcast' | 'cloud';
export type LinkStatus = 'ok' | 'warning' | 'error' | 'inactive';

export interface TopoEdge {
  id: string;
  source: string;
  target: string;
  kind: LinkKind;
  type: LinkType;
  network: string;
  label?: string;
  status: LinkStatus;
  issueIds: string[];
  endpoints: LinkEndpoint[];
  bandwidth?: string;
  description?: string;
}

export interface LinkEndpoint {
  deviceId: string;
  deviceHostname: string;
  interfaceId: string;
  interfaceName: string;
  address: string;
  network: string;
  prefixLength: number;
}

// ===== Validation Layer =====

export type Severity = 'info' | 'warning' | 'error';

export interface Issue {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  deviceId?: string;
  deviceHostname?: string;
  interfaceId?: string;
  interfaceName?: string;
  edgeId?: string;
  message: string;
  suggestion?: string;
  sourceLine?: number;
}

export interface ValidationResult {
  issues: Issue[];
  summary: ValidationSummary;
  errors: Issue[];
  warnings: Issue[];
  infos: Issue[];
}

export interface ValidationSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byDevice: Record<string, { errors: number; warnings: number; infos: number }>;
  byRule: Record<string, number>;
}

// ===== Config Input =====

export interface RawConfigBlock {
  id: string;
  filename?: string;
  content: string;
  vendor?: Vendor;
  detectedVendor?: Vendor;
  parseWarnings: ParseWarning[];
  parseErrors: ParseError[];
}

export interface ParseResult {
  rawConfigs: RawConfigBlock[];
  devices: ParsedDevice[];
  topology: TopologyGraph;
  validation: ValidationResult;
  parserVersion: string;
  parseTime: number;
  validationTime: number;
}

// ===== Project State =====

export interface ProjectMetadata {
  id?: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ViewMode = 'logical' | 'physical' | 'topology' | 'table';

export interface GraphLayout {
  direction: 'TB' | 'LR' | 'RL' | 'BT';
  nodeSpacing: number;
  rankSpacing: number;
}