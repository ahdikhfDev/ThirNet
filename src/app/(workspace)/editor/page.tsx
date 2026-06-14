'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import ConfigInput from '@/components/input/ConfigInput';
import IssueList from '@/components/report/IssueList';
import DetailPanel from '@/components/graph/DetailPanel';
import ExportButtons from '@/components/report/ExportButtons';
import { Network, Globe, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const TopologyCanvas = dynamic(
  () => import('@/components/graph/TopologyCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 text-sm">Loading topology viewer...</div> }
);

export default function EditorPage() {
  const { projectName, setProjectName } = useProjectStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const { selectedNodeId, selectedEdgeId } = useProjectStore();

  // Auto-open detail panel when node/edge selected
  const detailPanelShouldShow = selectedNodeId || selectedEdgeId;

  return (
    <div className="w-screen h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-4 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors mr-1"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <div className="flex items-center gap-2">
          <Network size={18} className="text-sky-400" />
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-200 outline-none border-b border-transparent hover:border-slate-700 focus:border-sky-500 px-1 w-48"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/ahdikhfDev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Globe size={16} />
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — collapsible */}
        <div
          className="flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-950 transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            width: sidebarOpen ? '400px' : '0px',
            opacity: sidebarOpen ? 1 : 0,
          }}
        >
          {sidebarOpen && (
            <div className="w-[400px] h-full flex flex-col">
              <ExportButtons />
              <ConfigInput />
              <IssueList />
            </div>
          )}
        </div>

        {/* Topology visualization (center) */}
        <div className="flex-1 relative bg-slate-950">
          <TopologyCanvas />
        </div>

        {/* Right detail panel — collapsible */}
        <div
          className="flex-shrink-0 flex flex-col bg-slate-900 transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            width: detailPanelShouldShow ? '320px' : '0px',
            opacity: detailPanelShouldShow ? 1 : 0,
          }}
        >
          {detailPanelShouldShow && <DetailPanel />}
        </div>
      </div>
    </div>
  );
}