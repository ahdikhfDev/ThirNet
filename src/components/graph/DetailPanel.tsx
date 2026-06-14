'use client';

import { useProjectStore } from '@/lib/store/useProjectStore';
import type { IssueDef } from '@/lib/validators/types';
import {
  X,
  Server,
  Network,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronRight,
  ExternalLink,
  Hash,
  Wifi,
  Route,
  Shield,
  Settings,
} from 'lucide-react';

export default function DetailPanel() {
  const { selectedNodeId, selectedEdgeId, selectNode, selectEdge, devices, topology, validation } = useProjectStore();

  const selectedDevice = selectedNodeId ? devices.find(d => d.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId && topology ? topology.edges.find(e => e.id === selectedEdgeId) : null;
  const deviceIssues = selectedDevice && validation
    ? validation.issues.filter(i => i.deviceId === selectedDevice.id)
    : [];
  const edgeIssues = selectedEdge && validation
    ? validation.issues.filter(i => i.edgeId === selectedEdge.id)
    : [];

  const close = () => {
    selectNode(null);
    selectEdge(null);
  };

  if (!selectedDevice && !selectedEdge) return null;

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800">
        <span className="text-xs font-semibold text-slate-200">
          {selectedDevice ? 'Device Details' : 'Link Details'}
        </span>
        <button onClick={close} className="p-1 hover:bg-slate-700 rounded">
          <X size={14} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedDevice && (
          <DeviceDetail device={selectedDevice} issues={deviceIssues} />
        )}

        {selectedEdge && (
          <EdgeDetail edge={selectedEdge} issues={edgeIssues} />
        )}
      </div>
    </div>
  );
}

function DeviceDetail({ device, issues }: { device: any; issues: IssueDef[] }) {
  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Server size={16} className="text-sky-400" />
          <span className="font-semibold text-white">{device.hostname}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-slate-400">Vendor <span className="text-slate-200">{device.vendor}</span></div>
          <div className="text-slate-400">Role <span className="text-slate-200 capitalize">{device.role}</span></div>
          <div className="text-slate-400">Interfaces <span className="text-slate-200">{device.interfaces.length}</span></div>
          <div className="text-slate-400">Routes <span className="text-slate-200">{device.routes.length}</span></div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <AlertTriangle size={12} /> Issues ({issues.length})
          </h4>
          <div className="space-y-1.5">
            {issues.map(issue => (
              <div
                key={issue.id}
                className="p-2 rounded text-xs"
                style={{
                  backgroundColor: issue.severity === 'error' ? '#ef444415'
                    : issue.severity === 'warning' ? '#f59e0b15'
                    : '#3b82f615',
                  borderLeft: `2px solid ${issue.severity === 'error' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`
                }}
              >
                <div className="font-medium text-slate-200">{issue.ruleName}</div>
                <div className="text-slate-400 mt-0.5">{issue.message}</div>
                {issue.suggestion && (
                  <div className="text-slate-500 mt-1 text-[10px] italic">{issue.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interfaces */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
          <Network size={12} /> Interfaces ({device.interfaces.length})
        </h4>
        <div className="space-y-1">
          {device.interfaces.map((iface: any) => (
            <div key={iface.id} className="bg-slate-800 rounded p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-mono">{iface.name}</span>
                <span className={iface.enabled ? 'text-emerald-400' : 'text-slate-500'}>
                  {iface.enabled ? 'up' : 'down'}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {iface.addresses.map((addr: any, i: number) => (
                  <div key={i} className="text-xs font-mono text-sky-400">
                    {addr.address}/{addr.prefixLength}
                    <span className="text-slate-500 ml-1">{addr.network}</span>
                  </div>
                ))}
                {iface.addresses.length === 0 && (
                  <div className="text-[10px] text-slate-600 italic">no IP assigned</div>
                )}
              </div>
              {iface.mtu && (
                <div className="text-[10px] text-slate-500 mt-1">MTU: {iface.mtu}</div>
              )}
              {iface.vlanId && (
                <div className="text-[10px] text-slate-500">VLAN: {iface.vlanId}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Routes */}
      {device.routes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <Route size={12} /> Routes ({device.routes.length})
          </h4>
          <div className="space-y-1">
            {device.routes.map((route: any) => (
              <div key={route.id} className="bg-slate-800 rounded p-2 text-xs">
                <div className="font-mono text-slate-200">{route.destination}</div>
                <div className="text-slate-400 mt-0.5">via {route.gateway || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routing Protocols */}
      {(device.ospf || device.bgp) && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <Shield size={12} /> Routing
          </h4>
          <div className="space-y-2">
            {device.ospf && (
              <div className="bg-slate-800 rounded p-2">
                <div className="text-xs text-emerald-400 font-medium">OSPF</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Router-ID: {device.ospf.routerId || '—'}
                </div>
                {device.ospf.areas && (
                  <div className="text-[10px] text-slate-400">
                    Areas: {device.ospf.areas.map((a: any) => a.areaId).join(', ')}
                  </div>
                )}
              </div>
            )}
            {device.bgp && (
              <div className="bg-slate-800 rounded p-2">
                <div className="text-xs text-blue-400 font-medium">BGP</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  ASN: {device.bgp.asn} · Router-ID: {device.bgp.routerId || '—'}
                </div>
                {device.bgp.neighbors?.length > 0 && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    Peers: {device.bgp.neighbors.map((n: any) => `${n.address}(AS${n.remoteAsn})`).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* NAT Rules */}
      {device.natRules.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <Settings size={12} /> NAT Rules ({device.natRules.length})
          </h4>
          <div className="space-y-1">
            {device.natRules.map((nat: any) => (
              <div key={nat.id} className="bg-slate-800 rounded p-2 text-xs">
                <div className="text-slate-200">{nat.chain} → {nat.action}</div>
                {nat.srcAddress && <div className="text-slate-400 text-[10px]">src: {nat.srcAddress}</div>}
                {nat.dstAddress && <div className="text-slate-400 text-[10px]">dst: {nat.dstAddress}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EdgeDetail({ edge, issues }: { edge: any; issues: IssueDef[] }) {
  return (
    <div className="p-3 space-y-4">
      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Network size={16} className="text-emerald-400" />
          <span className="font-semibold text-white">Link: {edge.network}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-slate-400">Type <span className="text-slate-200 capitalize">{edge.type}</span></div>
          <div className="text-slate-400">Kind <span className="text-slate-200 capitalize">{edge.kind}</span></div>
          <div className="text-slate-400">Status <span className={`capitalize ${edge.status === 'ok' ? 'text-emerald-400' : edge.status === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>{edge.status}</span></div>
          <div className="text-slate-400">Endpoints <span className="text-slate-200">{edge.endpoints.length}</span></div>
        </div>
      </div>

      {issues.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
            <AlertTriangle size={12} /> Issues ({issues.length})
          </h4>
          <div className="space-y-1.5">
            {issues.map(issue => (
              <div
                key={issue.id}
                className="p-2 rounded text-xs"
                style={{
                  backgroundColor: issue.severity === 'error' ? '#ef444415' : '#f59e0b15',
                  borderLeft: `2px solid ${issue.severity === 'error' ? '#ef4444' : '#f59e0b'}`
                }}
              >
                <div className="font-medium text-slate-200">{issue.ruleName}</div>
                <div className="text-slate-400 mt-0.5">{issue.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-slate-400 mb-2">Endpoints</h4>
        <div className="space-y-1">
          {edge.endpoints.map((ep: any, i: number) => (
            <div key={i} className="bg-slate-800 rounded p-2">
              <div className="text-xs text-slate-200 font-medium">{ep.deviceHostname}</div>
              <div className="text-xs font-mono text-sky-400">{ep.interfaceName}</div>
              <div className="text-[10px] font-mono text-slate-500">{ep.address}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}