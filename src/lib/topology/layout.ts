// Dagre layout adapter for React Flow
import dagre from '@dagrejs/dagre';
import type { TopoNode, TopoEdge, TopoNodeKind, LinkKind } from '../parsers/types';
import type { Node, Edge } from '@xyflow/react';

// Rank order for node placement
const KIND_RANK: Record<TopoNodeKind, number> = {
  firewall: 0,
  router: 1,
  switch: 2,
  host: 3,
  cloud: 4,
  'wireless-ap': 1.5,
};

// Edge colors by link kind
const EDGE_COLORS: Record<LinkKind, { stroke: string; label: string }> = {
  bgp: { stroke: '#a855f7', label: 'BGP' },
  mpls: { stroke: '#3b82f6', label: 'MPLS' },
  ethernet: { stroke: '#64748b', label: 'Eth' },
  wireless: { stroke: '#eab308', label: 'WiFi' },
  vlan: { stroke: '#06b6d4', label: 'VLAN' },
  tunnel: { stroke: '#f97316', label: 'Tunnel' },
  pppoe: { stroke: '#8b5cf6', label: 'PPPoE' },
  serial: { stroke: '#78716c', label: 'Serial' },
};

export function applyLayout(
  nodes: TopoNode[],
  edges: TopoEdge[],
  direction: 'TB' | 'LR' | 'RL' | 'BT' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  const dg = new dagre.graphlib.Graph();
  dg.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR' || direction === 'RL';
  dg.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 120,
    marginx: 60,
    marginy: 60,
  });

  // Add nodes
  for (const node of nodes) {
    const width = node.kind === 'cloud' ? 130 : node.kind === 'host' ? 150 : 240;
    const height = node.kind === 'cloud' ? 90 : node.kind === 'host' ? 80 : node.data.protocols ? 200 : 140;
    dg.setNode(node.id, { width, height });
  }

  // Add edges
  for (const edge of edges) {
    dg.setEdge(edge.source, edge.target);
  }

  // Run dagre layout
  dagre.layout(dg);

  // Convert back to React Flow format
  const rfNodes: Node[] = nodes.map(node => {
    const nodeWithPosition = dg.node(node.id);
    if (!nodeWithPosition) {
      return {
        id: node.id,
        type: getNodeType(node.kind),
        position: { x: 0, y: 0 },
        data: node.data as unknown as Record<string, unknown>,
      };
    }

    const x = isHorizontal ? nodeWithPosition.x - nodeWithPosition.width / 2 : nodeWithPosition.x - nodeWithPosition.width / 2;
    const y = isHorizontal ? nodeWithPosition.y - nodeWithPosition.height / 2 : nodeWithPosition.y - nodeWithPosition.height / 2;

    return {
            id: node.id,
            type: getNodeType(node.kind),
            position: { x, y },
            data: {
              ...node.data,
              kind: node.kind,
              label: node.label,
            } as unknown as Record<string, unknown>,
          };
  });

  // Sort by rank (y position) for consistent ordering
  rfNodes.sort((a, b) => a.position.y - b.position.y);

  // Build edge list with color-coded styling
  const rfEdges: Edge[] = edges.map(edge => {
    const colorInfo = EDGE_COLORS[edge.kind] || EDGE_COLORS.ethernet;
    const hasError = edge.status === 'error';
    const hasWarning = edge.status === 'warning';
    const stroke = hasError ? '#ef4444' : hasWarning ? '#f59e0b' : colorInfo.stroke;
    const opacity = edge.kind === 'ethernet' && !hasError && !hasWarning ? 0.6 : 0.9;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: hasError || hasWarning || edge.kind === 'bgp',
      style: {
        stroke,
        strokeWidth: edge.kind === 'bgp' ? 2.5 : edge.kind === 'mpls' ? 2 : 1.5,
        opacity,
        strokeDasharray: edge.type === 'cloud' ? '8 4' : edge.kind === 'wireless' ? '4 4' : undefined,
      },
      label: `${edge.label || colorInfo.label}${edge.network ? ` ${edge.network}` : ''}${(edge as any).vpls ? ' VPLS' : ''}`,
      labelStyle: {
        fontSize: 10,
        fontWeight: 500,
        fill: hasError ? '#ef4444' : hasWarning ? '#f59e0b' : stroke,
        fontFamily: 'JetBrains Mono, SF Mono, monospace',
      },
      labelBgStyle: {
        fill: '#0f172a',
        fillOpacity: 0.85,
        rx: 3,
        ry: 3,
      },
      markerEnd: {
        type: 'arrowclosed',
        color: stroke,
        width: 14,
        height: 14,
      },
      data: {
        edge,
        kind: edge.kind,
        type: edge.type,
        network: edge.network,
        status: edge.status,
        endpoints: edge.endpoints,
      },
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

function getNodeType(kind: TopoNodeKind): string {
  switch (kind) {
    case 'router': return 'routerNode';
    case 'switch': return 'switchNode';
    case 'firewall': return 'firewallNode';
    case 'cloud': return 'cloudNode';
    case 'wireless-ap': return 'wirelessNode';
    default: return 'hostNode';
  }
}
