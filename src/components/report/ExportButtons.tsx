'use client';

import { useProjectStore } from '@/lib/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { downloadMarkdownReport, downloadTextReport } from '@/lib/report/exporter';
import { FileText, File, Download } from 'lucide-react';

export default function ExportButtons() {
  const { projectName, devices, topology, validation } = useProjectStore();

  if (!devices.length || !validation) return null;

  const handleExportMD = () => {
    if (!topology) return;
    downloadMarkdownReport(projectName, devices, topology, validation);
  };

  const handleExportTXT = () => {
    if (!topology) return;
    downloadTextReport(projectName, devices, topology, validation);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
      <Download size={12} className="text-slate-400" />
      <span className="text-xs text-slate-400">Export:</span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportMD}
        className="h-6 px-2 text-[10px] border-slate-700 text-slate-400 hover:bg-slate-800"
      >
        <FileText size={10} />
        <span className="ml-1">Markdown</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportTXT}
        className="h-6 px-2 text-[10px] border-slate-700 text-slate-400 hover:bg-slate-800"
      >
        <File size={10} />
        <span className="ml-1">Text</span>
      </Button>
    </div>
  );
}