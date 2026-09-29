import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import {
  fetchEmailLogsDirect,
  resendEmailFromLogDirect,
  clearEmailLogsDirect,
  purgeOldEmailLogsDirect,
  previewEmailHtml,
  ZeptoMailLog,
  EmailLogsResponse,
} from '../../lib/wordpressBridge';
import { ALL_EMAIL_TEMPLATES } from '../../config/emailTemplates';
import { formatDateTime, formatTimeAgo } from '../../lib/formatters';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCw,
  Trash2,
  Search,
  Filter,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Zap,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Info,
  Radio,
  Layers,
} from 'lucide-react';
import { clsx } from 'clsx';

interface EmailLogsTableProps {
  onSelectOrder?: (orderId: number) => void;
}

export const EmailLogsTable: React.FC<EmailLogsTableProps> = ({ onSelectOrder }) => {
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // Data & State
  const [logs, setLogs] = useState<ZeptoMailLog[]>([]);
  const [stats, setStats] = useState<EmailLogsResponse['stats']>({
    total: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    sent: 0,
    bounced: 0,
    failed: 0,
    delivery_rate: 100,
    open_rate: 0,
    avg_latency_ms: 0,
  });
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Drawer & Preview Modals
  const [selectedLog, setSelectedLog] = useState<ZeptoMailLog | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // HTML Preview Modal
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Webhook Help Banner toggle
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);

  // Load Logs
  const loadLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await fetchEmailLogsDirect({
        status: statusFilter,
        event: eventFilter,
        search: searchQuery.trim() || undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.success) {
        setLogs(res.logs || []);
        setStats(res.stats);
        setTotalPages(res.total_pages || 1);
        setTotalCount(res.total || 0);
        if (res.webhook_url) {
          setWebhookUrl(res.webhook_url);
        }
      } else {
        setErrorMsg(res.error || 'Failed to fetch email logs from server.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error fetching email logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, eventFilter, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Handle Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogs();
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Resend Email
  const handleResend = async (log: ZeptoMailLog) => {
    const isConfirmed = await confirm({
      title: 'Resend Email?',
      description: `Are you sure you want to resend this transactional email to ${log.recipient_email}?`,
      confirmText: 'Resend Now',
      variant: 'info',
    });
    if (!isConfirmed) return;

    setIsResending(true);
    const res = await resendEmailFromLogDirect(log.id);
    setIsResending(false);

    if (res.success) {
      showToast('success', 'Email Dispatched', res.message);
      loadLogs(true);
      if (selectedLog && selectedLog.id === log.id) {
        setIsDrawerOpen(false);
      }
    } else {
      showToast('error', 'Resend Failed', res.message);
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    const isConfirmed = await confirm({
      title: 'Clear Email Logs?',
      description: 'This will permanently remove all email delivery logs from the database. Are you sure?',
      confirmText: 'Clear All Logs',
      variant: 'danger',
    });
    if (!isConfirmed) return;

    const res = await clearEmailLogsDirect();
    if (res.success) {
      showToast('info', 'Logs Emptied', res.message || 'All email logs cleared.');
      loadLogs();
    } else {
      showToast('error', 'Clear Failed', res.error || 'Could not clear email logs.');
    }
  };

  // Preview Email HTML
  const handlePreviewEmail = async (log: ZeptoMailLog) => {
    setIsPreviewLoading(true);
    setPreviewSubject(log.subject || 'Email Preview');
    setShowPreviewModal(true);

    try {
      const tmpl = ALL_EMAIL_TEMPLATES.find(t => t.key === log.event);
      const vars = {
        ...(tmpl?.defaults || {}),
        ...(log.metadata || {}),
        customer_name: log.recipient_name || 'Customer',
        recipient_email: log.recipient_email,
      };

      const res = await previewEmailHtml(log.event, vars);
      if (res.success && res.html) {
        setPreviewHtml(res.html);
      } else {
        setPreviewHtml(`<div style="padding: 24px; font-family: sans-serif; color: #71717a;">
          <h3 style="color: #18181b;">Preview Unavailable</h3>
          <p>Could not render HTML template for event: <code>${log.event}</code>.</p>
        </div>`);
      }
    } catch (err: any) {
      setPreviewHtml(`<div style="padding: 24px; font-family: sans-serif; color: #ef4444;">
        Failed rendering preview: ${err.message}
      </div>`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Status Badge Component
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Delivered
          </span>
        );
      case 'opened':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            Opened
          </span>
        );
      case 'clicked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
            Clicked
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Send className="w-3.5 h-3.5 text-cyan-500" />
            Accepted
          </span>
        );
      case 'bounced':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            Bounced
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Failed
          </span>
        );
    }
  };

  // Find readable template label
  const getTemplateLabel = (eventKey: string) => {
    const tmpl = ALL_EMAIL_TEMPLATES.find(t => t.key === eventKey);
    return tmpl ? tmpl.name : eventKey.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Top KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sent */}
        <GlassCard className="p-5 flex items-center justify-between border-l-4 border-l-zinc-500">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Dispatches
            </p>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
              {stats.total.toLocaleString()}
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Avg latency: {stats.avg_latency_ms}ms
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-300">
            <Mail className="w-6 h-6" />
          </div>
        </GlassCard>

        {/* Delivered Rate */}
        <GlassCard className="p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Delivered
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {(stats.delivered + stats.opened).toLocaleString()}
              </h3>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {stats.delivery_rate}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Verified inbox delivery
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </GlassCard>

        {/* Opened Rate */}
        <GlassCard className="p-5 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Opened
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {stats.opened.toLocaleString()}
              </h3>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {stats.open_rate}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Unique open tracking
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Eye className="w-6 h-6" />
          </div>
        </GlassCard>

        {/* Bounced / Failed */}
        <GlassCard className="p-5 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Bounced / Errors
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {(stats.bounced + stats.failed).toLocaleString()}
              </h3>
              {(stats.bounced + stats.failed) > 0 && (
                <span className="text-xs font-bold text-rose-500">
                  {stats.bounced} bounced, {stats.failed} failed
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              {(stats.bounced + stats.failed) === 0 ? 'Healthy zero delivery errors' : 'Requires inspection'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <AlertCircle className="w-6 h-6" />
          </div>
        </GlassCard>
      </div>

      {/* 2. Webhook Setup Banner (Collapsible) */}
      <GlassCard className="p-4 sm:p-5 border border-amber-500/20 bg-amber-500/[0.03]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                ZeptoMail Real-Time Delivery Webhook
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                To track actual delivery, opens, and bounces directly in Manager, add this webhook in ZeptoMail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWebhookGuide(!showWebhookGuide)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-200/80 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
            >
              {showWebhookGuide ? 'Hide Guide' : 'Setup Guide'}
            </button>
            {webhookUrl && (
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, 'webhook-btn')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5"
              >
                {copiedKey === 'webhook-btn' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Webhook URL
              </button>
            )}
          </div>
        </div>

        {showWebhookGuide && (
          <div className="mt-4 pt-4 border-t border-amber-500/15 space-y-3 text-xs text-zinc-600 dark:text-zinc-300 font-sans">
            <p className="font-semibold text-zinc-900 dark:text-white">
              Instructions to enable live statuses from ZeptoMail:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Log in to your <strong>Zoho ZeptoMail</strong> dashboard.</li>
              <li>Navigate to <strong>Mail Agents</strong> and select your active sending agent.</li>
              <li>Click on the <strong>Webhooks</strong> tab, then click <strong>Add Webhook</strong>.</li>
              <li>Paste the webhook URL below and check the boxes for <strong>Delivered</strong>, <strong>Soft Bounces</strong>, <strong>Hard Bounces</strong>, and <strong>Opens</strong>.</li>
              <li>Click <strong>Save</strong>. ZeptoMail will now push real-time delivery events directly to your database.</li>
            </ol>
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/10 font-mono text-[11px] flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-zinc-800 dark:text-zinc-200 truncate">{webhookUrl || 'Loading webhook endpoint...'}</span>
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, 'webhook-code')}
                className="text-amber-600 dark:text-amber-400 hover:underline shrink-0 text-xs font-semibold flex items-center gap-1"
              >
                {copiedKey === 'webhook-code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 3. Search & Filter Bar */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient email, name, subject, or request ID..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-100/70 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Filter Dropdowns & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-zinc-100/70 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="sent">Accepted (In Flight)</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
            </select>

            {/* Event Filter */}
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-zinc-100/70 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/50 max-w-[180px] truncate"
            >
              <option value="all">All Templates</option>
              {ALL_EMAIL_TEMPLATES.map((tmpl) => (
                <option key={tmpl.key} value={tmpl.key}>
                  {tmpl.name}
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadLogs(true)}
              disabled={isLoading || isRefreshing}
              className="p-2 rounded-xl bg-zinc-100/70 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RotateCw className={clsx('w-4 h-4', isRefreshing && 'animate-spin text-amber-500')} />
            </button>

            {/* Clear Logs Button */}
            <button
              type="button"
              onClick={handleClearLogs}
              className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
              title="Clear all email logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 4. Logs Data Table */}
      <GlassCard className="overflow-hidden">
        {/* Error State */}
        {errorMsg && (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Failed to Load Logs</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{errorMsg}</p>
            <button
              type="button"
              onClick={() => loadLogs()}
              className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !errorMsg && (
          <div className="p-16 text-center space-y-3">
            <RotateCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Fetching transactional email telemetry from ZeptoMail...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMsg && logs.length === 0 && (
          <div className="p-16 text-center space-y-3">
            <Mail className="w-10 h-10 text-zinc-400 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">No Email Logs Found</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || eventFilter !== 'all'
                ? 'No email dispatches match the current filters. Try resetting search or status filters.'
                : 'No transactional emails have been logged yet. Emails dispatched via ZeptoMail will appear here automatically.'}
            </p>
            {(searchQuery || statusFilter !== 'all' || eventFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setEventFilter('all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-white/10 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}

        {/* Records Table */}
        {!isLoading && !errorMsg && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/60 dark:bg-white/[0.02] border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Template / Event</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Telemetry</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/[0.06] text-zinc-800 dark:text-zinc-200">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => {
                      setSelectedLog(log);
                      setIsDrawerOpen(true);
                    }}
                    className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>

                    {/* Recipient */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-zinc-900 dark:text-white">
                        {log.recipient_name || 'Customer'}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {log.recipient_email}
                      </div>
                    </td>

                    {/* Template Event */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300">
                        {getTemplateLabel(log.event)}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="py-3.5 px-4 max-w-[220px] truncate text-zinc-700 dark:text-zinc-300" title={log.subject}>
                      {log.subject}
                    </td>

                    {/* Order Drilldown */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {log.order_id ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectOrder) onSelectOrder(log.order_id!);
                          }}
                          className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline font-semibold font-mono"
                        >
                          #{log.order_id}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">N/A</span>
                      )}
                    </td>

                    {/* Telemetry (Latency + Request ID) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-zinc-500">
                          {log.latency_ms > 0 ? `${log.latency_ms}ms` : '0ms'}
                        </span>
                        {log.request_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(log.request_id, `req-${log.id}`);
                            }}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                            title="Copy ZeptoMail Request ID"
                          >
                            {copiedKey === `req-${log.id}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Sent Date / Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                        {formatTimeAgo(log.created_at)}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {formatDateTime(log.created_at)}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePreviewEmail(log)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                          title="Preview Email HTML"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResend(log)}
                          className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Resend this email"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-zinc-400 ml-1" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Footer */}
        {!isLoading && !errorMsg && totalPages > 1 && (
          <div className="p-4 border-t border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div>
              Showing Page <span className="font-bold text-zinc-900 dark:text-white">{currentPage}</span> of{' '}
              <span className="font-bold text-zinc-900 dark:text-white">{totalPages}</span> ({totalCount} total dispatches)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.05] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 6. Email Log Detail Drawer / Modal */}
      {selectedLog && isDrawerOpen && (
        <Modal
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Email Dispatch Telemetry"
          maxWidth="2xl"
        >
          <div className="space-y-6 font-sans text-xs">
            {/* Top Summary Banner */}
            <div className="p-4 rounded-xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedLog.status)}
                  <span className="font-semibold text-zinc-900 dark:text-white text-sm">
                    {getTemplateLabel(selectedLog.event)}
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  Recipient: <strong className="text-zinc-800 dark:text-zinc-200">{selectedLog.recipient_name}</strong> ({selectedLog.recipient_email})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePreviewEmail(selectedLog)}
                  className="px-3 py-2 rounded-xl bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-white font-semibold hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview HTML
                </button>
                <button
                  type="button"
                  onClick={() => handleResend(selectedLog)}
                  disabled={isResending}
                  className="px-3 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isResending ? 'Sending...' : 'Resend'}
                </button>
              </div>
            </div>

            {/* Delivery Lifecycle Timeline */}
            <div className="space-y-3">
              <h5 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                Delivery Lifecycle
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Step 1: Dispatched */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>1. Accepted</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                    {formatDateTime(selectedLog.created_at)}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    HTTP {selectedLog.status_code} in {selectedLog.latency_ms}ms
                  </p>
                </div>

                {/* Step 2: Delivered */}
                <div
                  className={clsx(
                    'p-3.5 rounded-xl border',
                    selectedLog.delivered_at || ['delivered', 'opened', 'clicked'].includes(selectedLog.status)
                      ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                      : selectedLog.status === 'bounced'
                      ? 'border-rose-500/20 bg-rose-500/[0.03]'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] opacity-60'
                  )}
                >
                  <div
                    className={clsx(
                      'flex items-center gap-2 font-bold',
                      selectedLog.delivered_at || ['delivered', 'opened', 'clicked'].includes(selectedLog.status)
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : selectedLog.status === 'bounced'
                        ? 'text-rose-500'
                        : 'text-zinc-500'
                    )}
                  >
                    {selectedLog.status === 'bounced' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>2. Delivery</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                    {selectedLog.delivered_at ? formatDateTime(selectedLog.delivered_at) : selectedLog.status === 'bounced' ? 'Bounced' : 'In Flight / Pending Webhook'}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {selectedLog.status === 'bounced' ? 'Delivery rejected by mail server' : 'Recipient mailbox'}
                  </p>
                </div>

                {/* Step 3: Opened */}
                <div
                  className={clsx(
                    'p-3.5 rounded-xl border',
                    selectedLog.opened_at || ['opened', 'clicked'].includes(selectedLog.status)
                      ? 'border-blue-500/20 bg-blue-500/[0.03]'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50/30 dark:bg-white/[0.01] opacity-60'
                  )}
                >
                  <div
                    className={clsx(
                      'flex items-center gap-2 font-bold',
                      selectedLog.opened_at || ['opened', 'clicked'].includes(selectedLog.status)
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-500'
                    )}
                  >
                    <Eye className="w-4 h-4" />
                    <span>3. Recipient Open</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                    {selectedLog.opened_at ? formatDateTime(selectedLog.opened_at) : 'Not opened yet'}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Pixel beacon confirmation</p>
                </div>
              </div>
            </div>

            {/* Error or Bounce Alert */}
            {(selectedLog.bounce_reason || selectedLog.error_message) && (
              <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 space-y-1">
                <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Delivery Exception Notice</span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300 font-mono">
                  {selectedLog.bounce_reason || selectedLog.error_message}
                </p>
              </div>
            )}

            {/* ZeptoMail Technical Diagnostics */}
            <div className="space-y-2">
              <h5 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                ZeptoMail Telemetry &amp; Identifiers
              </h5>
              <div className="p-3.5 rounded-xl bg-zinc-100/70 dark:bg-black/30 border border-zinc-200 dark:border-white/10 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">ZeptoMail Request ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{selectedLog.request_id || 'N/A'}</span>
                    {selectedLog.request_id && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedLog.request_id, 'drawer-req')}
                        className="text-amber-500 hover:text-amber-400"
                      >
                        {copiedKey === 'drawer-req' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {selectedLog.message_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Message ID:</span>
                    <span className="text-zinc-800 dark:text-zinc-200">{selectedLog.message_id}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Subject:</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-sans font-medium">{selectedLog.subject}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Provider:</span>
                  <span className="text-zinc-800 dark:text-zinc-200 uppercase">{selectedLog.provider}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Latency:</span>
                  <span className="text-zinc-800 dark:text-zinc-200">{selectedLog.latency_ms} ms</span>
                </div>
              </div>
            </div>

            {/* Template Variables / Metadata */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[11px]">
                    Template Variables &amp; Context
                  </h5>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(selectedLog.metadata, null, 2), 'drawer-meta')}
                    className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                  >
                    {copiedKey === 'drawer-meta' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy JSON
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-zinc-100/70 dark:bg-black/40 border border-zinc-200 dark:border-white/10 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 max-h-48 overflow-y-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 7. HTML Preview Modal */}
      {showPreviewModal && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title={`Email Preview: ${previewSubject}`}
          maxWidth="4xl"
        >
          <div className="space-y-3 font-sans">
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] text-xs text-zinc-500 flex items-center justify-between">
              <span>Subject: <strong className="text-zinc-900 dark:text-white">{previewSubject}</strong></span>
              <span className="text-[11px] text-zinc-400">Rendered in responsive dark/light compatible HTML</span>
            </div>

            {isPreviewLoading ? (
              <div className="p-16 text-center space-y-2">
                <RotateCw className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs text-zinc-400">Rendering email preview...</p>
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden bg-white min-h-[460px] max-h-[640px]">
                <iframe
                  title="Rendered Email Preview"
                  srcDoc={previewHtml}
                  className="w-full h-[520px] border-none"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
