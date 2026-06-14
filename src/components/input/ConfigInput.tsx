'use client';

import { useState, useCallback, useRef } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Play,
  Trash2,
  FileUp,
  FileText,
  Code,
  Loader2,
  ClipboardPaste,
} from 'lucide-react';

export default function ConfigInput() {
  const {
    rawConfigText,
    setRawConfigText,
    delimiterPattern,
    setDelimiterPattern,
    parseAndValidate,
    clearAll,
    isLoading,
    devices,
    validation,
  } = useProjectStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const reader = new FileReader();
    const queue = Array.from(files);
    let processed = 0;
    let combined = '';

    const readNext = () => {
      if (processed >= queue.length) {
        setRawConfigText(combined);
        return;
      }
      const file = queue[processed];
      processed++;
      const fileReader = new FileReader();
      fileReader.onload = (ev) => {
        const content = ev.target?.result as string;
        combined = combined
          ? `${combined}\n\n### ${file.name}\n${content}`
          : `### ${file.name}\n${content}`;
        readNext();
      };
      fileReader.readAsText(file);
    };

    readNext();
  }, [setRawConfigText]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawConfigText(text);
    } catch {}
  }, [setRawConfigText]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Button
            onClick={parseAndValidate}
            disabled={isLoading || !rawConfigText.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            <span className="ml-1.5 text-xs font-medium">
              {isLoading ? 'Parsing...' : 'Parse & Visualize'}
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="border-slate-700 text-slate-400 hover:bg-slate-800"
          >
            <FileUp size={14} />
            <span className="ml-1.5 text-xs">Upload</span>
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".rsc,.txt,.conf,.yaml,.cfg"
            className="hidden"
            onChange={handleFileUpload}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            disabled={isLoading}
            className="border-slate-700 text-slate-400 hover:bg-slate-800"
          >
            <ClipboardPaste size={14} />
            <span className="ml-1.5 text-xs">Paste</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch('/sample-configs/full-topology.txt');
                const text = await res.text();
                setRawConfigText(text);
              } catch {
                const res = await fetch('/sample-config.txt');
                const text = await res.text();
                setRawConfigText(text);
              }
            }}
            disabled={isLoading}
            className="border-slate-700 text-slate-400 hover:bg-slate-800 ml-auto"
          >
            <FileText size={14} />
            <span className="ml-1.5 text-xs">Sample</span>
          </Button>

          {rawConfigText && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={isLoading}
              className="border-red-800 text-red-400 hover:bg-red-950"
            >
              <Trash2 size={14} />
              <span className="ml-1.5 text-xs">Clear</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Code size={12} className="text-slate-500" />
          <input
            type="text"
            value={delimiterPattern}
            onChange={e => setDelimiterPattern(e.target.value)}
            placeholder="Delimiter regex (optional for multi-device)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded text-xs px-2 py-1 text-slate-400 placeholder:text-slate-600 outline-none focus:border-slate-500"
          />
        </div>
      </div>

      <div className="flex-1 relative">
        <textarea
          value={rawConfigText}
          onChange={e => setRawConfigText(e.target.value)}
          placeholder={`Paste RouterOS / Linux network configs here...

Multiple devices? Use markers like:
  ### Router-Name
  [config content]

  ### Switch-Name
  [config content]

Or just paste raw config — auto-detect will handle it.`}
          className="w-full h-full bg-slate-950 text-slate-200 font-mono text-xs p-4 resize-none outline-none border-none placeholder:text-slate-700"
          style={{ lineHeight: '1.5', tabSize: 2 }}
          spellCheck={false}
        />
      </div>

      <div className="border-t border-slate-800 px-3 py-1.5 flex items-center gap-3 text-[10px] text-slate-500">
        <span>Parser: RouterOS / Linux</span>
        {devices.length > 0 && (
          <>
            <span>·</span>
            <span className="text-slate-300">{devices.length} devices parsed</span>
            {validation && (
              <>
                <span>·</span>
                {validation.summary.errors > 0 && (
                  <span className="text-red-400">{validation.summary.errors} errors</span>
                )}
                {validation.summary.warnings > 0 && (
                  <span className="text-yellow-400">{validation.summary.warnings} warnings</span>
                )}
                {validation.summary.errors === 0 && validation.summary.warnings === 0 && (
                  <span className="text-emerald-400">All clear ✓</span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}