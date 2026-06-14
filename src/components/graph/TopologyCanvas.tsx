'use client';

import { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  PanelPosition,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import '@xyflow/react/dist/style.css';
import './topo-animations.css';

import { NODE_TYPES } from './nodes/CustomNodes';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { cn } from '@/lib/utils';
import {
  RotateCcw,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  LayoutGrid,
  Camera,
  Route,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TopologyCanvas() {
  const {
    layoutedNodes,
    layoutedEdges,
    rebuildLayout,
    selectNode,
    selectEdge,
    selectedNodeId,
    selectedEdgeId,
    validation,
    topology,
    projectName,
  pathEdgeIds,
    pathNodeIds,
    findPath,
    clearPath,
    traceSourceId,
    setTraceSourceId,
  } = useProjectStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Merge issues into nodes for status display
  const nodesWithStatus = useMemo(() => {
    if (!validation) return layoutedNodes;
    return layoutedNodes.map(node => {
      const deviceIssues = validation.issues.filter(i => i.deviceId === node.id);
      const errors = deviceIssues.filter(i => i.severity === 'error').length;
      const warnings = deviceIssues.filter(i => i.severity === 'warning').length;
      return {
        ...node,
        data: {
          ...node.data,
          errorCount: errors,
          warningCount: warnings,
        },
      };
    });
  }, [layoutedNodes, validation]);

  // Merge issues into edges for status display
  const edgesWithStatus = useMemo(() => {
    const pathSet = new Set(pathEdgeIds || []);
    return layoutedEdges.map(edge => {
      const isOnPath = pathSet.has(edge.id);
      const edgeIssues = validation?.issues.filter(i => i.edgeId === edge.id) || [];
      const errors = edgeIssues.filter(i => i.severity === 'error').length;
      const warnings = edgeIssues.filter(i => i.severity === 'warning').length;

      let color = edge.style?.stroke as string || '#22c55e';
      let width = 2;
      if (isOnPath) { color = '#fbbf24'; width = 3; }
      else if (errors > 0) { color = '#ef4444'; width = 3; }
      else if (warnings > 0) { color = '#f59e0b'; width = 2.5; }

      return {
        ...edge,
        style: { ...edge.style, stroke: color, strokeWidth: width },
        animated: isOnPath || errors > 0 || warnings > 0,
        className: isOnPath ? 'path-edge' : '',
      };
    });
  }, [layoutedEdges, validation, pathEdgeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithStatus);
  const [edges, setEdges, onEdgesChange] = useEdgesState(edgesWithStatus);

  // Sync from store
  useMemo(() => {
    setNodes(nodesWithStatus as any);
    setEdges(edgesWithStatus as any);
  }, [nodesWithStatus, edgesWithStatus]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    selectEdge(edge.id);
  }, [selectEdge]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  // Path trace helper
  const handleTraceFrom = useCallback(() => {
    if (!selectedNodeId) return;
    if (traceSourceId && traceSourceId !== selectedNodeId) {
      findPath(traceSourceId, selectedNodeId);
    } else {
      setTraceSourceId(selectedNodeId);
    }
  }, [selectedNodeId, traceSourceId, findPath]);

  const handleClearPath = useCallback(() => {
    clearPath();
    setTraceSourceId(null);
  }, [clearPath]);

  const handleDownloadPng = useCallback(async () => {
    try {
      const png = await toPng(document.querySelector('.react-flow') as HTMLElement, { backgroundColor: '#0f172a' });
      const a = document.createElement('a');
      a.href = png;
      a.download = `${projectName || 'network-topology'}.png`;
      a.click();
    } catch {}
  }, [projectName]);

  if (layoutedNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="text-center text-slate-500">
          <div className="text-6xl mb-4">🌐</div>
          <p className="text-lg font-medium">Paste network configs to visualize</p>
          <p className="text-sm mt-1">RouterOS / Linux configs will be auto-parsed</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />

        <Controls
          position="bottom-right"
          className="!bg-slate-900 !border-slate-700 !rounded-lg !shadow-xl"
          style={{ button: { backgroundColor: '#0f172a', color: '#94a3b8', borderColor: '#334155' } } as any}
        />

        <MiniMap
          position="bottom-left"
          nodeColor={(node) => {
            const errors = (node.data as any)?.errorCount || 0;
            const warns = (node.data as any)?.warningCount || 0;
            if (errors > 0) return '#ef4444';
            if (warns > 0) return '#f59e0b';
            return '#22c55e';
          }}
          maskColor="rgba(15, 23, 42, 0.8)"
          className="!bg-slate-900 !border-slate-700 !rounded-lg"
          style={{ border: '1px solid #334155' } as any}
        />

        <Panel position="top-right" className="flex gap-2 items-start">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPng}
            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
            title="Export PNG"
          >
            <Camera size={14} />
          </Button>
          {/* Trace controls */}
          {pathEdgeIds.length > 0 ? (
            <div className="bg-slate-900 border border-amber-700 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-amber-900/20">
              <span className="text-[10px] text-amber-400 font-medium">
                Path: {pathNodeIds.length} hops
              </span>
              <Button variant="ghost" size="sm" onClick={handleClearPath} className="text-amber-400 hover:text-amber-300 h-6 px-1">
                <X size={12} />
              </Button>
            </div>
          ) : traceSourceId ? (
            <div className="bg-slate-900 border border-amber-700/50 rounded-lg px-2 py-1 flex items-center gap-1.5">
              <Route size={12} className="text-amber-400" />
              <span className="text-[10px] text-amber-400">
                Click target device
              </span>
              <Button variant="ghost" size="sm" onClick={handleClearPath} className="text-amber-400 hover:text-amber-300 h-6 px-1">
                <X size={12} />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTraceFrom}
              disabled={!selectedNodeId}
              className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
              title="Start trace from selected device"
            >
              <Route size={14} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => rebuildLayout('TB')}
            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <LayoutGrid size={14} />
            <span className="ml-1">TB</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rebuildLayout('LR')}
            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <LayoutGrid size={14} className="rotate-90" />
          </Button>
        </Panel>

        {topology && (
          <Panel position="top-left">
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400">
              <span className="text-slate-200 font-semibold">{topology.stats.totalDevices}</span> devices ·{' '}
              <span className="text-slate-200 font-semibold">{topology.stats.totalLinks}</span> links ·{' '}
              <span className="text-slate-200 font-semibold">{topology.stats.detectedSubnets}</span> subnets
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}