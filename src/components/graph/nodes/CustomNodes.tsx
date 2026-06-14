'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Server, HardDrive, Shield, Wifi, Globe, Cpu, Network } from 'lucide-react';

interface TopoNodeData {
  hostname?: string;
  interfaceCount?: number;
  errorCount?: number;
  warningCount?: number;
  vendor?: string;
  ipAddresses?: string[];
  gateway?: string;
  protocols?: {
    bgp?: { asn: number; routerId?: string; neighbors?: number };
    ospf?: { routerId?: string; areas?: string[] };
    mpls?: boolean;
  };
  interfaces?: Array<{ name: string; address: string; prefixLength: number }>;
}

// ── Color palette ──────────────────────────────────────────────────────────
const C = {
  green: '#22c55e', red: '#ef4444', amber: '#f59e0b',
  blue: '#3b82f6', purple: '#a855f7', cyan: '#06b6d4',
  orange: '#f97316', slate: '#64748b', border: '#334155',
  bg: { router: '#0f172a', switch: '#0c1322', firewall: '#1c1917', host: '#1a1a2e', cloud: '#0f172a' },
} as const;

// Determine role badge from protocols
function getRoleBadge(data: TopoNodeData): { label: string; color: string } {
  const p = data.protocols;
  if (data.vendor === 'linux') return { label: 'Server', color: C.amber };
  if (p?.bgp && p?.mpls) return { label: 'PE', color: C.purple };
  if (p?.mpls && p?.ospf) return { label: 'Core', color: C.blue };
  if (p?.ospf) return { label: 'Router', color: C.cyan };
  if (p?.bgp) return { label: 'Edge', color: C.purple };
  return { label: 'Router', color: C.slate };
}
const ProtoBadge = ({ label, color, size = 'sm' }: { label: string; color: string; size?: 'xs' | 'sm' }) => (
  <span
    className={`inline-flex items-center gap-0.5 rounded-full font-mono font-bold uppercase ${
      size === 'xs' ? 'px-1 py-0 text-[8px]' : 'px-1.5 py-px text-[9px]'
    }`}
    style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
  >
    {label}
  </span>
);

// ── IP pill ─────────────────────────────────────────────────────────────────
const IpPill = ({ ip, isGateway }: { ip: string; isGateway?: boolean }) => (
  <span
    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
    style={{ background: isGateway ? '#f59e0b15' : '#1e293b', border: `1px solid ${isGateway ? '#f59e0b44' : '#334155'}` }}
  >
    {isGateway && <span className="text-amber-400 font-bold">⬆</span>}
    {ip}
  </span>
);

// ── Base node wrapper ───────────────────────────────────────────────────────
function NodeWrapper({
  children,
  isSelected,
  statusColor,
  style,
}: {
  children: React.ReactNode;
  isSelected?: boolean;
  statusColor: string;
  style: { bg: string; border: string };
}) {
  return (
    <div
      className="relative rounded-xl border-2 transition-all duration-150"
      style={{
        backgroundColor: style.bg,
        borderColor: isSelected ? statusColor : style.border,
        boxShadow: isSelected
          ? `0 0 0 2px ${statusColor}44, 0 0 20px ${statusColor}22`
          : `0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)`,
        minWidth: 220,
      }}
    >
      {children}
    </div>
  );
}

// ── Router node (full info) ─────────────────────────────────────────────────
export const RouterNode = memo(({ data, selected }: { data: TopoNodeData; selected?: boolean }) => {
  const errors = data.errorCount || 0;
  const warns = data.warningCount || 0;
  const statusColor = errors > 0 ? C.red : warns > 0 ? C.amber : C.green;
  const p: Record<string, any> = data.protocols || {};
  const ips = data.ipAddresses || [];
  const ifaces = data.interfaces || [];
  const gateway = data.gateway;

  return (
    <NodeWrapper isSelected={selected} statusColor={statusColor} style={{ bg: C.bg.router, border: C.border }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-3 !h-3 !border-2 !border-slate-800" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-3 !h-3 !border-2 !border-slate-800" />
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-slate-600 !w-2 !h-2" />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-700/50">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${C.cyan}20` }}>
          <Server size={16} style={{ color: C.cyan }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-slate-100">{data.hostname}</span>
            {/* Vendor badge */}
            <span className="flex-shrink-0 rounded border border-slate-600 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-slate-400">
              {data.vendor === 'routeros' ? 'ROS' : data.vendor === 'linux' ? 'Linux' : 'Router'}
            </span>
            {/* Role badge */}
            {(() => {
              const role = getRoleBadge(data);
              return (
                <span className="flex-shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase"
                  style={{ backgroundColor: `${role.color}18`, color: role.color, border: `1px solid ${role.color}44` }}>
                  {role.label}
                </span>
              );
            })()}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Network size={9} style={{ color: C.slate }} />
            <span className="text-[10px] text-slate-500">{data.interfaceCount || 0} interfaces</span>
          </div>
        </div>
        {/* Status dot */}
        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
      </div>

      {/* IPs */}
      {ips.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-700/30">
          {ips.slice(0, 3).map((ip, i) => (
            <IpPill key={i} ip={ip} isGateway={!!gateway && ip.split('/')[0] === gateway} />
          ))}
          {ips.length > 3 && <span className="text-[9px] text-slate-600 self-center">+{ips.length - 3}</span>}
        </div>
      )}

      {/* Interfaces mini-list */}
      {ifaces.length > 0 && (
        <div className="px-3 py-1.5 border-b border-slate-700/30">
          {ifaces.slice(0, 2).map((iface: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[9px] text-slate-500">
              <span className="font-mono text-slate-400">{iface.name}</span>
              <span className="font-mono">{iface.address}/{iface.prefixLength}</span>
            </div>
          ))}
        </div>
      )}

      {/* Protocols */}
      {(p.bgp || p.ospf || p.mpls) && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-700/30">
          {p.bgp && (
            <>
              <ProtoBadge label={`BGP ${p.bgp.asn}`} color={C.purple} />
              {p.bgp.neighbors && p.bgp.neighbors > 0 && (
                <span className="text-[9px] text-slate-500">{p.bgp.neighbors} peer{p.bgp.neighbors !== 1 ? 's' : ''}</span>
              )}
            </>
          )}
          {p.ospf && (
            <>
              <ProtoBadge label="OSPF" color={C.green} />
              <span className="text-[9px] text-slate-500">
                {p.ospf.areas?.join(', ') || 'area 0'}
                {p.ospf.routerId && <span className="ml-1 font-mono text-[8px]">{p.ospf.routerId}</span>}
              </span>
            </>
          )}
          {p.mpls && <ProtoBadge label="MPLS" color={C.blue} />}
        </div>
      )}

      {/* Footer badges */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        {errors > 0 && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: C.red }}>
            {errors} error{errors > 1 ? 's' : ''}
          </span>
        )}
        {warns > 0 && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ background: C.amber }}>
            {warns} warn{warns > 1 ? 's' : ''}
          </span>
        )}
        {errors === 0 && warns === 0 && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${C.green}20`, color: C.green }}>
            ✓ OK
          </span>
        )}
        {/* Protocol summary */}
        {p.bgp && <span className="ml-auto text-[8px] font-mono text-purple-400">iBGP</span>}
        {p.ospf && !p.bgp && <span className="ml-auto text-[8px] font-mono text-green-400">OSPF</span>}
        {data.gateway && !p.bgp && !p.ospf && (
          <span className="ml-auto text-[8px] font-mono text-amber-500">⬆ gw</span>
        )}
      </div>
    </NodeWrapper>
  );
});

// ── Switch node ─────────────────────────────────────────────────────────────
export const SwitchNode = memo(({ data, selected }: { data: TopoNodeData; selected?: boolean }) => {
  const errors = data.errorCount || 0;
  const warns = data.warningCount || 0;
  const statusColor = errors > 0 ? C.red : warns > 0 ? C.amber : C.green;

  return (
    <NodeWrapper isSelected={selected} statusColor={statusColor} style={{ bg: C.bg.switch, border: '#1e3a5f' }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-slate-600 !w-2 !h-2" />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-700/50">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.green}20` }}>
          <HardDrive size={16} style={{ color: C.green }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-100">{data.hostname}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="rounded border border-slate-600 px-1 py-px text-[9px] font-medium text-slate-400">L2</span>
            <span className="text-[10px] text-slate-500">{data.interfaceCount || 0} ports</span>
          </div>
        </div>
        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
      </div>

      {/* IPs if any */}
      {(data.ipAddresses || []).length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-slate-700/30">
          {(data.ipAddresses as string[]).slice(0, 2).map((ip, i) => (
            <IpPill key={i} ip={ip} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 px-3 py-2">
        {errors === 0 && warns === 0 && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${C.green}20`, color: C.green }}>
            ✓ Managed
          </span>
        )}
      </div>
    </NodeWrapper>
  );
});

// ── Host node ───────────────────────────────────────────────────────────────
export const HostNode = memo(({ data, selected }: { data: TopoNodeData; selected?: boolean }) => {
  const errors = data.errorCount || 0;
  const warns = data.warningCount || 0;
  const statusColor = errors > 0 ? C.red : warns > 0 ? C.amber : C.green;
  const ips = data.ipAddresses || [];

  return (
    <NodeWrapper isSelected={selected} statusColor={statusColor} style={{ bg: C.bg.host, border: '#3a3a5e' }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-3 !h-3" />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: '#a855f720' }}>
          <Cpu size={16} style={{ color: '#a855f7' }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-200">{data.hostname}</div>
          {ips.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {ips.slice(0, 2).map((ip: string, i: number) => (
                <IpPill key={i} ip={ip} />
              ))}
            </div>
          )}
        </div>
        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-2">
        {errors === 0 && warns === 0 && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400" style={{ background: '#ffffff08' }}>Host</span>
        )}
      </div>
    </NodeWrapper>
  );
});

// ── Cloud node ──────────────────────────────────────────────────────────────
export const CloudNode = memo(({ data }: { data: TopoNodeData }) => {
  return (
    <div
      className="relative flex min-w-[130px] items-center justify-center rounded-2xl border-2 border-dashed px-4 py-3"
      style={{ background: '#0f172a', borderColor: '#1e3a5f', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500 !w-3 !h-3" />
      <div className="flex flex-col items-center gap-1.5">
        <Globe size={18} style={{ color: C.slate }} />
        <span className="text-xs font-medium text-slate-400">{data.hostname || 'Internet'}</span>
        {(data.ipAddresses?.length || 0) > 0 && (
          <span className="font-mono text-[9px] text-slate-600">{data.ipAddresses![0]}</span>
        )}
      </div>
    </div>
  );
});

// ── Firewall node ───────────────────────────────────────────────────────────
export const FirewallNode = memo(({ data, selected }: { data: TopoNodeData; selected?: boolean }) => {
  const errors = data.errorCount || 0;
  const warns = data.warningCount || 0;
  const statusColor = errors > 0 ? C.red : warns > 0 ? C.amber : C.green;
  const ips = data.ipAddresses || [];

  return (
    <NodeWrapper isSelected={selected} statusColor={statusColor} style={{ bg: C.bg.firewall, border: '#44403c' }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} className="!bg-slate-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-slate-600 !w-2 !h-2" />

      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-stone-700/50">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.red}20` }}>
          <Shield size={16} style={{ color: C.red }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-slate-100">{data.hostname}</span>
            <span className="rounded border border-stone-600 px-1 py-px text-[9px] font-medium text-stone-400">FW</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {ips.slice(0, 2).map((ip: string, i: number) => <IpPill key={i} ip={ip} />)}
          </div>
        </div>
        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
      </div>

      <div className="flex items-center gap-1.5 px-3 py-2">
        {errors === 0 && warns === 0 && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-400" style={{ background: `${C.red}15` }}>Secured</span>
        )}
      </div>
    </NodeWrapper>
  );
});

// ── Wireless AP node ────────────────────────────────────────────────────────
export const WirelessNode = memo(({ data, selected }: { data: TopoNodeData; selected?: boolean }) => {
  const statusColor = C.green;
  return (
    <NodeWrapper isSelected={selected} statusColor={statusColor} style={{ bg: '#0f172a', border: '#1e4d3d' }}>
      <Handle type="target" position={Position.Top} className="!bg-slate-600 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !w-3 !h-3" />
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${C.amber}20` }}>
          <Wifi size={16} style={{ color: C.amber }} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-slate-200">{data.hostname}</span>
          <span className="ml-1.5 rounded border border-amber-700 px-1 py-px text-[9px] font-medium text-amber-400">AP</span>
        </div>
      </div>
    </NodeWrapper>
  );
});

// ── Export ─────────────────────────────────────────────────────────────────
export const NODE_TYPES = {
  routerNode: RouterNode,
  switchNode: SwitchNode,
  hostNode: HostNode,
  cloudNode: CloudNode,
  firewallNode: FirewallNode,
  wirelessNode: WirelessNode,
};