'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/lib/store/useProjectStore';
import type { IssueDef } from '@/lib/validators/types';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type SeverityTab = 'all' | 'error' | 'warning' | 'info';

export default function IssueList() {
  const { validation, devices } = useProjectStore();
  const [tab, setTab] = useState<SeverityTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const issues = useMemo(() => {
    if (!validation) return [];
    return validation.issues;
  }, [validation]);

  const filteredIssues = useMemo(() => {
    if (tab === 'all') return issues;
    return issues.filter(i => i.severity === tab);
  }, [issues, tab]);

  if (!validation || issues.length === 0) return null;

  const counts = {
    all: issues.length,
    error: validation.summary.errors,
    warning: validation.summary.warnings,
    info: validation.summary.infos,
  };

  const tabs: { id: SeverityTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'error', label: 'Errors', count: counts.error },
    { id: 'warning', label: 'Warnings', count: counts.warning },
    { id: 'info', label: 'Info', count: counts.info },
  ];

  return (
    <div className="border-t border-slate-700 bg-slate-900">
      {/* Tabs */}
      <div className="flex items-center px-3 py-2 gap-2 border-b border-slate-800">
        <AlertTriangle size={14} className="text-slate-400" />
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors
                ${tab === t.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300'
                }
                ${t.id === 'error' && t.count > 0 ? 'text-red-400' : ''}
                ${t.id === 'warning' && t.count > 0 ? 'text-yellow-400' : ''}
              `}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="max-h-48 overflow-y-auto">
        {filteredIssues.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs">No issues</div>
        ) : (
          filteredIssues.map(issue => (
            <div key={issue.id} className="border-b border-slate-800 last:border-0">
              <button
                onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {issue.severity === 'error' ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : issue.severity === 'warning' ? (
                    <AlertTriangle size={14} className="text-yellow-400" />
                  ) : (
                    <Info size={14} className="text-blue-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`
                      font-medium
                      ${issue.severity === 'error' ? 'text-red-300' : ''}
                      ${issue.severity === 'warning' ? 'text-yellow-300' : ''}
                      ${issue.severity === 'info' ? 'text-blue-300' : ''}
                    `}>
                      {issue.ruleName}
                    </span>
                    {issue.deviceHostname && (
                      <span className="text-slate-500">· {issue.deviceHostname}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">{issue.message}</div>
                </div>

                <div className="flex-shrink-0 text-slate-500">
                  {expandedId === issue.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </div>
              </button>

              {expandedId === issue.id && issue.suggestion && (
                <div className="px-3 pb-2 text-xs text-slate-500 italic bg-slate-800/30 ml-7 rounded">
                  Fix: {issue.suggestion}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}