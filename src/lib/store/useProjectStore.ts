import { create } from 'zustand';
import type {
  RawConfigBlock,
  ParsedDevice,
  TopologyGraph,
  ValidationResult,
  ParsedDevice as PD,
  TopoNode,
  TopoEdge,
  LinkEndpoint,
} from '../parsers/types';
import { parseRouterOSConfig } from '../parsers/routeros';
import { parseLinuxConfig } from '../parsers/linux';
import { splitMultiDevice } from '../parsers/splitMultiDevice';
import { buildTopology } from '../topology/buildTopology';
import { applyLayout } from '../topology/layout';
import { runAllValidation } from '../validators/runAll';
import type { IssueDef } from '../validators/types';
import type { Node, Edge } from '@xyflow/react';
import { v4 as uuid } from 'uuid';

interface ProjectState {
  // Meta
  projectName: string;
  isLoading: boolean;

  // Raw input
  rawConfigText: string;
  delimiterPattern: string;

  // Parsed data
  rawConfigs: RawConfigBlock[];
  devices: ParsedDevice[];
  topology: TopologyGraph | null;
  validation: ValidationResult | null;

  // Layouted graph
  layoutedNodes: Node[];
  layoutedEdges: Edge[];

  // Selection
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // UI state
  autoValidate: boolean;

  // Actions
  setRawConfigText: (text: string) => void;
  setDelimiterPattern: (pattern: string) => void;
  setProjectName: (name: string) => void;

  parseAndValidate: () => Promise<void>;
  rebuildLayout: (direction?: 'TB' | 'LR' | 'RL' | 'BT') => void;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;

  addRawConfig: (block: RawConfigBlock) => void;
  removeRawConfig: (id: string) => void;
  clearAll: () => void;

  // Get selected details
  getSelectedDevice: () => ParsedDevice | null;
  getSelectedEdge: () => TopoEdge | null;
  getDeviceIssues: (deviceId: string) => IssueDef[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: 'Untitled Network',
  isLoading: false,
  rawConfigText: '',
  delimiterPattern: '',
  rawConfigs: [],
  devices: [],
  topology: null,
  validation: null,
  layoutedNodes: [],
  layoutedEdges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  autoValidate: true,

  setRawConfigText: (text) => set({ rawConfigText: text }),
  setDelimiterPattern: (pattern) => set({ delimiterPattern: pattern }),
  setProjectName: (name) => set({ projectName: name }),

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  clearAll: () => set({
    rawConfigText: '',
    rawConfigs: [],
    devices: [],
    topology: null,
    validation: null,
    layoutedNodes: [],
    layoutedEdges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
  }),

  parseAndValidate: async () => {
    set({ isLoading: true });
    const startTime = Date.now();

    try {
      const state = get();
      const { rawConfigText, delimiterPattern } = state;

      if (!rawConfigText.trim()) {
        set({ isLoading: false });
        return;
      }

      // Step 1: Split multi-device
      const { blocks } = splitMultiDevice(rawConfigText, delimiterPattern);

      // Step 2: Parse each block
      const devices: ParsedDevice[] = [];
      for (const block of blocks) {
        try {
          let device: ParsedDevice;
          if (block.detectedVendor === 'routeros') {
            device = parseRouterOSConfig(block.id, block.content, block.filename);
          } else if (block.detectedVendor === 'linux') {
            device = parseLinuxConfig(block.id, block.filename || 'Linux-Host', block.content);
          } else {
            // Try routeros first, fallback to linux
            try {
              device = parseRouterOSConfig(block.id, block.content, block.filename);
            } catch {
              device = parseLinuxConfig(block.id, block.filename || 'Unknown', block.content);
            }
          }
          devices.push(device);
        } catch (e: any) {
          console.error('Parse error for block:', block.filename, e);
        }
      }

      // Step 3: Build topology
      const topology = buildTopology(devices);

      // Step 4: Validate
      const validation = runAllValidation(devices, topology);

      // Step 5: Apply layout
      const { nodes: rfNodes, edges: rfEdges } = applyLayout(topology.nodes, topology.edges, 'TB');

      set({
        rawConfigs: blocks,
        devices,
        topology,
        validation,
        layoutedNodes: rfNodes,
        layoutedEdges: rfEdges,
        isLoading: false,
      });

      console.log(`Parsed ${devices.length} devices, ${topology.edges.length} links, ${validation.issues.length} issues in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('Parse error:', error);
      set({ isLoading: false });
    }
  },

  rebuildLayout: (direction = 'TB') => {
    const { topology } = get();
    if (!topology) return;
    const { nodes, edges } = applyLayout(topology.nodes, topology.edges, direction);
    set({ layoutedNodes: nodes, layoutedEdges: edges });
  },

  addRawConfig: (block) => {
    const { rawConfigs, rawConfigText } = get();
    const newBlocks = [...rawConfigs, block];
    const newText = newBlocks.map(b => `### ${b.filename}\n${b.content}`).join('\n\n');
    set({ rawConfigs: newBlocks, rawConfigText: newText });
  },

  removeRawConfig: (id) => {
    const { rawConfigs } = get();
    const filtered = rawConfigs.filter(b => b.id !== id);
    const newText = filtered.map(b => `### ${b.filename}\n${b.content}`).join('\n\n');
    set({ rawConfigs: filtered, rawConfigText: newText });
  },

  getSelectedDevice: () => {
    const { devices, selectedNodeId } = get();
    if (!selectedNodeId) return null;
    return devices.find(d => d.id === selectedNodeId) || null;
  },

  getSelectedEdge: () => {
    const { topology, selectedEdgeId } = get();
    if (!topology || !selectedEdgeId) return null;
    return topology.edges.find(e => e.id === selectedEdgeId) || null;
  },

  getDeviceIssues: (deviceId) => {
    const { validation } = get();
    if (!validation) return [];
    return validation.issues.filter(i => i.deviceId === deviceId);
  },
}));