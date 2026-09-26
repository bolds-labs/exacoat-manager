import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Modal } from '../ui/Modal';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/Select';
import { 
  Activity, 
  RotateCw, 
  Trash2, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  Terminal, 
  Code, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { 
  fetchWordPressLogs, 
  clearWordPressLogs, 
  WordPressSystemLog, 
  WordPressLogsResponse 
} from '../../lib/wordpressBridge';
import { formatDateTime, formatTimeAgo } from '../../lib/formatters';

export const WordPressSystemLogsTable: React.FC = () => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [logs, setLogs] = useState<WordPressSystemLog[]>([]);
  const [stats, setStats] = useState<WordPressLogsResponse['stats']>({
    total: 0,
    errors: 0,
    warnings: 0,
    success: 0,
    info: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // Context Modal
  const [selectedLog, setSelectedLog] = useState<WordPressSystemLog | null>(null);
  const [copied, setCopied] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    const res = await fetchWordPressLogs({
      channel: channelFilter !== 'all' ? channelFilter : undefined,
      level: levelFilter !== 'all' ? levelFilter : undefined,
      search: searchQuery.trim() || undefined,
      limit: 150,
    });

    if (res.success && res.data) {
      const logRows = (res.data as any).logs || (res.data as any).rows || [];
      setLogs(logRows);
      if ((res.data as any).stats) {
        setStats((res.data as any).stats);
      }
    } else {
      showToast('error', 'Fetch Failed', res.error || 'Could not fetch WordPress system event logs.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [channelFilter, levelFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const handleClearLogs = async () => {
    const isConfirmed = await confirm({
      title: 'Clear WordPress System Event Logs?',
      description: 'Are you sure you want to clear all WordPress system event logs from the database table?',
      confirmText: 'Clear Logs',
      variant: 'danger',
    });
    if (!isConfirmed) {
      return;
    }
    setIsClearing(true);
    const res = await clearWordPressLogs();
    if (res.success) {
      showToast('info', 'Logs Cleared', (res as any).message || 'System logs table emptied.');
      loadLogs();
    } else {
      showToast('error', 'Clear Failed', res.error);
    }
    setIsClearing(false);
  };

  const copyContext = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('info', 'Copied', 'JSON context copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>ERROR</span>
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>WARN</span>
          </span>
        );
      case 'success':
        return (
          <span className="px-2 py-0.5 rounded-md bg-lime-500/10 text-[#f3aa18] border border-lime-500/20 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>SUCCESS</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>INFO</span>
          </span>
        );
    }
  };

  const getChannelBadge = (channel: string) => {
    return (
      <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-zinc-300 font-mono text-[10px] uppercase">
        {channel || 'general'}
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          <span className="text-[11px] text-zinc-500 block mb-1">Total Events</span>
          <strong className="text-xl font-bold text-zinc-900 dark:text-white">{stats.total}</strong>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          <span className="text-[11px] text-rose-400 block mb-1">Errors</span>
          <strong className="text-xl font-bold text-rose-400">{stats.errors}</strong>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          <span className="text-[11px] text-amber-400 block mb-1">Warnings</span>
          <strong className="text-xl font-bold text-amber-400">{stats.warnings}</strong>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          <span className="text-[11px] text-[#f3aa18] block mb-1">Success</span>
          <strong className="text-xl font-bold text-[#f3aa18]">{stats.success}</strong>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          <span className="text-[11px] text-sky-400 block mb-1">Info</span>
          <strong className="text-xl font-bold text-sky-400">{stats.info}</strong>
        </div>
      </div>

      {/* 2. Filter Bar & Actions */}
      <GlassCard className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages, contexts, error codes, emails..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-lime-500/50 focus:border-lime-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs transition-colors shrink-0 font-mono"
            >
              Filter
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            {/* Level Filter */}
            <div className="w-36">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-9 text-xs font-mono bg-zinc-100 dark:bg-black/40 border-zinc-200 dark:border-white/10">
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Errors Only</SelectItem>
                  <SelectItem value="warning">Warnings</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel Filter */}
            <div className="w-44">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="h-9 text-xs font-mono bg-zinc-100 dark:bg-black/40 border-zinc-200 dark:border-white/10">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="email">Emails / ZeptoMail</SelectItem>
                  <SelectItem value="ai">AI / Gemini / GPT</SelectItem>
                  <SelectItem value="vault">Storage Vault (R2)</SelectItem>
                  <SelectItem value="orders">Orders & Checkout</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="shipping">Biteship / Courier</SelectItem>
                  <SelectItem value="woocommerce">WooCommerce Sync</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={loadLogs}
              disabled={isLoading}
              className="p-2 px-3 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-900 dark:text-white flex items-center gap-1.5 border border-zinc-200 dark:border-white/10 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              disabled={isClearing}
              className="p-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 3. Real-Time Logs Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-100/80 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/[0.06] text-zinc-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">Level</th>
                <th className="p-4">Channel</th>
                <th className="p-4">Event Message</th>
                <th className="p-4 text-right pr-6">Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/[0.04]">
              {logs.length > 0 ? (
                logs.map(log => (
                  <tr 
                    key={log.id}
                    onClick={() => log.context && setSelectedLog(log)}
                    className={`hover:bg-zinc-100/50 dark:hover:bg-white/[0.03] transition-colors ${log.context ? 'cursor-pointer' : ''}`}
                  >
                    <td className="p-4 pl-6 text-zinc-400 text-[11px] whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {getLevelBadge(log.level)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {getChannelBadge(log.channel)}
                    </td>
                    <td className="p-4 text-zinc-900 dark:text-zinc-200 font-sans text-xs font-medium max-w-md">
                      <div className="truncate">{log.message}</div>
                    </td>
                    <td className="p-4 text-right pr-6 whitespace-nowrap">
                      {log.context ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-[#f3aa18] border border-white/10 text-[10px] inline-flex items-center gap-1"
                        >
                          <Code className="w-3 h-3" />
                          <span>Inspect JSON</span>
                        </button>
                      ) : (
                        <span className="text-zinc-600 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-500 font-sans">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RotateCw className="w-4 h-4 animate-spin text-[#f3aa18]" />
                        <span>Streaming system logs from WordPress...</span>
                      </div>
                    ) : (
                      <span>No event logs found matching your filters.</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* 4. JSON Context Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        maxWidth="2xl"
        title={
          selectedLog ? (
            <div className="flex items-center gap-2">
              {getLevelBadge(selectedLog.level)}
              <span className="font-bold text-sm text-white font-mono">
                Event Context (#{selectedLog.id})
              </span>
            </div>
          ) : undefined
        }
        footer={
          <div className="flex justify-end w-full">
            <button
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs font-mono cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-zinc-500">Message</span>
              <p className="text-xs text-zinc-200 font-sans font-medium">{selectedLog.message}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                <span>Payload & Diagnostics Data</span>
                <button
                  onClick={() => copyContext(selectedLog.context || '')}
                  className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-black/70 border border-zinc-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-80 whitespace-pre-wrap select-text">
                {selectedLog.context}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
