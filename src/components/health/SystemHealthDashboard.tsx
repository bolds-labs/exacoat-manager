import React, { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { runSystemDiagnostics, DiagnosticsReport } from '../../lib/healthCheck';
import { CatalogReconciliationResult, fetchWordPressSiteHealth, getWpBaseUrl, pingWordPressPlugin, runCatalogReconciliation, WordPressSiteHealth } from '../../lib/wordpressBridge';
import { formatDateTime } from '../../lib/formatters';
import { 
  Activity, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  Database, 
  Server, 
  Download,
  Globe,
  Radio,
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const SystemHealthDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [wpHealth, setWpHealth] = useState<WordPressSiteHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPingingWp, setIsPingingWp] = useState(false);
  const [catalogReport, setCatalogReport] = useState<CatalogReconciliationResult | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [catalogPage, setCatalogPage] = useState(1);

  const handleRunDiagnostics = async () => {
    setIsLoading(true);
    try {
      const [diagRes, wpRes] = await Promise.all([
        runSystemDiagnostics(),
        fetchWordPressSiteHealth(),
      ]);
      setReport(diagRes);
      setWpHealth(wpRes);
      showToast('info', 'Diagnostics Complete', `System status is ${diagRes.overallStatus.toUpperCase()}.`);
    } catch (err: any) {
      console.error('[DIAGNOSTICS FATAL]:', err);
      showToast('error', 'Diagnostics Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePingWordPress = async () => {
    setIsPingingWp(true);
    const res = await pingWordPressPlugin();
    if (res.success) {
      showToast('success', 'WordPress Ping OK', res.message);
    } else {
      showToast('warning', 'WordPress Ping Failed', res.message);
    }
    setIsPingingWp(false);
  };

  const handleCatalogReconciliation = async (page = catalogPage) => {
    setIsReconciling(true);
    const result = await runCatalogReconciliation(page, 250);
    setCatalogReport(result);
    if (result.success) {
      setCatalogPage(page);
      const issueCount = Object.values(result.issues || {}).reduce((sum, issue: any) => sum + (issue.count || 0), 0);
      showToast(issueCount ? 'warning' : 'success', 'Catalog Reconciliation Complete', `${issueCount} issue occurrences found in ${(result as any).scope?.scanned || 0} rows.`);
    } else {
      showToast('error', 'Catalog Reconciliation Failed', result.message || 'The diagnostic could not be completed.');
    }
    setIsReconciling(false);
  };

  useEffect(() => {
    handleRunDiagnostics();
  }, []);

  const handleExportReport = () => {
    if (!report) return;
    const fullReport = {
      ...report,
      wordpressBridge: wpHealth,
      catalogReconciliation: catalogReport,
    };
    const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exacoat_system_diagnostics_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Top Banner with Overall Status & Run Button */}
      <GlassCard className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-zinc-800 bg-zinc-900/90">
        <div className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl border ${
            report?.overallStatus === 'healthy' 
              ? 'bg-[#f3aa18]/10 border-[#f3aa18]/30 text-[#f3aa18]'
              : report?.overallStatus === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-white font-sans">System Health</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
                report?.overallStatus === 'healthy' 
                  ? 'bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/30'
                  : report?.overallStatus === 'warning'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                {report?.overallStatus || 'Checking...'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Current status of connected Exacoat services
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunDiagnostics}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f3aa18] to-[#e0980e] hover:from-[#f5b838] hover:to-[#d08c09] text-zinc-950 font-bold font-mono text-xs shadow-lg shadow-[#f3aa18]/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Checking' : 'Check Again'}</span>
          </button>

          <button
            onClick={handleExportReport}
            className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </GlassCard>

      {/* 2. WordPress Master Plugin & Website Bridge Status */}
      <GlassCard className="p-6 space-y-4 border-zinc-800 bg-zinc-900/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-sans">Website Connection</h3>
              <p className="text-xs text-zinc-400">Exacoat CMS and Core connection status</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePingWordPress}
              disabled={isPingingWp}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Radio className={`w-3 h-3 text-[#f3aa18] ${isPingingWp ? 'animate-ping' : ''}`} />
              <span>{isPingingWp ? 'Pinging...' : 'Ping Plugin'}</span>
            </button>

            <a
              href={`${getWpBaseUrl()}/wp-admin`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center gap-1.5 transition-all"
            >
              <span>WP Admin</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          </div>
        </div>

        {wpHealth && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 block">Plugin Version</span>
              <span className="text-sm font-bold font-mono text-[#f3aa18]">
                {wpHealth.plugin_version ? `v${wpHealth.plugin_version}` : 'Not Activated'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 block">Action Scheduler Queue</span>
              <span className="text-sm font-bold font-mono text-white">
                {wpHealth.pending_sync_jobs !== undefined && wpHealth.pending_sync_jobs > 0
                  ? `Active (${wpHealth.pending_sync_jobs} pending jobs)`
                  : 'Idle / Ready'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 block">WP & WC Version</span>
              <span className="text-sm font-bold font-mono text-white">
                WP {wpHealth.wp_version || '6.x'} / WC {wpHealth.wc_version || '8.x'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 block">Master Vault Storage</span>
              <span className="text-sm font-bold font-mono text-emerald-400">
                /arts-master/ Writable
              </span>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-6 space-y-4 border-zinc-800 bg-zinc-900/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/25 text-[#f3aa18]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Catalog Reconciliation</h3>
              <p className="text-xs text-zinc-400">Read-only integrity check of WooCommerce product catalog and media records</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCatalogReconciliation(1)}
            isLoading={isReconciling}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Run Catalog Scan
          </Button>
        </div>

        {catalogReport?.success && catalogReport.scope && (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-zinc-400">
              <span>Scanned {(catalogReport.scope as any).scanned} of {(catalogReport.scope as any).total} rows</span>
              <span>Page {(catalogReport.scope as any).page}</span>
              <span>{(catalogReport.scope as any).complete ? 'Catalog scope complete' : 'Partial bounded scan'}</span>
              <span>Examples capped at {(catalogReport.scope as any).example_limit}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isReconciling || (catalogReport.scope as any).page <= 1}
                onClick={() => handleCatalogReconciliation((catalogReport.scope as any).page - 1)}
              >
                Previous Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isReconciling || (catalogReport.scope as any).complete}
                onClick={() => handleCatalogReconciliation((catalogReport.scope as any).page + 1)}
              >
                Next Page
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Object.entries(catalogReport.issues || {}).map(([key, issueRaw]) => {
                const issue = issueRaw as any;
                return (
                  <div key={key} className={`p-4 rounded-xl border ${issue.count ? 'bg-amber-500/[0.06] border-amber-500/25' : 'bg-zinc-950 border-zinc-800'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-zinc-100">{issue.label}</span>
                      <span className={`text-sm font-bold font-mono ${issue.count ? 'text-amber-400' : 'text-[#f3aa18]'}`}>{issue.count}</span>
                    </div>
                    {issue.count > 0 && (
                      <div className="mt-2 space-y-1 text-[10px] font-mono text-zinc-400 break-all">
                        {issue.wp_ids && issue.wp_ids.length > 0 && <p>WP: {issue.wp_ids.map((id: any) => `#${id}`).join(', ')}</p>}
                        {issue.artwork_ids && issue.artwork_ids.length > 0 && <p>Rows: {issue.artwork_ids.join(', ')}</p>}
                        {issue.examples && issue.examples.some((example: any) => Array.isArray(example.fields)) && (
                          <p>Fields: {Array.from(new Set(issue.examples.flatMap((example: any) => Array.isArray(example.fields) ? example.fields as string[] : []))).join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {catalogReport.notes?.map(note => <p key={note} className="text-[10px] font-mono text-zinc-500">{note}</p>)}
          </>
        )}

        {catalogReport && !catalogReport.success && (
          <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] text-xs text-rose-300">
            {catalogReport.message}
          </div>
        )}
      </GlassCard>

      {/* 3. Database Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {report?.healthChecks.map((hc, idx) => (
          <GlassCard key={idx} className="p-4 space-y-2 border-zinc-800 bg-zinc-900/90">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#f3aa18]" />
                <span className="text-xs font-bold text-white font-mono truncate">{hc.service}</span>
              </div>

              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
                hc.status === 'healthy'
                  ? 'bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/30'
                  : hc.status === 'warning'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                {hc.status}
              </span>
            </div>

            <p className="text-xs text-zinc-300 font-mono">{hc.message}</p>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/80">
              <span>Ping: {hc.latencyMs}ms</span>
              <span>{formatDateTime(hc.lastChecked)}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* 4. Automated Anomalies Scanner Section */}
      <GlassCard className="p-6 space-y-4 border-zinc-800 bg-zinc-900/90">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white font-sans">Automated Anomaly Detector</h3>
              <p className="text-xs text-zinc-400 font-mono">
                Continuous integrity scan for orphan commissions, missing payout accounts, or stale clearance
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold text-zinc-400">
            {report?.anomalies.length || 0} Issues Detected
          </span>
        </div>

        {report?.anomalies && report.anomalies.length > 0 ? (
          <div className="space-y-3">
            {report.anomalies.map(anomaly => (
              <div
                key={anomaly.id}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-sans flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {anomaly.title}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {anomaly.severity} Priority
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed font-sans">{anomaly.description}</p>

                {anomaly.suggestedAction && (
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-[#f3aa18] flex items-center gap-2">
                    <span>💡 Action:</span>
                    <span>{anomaly.suggestedAction}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#f3aa18] mx-auto" />
            <h4 className="text-sm font-bold text-white font-sans">Zero Anomalies Detected</h4>
            <p className="text-xs text-zinc-400 font-mono">
              All store integrations, sync services, and database relationships are intact.
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
