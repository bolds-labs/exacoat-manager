import React, { useState, useEffect } from 'react';
import { 
  auditLogger, 
  ManagerAuditLogEntry 
} from '../../lib/auditLogger';
import { 
  Terminal, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Camera, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Clock 
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/Select';
import clsx from 'clsx';
import { useConfirm } from '../../context/ConfirmContext';

export const ManagerLiveAuditLogs: React.FC = () => {
  const { confirm } = useConfirm();
  const [logs, setLogs] = useState<ManagerAuditLogEntry[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshLogs = () => {
    setLogs(auditLogger.getLogs());
  };

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    const isConfirmed = await confirm({
      title: 'Clear Audit Logs?',
      description: 'Are you sure you want to clear all in-memory audit logs?',
      confirmText: 'Clear Logs',
      variant: 'danger',
    });
    if (isConfirmed) {
      auditLogger.clear();
      refreshLogs();
    }
  };

  const handleCopy = (log: ManagerAuditLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = logs.filter(log => {
    const matchesCategory = filterCategory === 'all' || log.category === filterCategory;
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query || 
      log.title.toLowerCase().includes(query) ||
      (log.message && log.message.toLowerCase().includes(query)) ||
      (log.model && log.model.toLowerCase().includes(query));

    return matchesCategory && matchesLevel && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai_avatar':
        return <Camera className="w-3.5 h-3.5 text-purple-400" />;
      case 'ai_persona':
      case 'ai_bio':
      case 'ai_artwork':
        return <span className="text-[#f3aa18] font-bold text-xs">✦</span>;
      case 'wp_bridge':
        return <Globe className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'ai_persona':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-lime-500/10 text-[#f3aa18] border border-lime-500/20">
            <span>✦</span>
            AI Persona
          </span>
        );
      case 'ai_bio':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span>✦</span>
            AI Bio
          </span>
        );
      case 'ai_avatar':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Camera className="w-3 h-3" />
            Studio Avatar
          </span>
        );
      case 'wp_bridge':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Globe className="w-3 h-3" />
            WP Bridge
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Terminal className="w-3 h-3" />
            System
          </span>
        );
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'success':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            200 OK
          </span>
        );
      case 'warn':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            WARN
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">
            <AlertTriangle className="w-3 h-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#141414]/90 border border-white/[0.08] shadow-xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Select */}
          <div className="w-48">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs font-mono bg-black/60 border-white/10">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories ({logs.length})</SelectItem>
                <SelectItem value="ai_persona">AI Personas</SelectItem>
                <SelectItem value="ai_bio">AI Bios</SelectItem>
                <SelectItem value="ai_avatar">Photo Studio</SelectItem>
                <SelectItem value="wp_bridge">WordPress Bridge</SelectItem>
                <SelectItem value="system">System Events</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Level Select */}
          <div className="w-36">
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="h-9 text-xs font-mono bg-black/60 border-white/10">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="success">Success (200)</SelectItem>
                <SelectItem value="warn">Warnings</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search prompt, model, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none focus:border-[#f3aa18]"
            />
          </div>
        </div>

        {/* Clear Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => auditLogger.clear()}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 text-xs font-mono transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Log Stream Container */}
      <div className="rounded-2xl bg-[#0d0e12] border border-white/[0.08] overflow-hidden shadow-2xl">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
          <div className="col-span-2 sm:col-span-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Timestamp
          </div>
          <div className="col-span-2 sm:col-span-2">Category</div>
          <div className="col-span-6 sm:col-span-6">Action & Details</div>
          <div className="col-span-2 sm:col-span-2 text-right">Status / Latency</div>
        </div>

        {/* Log Entries */}
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Terminal className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-mono text-zinc-400">No live audit events captured yet.</p>
            <p className="text-xs text-zinc-600 font-sans">
              Perform an action (such as testing an AI model or syncing data) to stream live telemetry.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04] max-h-[650px] overflow-y-auto font-mono text-xs">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center cursor-pointer select-none"
                  >
                    {/* Timestamp */}
                    <div className="col-span-2 sm:col-span-2 text-zinc-500 text-[11px] truncate flex items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#f3aa18] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      )}
                      <span>{log.formattedTime}</span>
                    </div>

                    {/* Category & Provider */}
                    <div className="col-span-2 sm:col-span-2 flex items-center gap-1.5 truncate">
                      {getCategoryIcon(log.category)}
                      <span className="text-zinc-300 font-semibold truncate capitalize">
                        {log.category.replace('ai_', '')}
                      </span>
                    </div>

                    {/* Action Title & Model */}
                    <div className="col-span-6 sm:col-span-6 truncate pr-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-zinc-100 truncate">{log.title}</span>
                        {log.model && (
                          <span className="px-1.5 py-0.2 rounded bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20 text-[10px] shrink-0 font-bold">
                            {log.model}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{log.message}</p>
                    </div>

                    {/* Status & Latency */}
                    <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-2 text-right shrink-0">
                      {log.latencyMs !== undefined && (
                        <span className="text-zinc-500 text-[11px] hidden sm:inline">
                          {log.latencyMs}ms
                        </span>
                      )}
                      {getLevelBadge(log.level)}
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="p-4 bg-black/60 border-t border-white/[0.06] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-400 font-mono flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-[#f3aa18]" /> Event Payload & Raw Telemetry
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(log)}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[10px] font-mono text-zinc-200 transition-all flex items-center gap-1"
                        >
                          {copiedId === log.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedId === log.id ? 'Copied' : 'Copy JSON'}</span>
                        </button>
                      </div>

                      {/* Request and Response side-by-side or stacked */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Request Data */}
                        <div className="p-3 rounded-xl bg-[#090a0d] border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-bold uppercase text-zinc-500">Request Data / Prompt</span>
                          <pre className="text-[11px] text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-60 leading-relaxed">
                            {JSON.stringify(log.requestData || { message: log.message }, null, 2)}
                          </pre>
                        </div>

                        {/* Response Data */}
                        <div className="p-3 rounded-xl bg-[#090a0d] border border-white/[0.06] space-y-1">
                          <span className="text-[10px] font-bold uppercase text-zinc-500">Response Data / Result</span>
                          <pre className="text-[11px] text-emerald-400/90 font-mono overflow-x-auto whitespace-pre-wrap max-h-60 leading-relaxed">
                            {JSON.stringify(log.responseData || { error: log.error || 'None' }, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
