import type { TopoEdge } from '../parsers/types';

/**
 * BFS shortest path between two device IDs.
 * Returns { pathNodeIds, pathEdgeIds } or null if no path.
 */
export function findPath(
  edges: TopoEdge[],
  sourceId: string,
  targetId: string,
): { pathNodeIds: string[]; pathEdgeIds: string[] } | null {
  if (sourceId === targetId) return { pathNodeIds: [sourceId], pathEdgeIds: [] };

  // Adjacency: deviceId → [{ neighborId, edgeId }]
  const adj = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ neighbor: e.target, edgeId: e.id });
    adj.get(e.target)!.push({ neighbor: e.source, edgeId: e.id });
  }

  // BFS
  const visited = new Set([sourceId]);
  const queue: Array<{ node: string; pathNodes: string[]; pathEdges: string[] }> = [
    { node: sourceId, pathNodes: [sourceId], pathEdges: [] },
  ];

  while (queue.length > 0) {
    const { node, pathNodes, pathEdges } = queue.shift()!;
    const neighbors = adj.get(node) || [];

    for (const { neighbor, edgeId } of neighbors) {
      if (neighbor === targetId) {
        return {
          pathNodeIds: [...pathNodes, neighbor],
          pathEdgeIds: [...pathEdges, edgeId],
        };
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          node: neighbor,
          pathNodes: [...pathNodes, neighbor],
          pathEdges: [...pathEdges, edgeId],
        });
      }
    }
  }

  return null; // no path
}

/**
 * Build device hostname → device ID mapping
 */
export function buildIdMap(
  edges: TopoEdge[],
  getHostname: (id: string) => string,
): Map<string, string> {
  const map = new Map<string, string>();
  const seen = new Set<string>();

  for (const e of edges) {
    for (const id of [e.source, e.target]) {
      if (!seen.has(id)) {
        seen.add(id);
        const hostname = getHostname(id);
        map.set(hostname, id);
      }
    }
  }

  return map;
}
