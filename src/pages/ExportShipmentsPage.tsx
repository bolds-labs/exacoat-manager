import React, { useState, useEffect } from 'react';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { useToast } from '../context/ToastContext';
import {
  fetchExportStatus,
  generateJneExportDirect,
  generateGooritaExportDirect,
  ExportStatus,
} from '../lib/exportManager';
import {
  FileSpreadsheet,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Truck,
  Plane,
  RefreshCw,
  FolderOpen,
  Calendar,
  Layers,
} from 'lucide-react';
import { clsx } from 'clsx';

export const ExportShipmentsPage: React.FC = () => {
  const { showToast } = useToast();

  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // JNE State
  const [isGeneratingJne, setIsGeneratingJne] = useState(false);
  const [jneResult, setJneResult] = useState<{ xlsxUrl: string; csvUrl: string; count: number } | null>(null);

  // Goorita State
  const [isGeneratingGoorita, setIsGeneratingGoorita] = useState(false);
  const [gooritaResult, setGooritaResult] = useState<{ fileUrl: string; count: number } | null>(null);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetchExportStatus();
      if (res.success && res.status) {
        setStatus(res.status);
      }
    } catch {
      showToast('warning', 'Status Sync', 'Could not refresh export counters.');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleGenerateJne = async () => {
    setIsGeneratingJne(true);
    try {
      const res = await generateJneExportDirect();

      if (res.success && res.xlsx_url && res.csv_url) {
        setJneResult({
          xlsxUrl: res.xlsx_url,
          csvUrl: res.csv_url,
          count: res.count || 0,
        });
        showToast('success', 'JNE Export Ready', `${res.count || 0} orders exported to XLSX and CSV.`);
        loadStatus();
      } else {
        showToast('error', 'Export Failed', res.error || 'Could not generate JNE export.');
      }
    } catch (err: any) {
      showToast('error', 'Export Error', err?.message || 'Failed to trigger JNE export.');
    } finally {
      setIsGeneratingJne(false);
    }
  };

  const handleGenerateGoorita = async () => {
    setIsGeneratingGoorita(true);
    try {
      const res = await generateGooritaExportDirect();
      if (res.success && res.file_url) {
        setGooritaResult({
          fileUrl: res.file_url,
          count: res.count || 0,
        });
        showToast('success', 'Goorita Export Ready', `${res.count || 0} international orders exported to XLSX.`);
        loadStatus();
      } else {
        showToast('error', 'Export Failed', res.error || 'Could not generate Goorita export.');
      }
    } catch (err: any) {
      showToast('error', 'Export Error', err?.message || 'Failed to trigger Goorita export.');
    } finally {
      setIsGeneratingGoorita(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Header */}
      <PageHeroHeader
        title="Export Shipments"
        subtitle="Generate logistics batch files for domestic JNE Express and international Goorita freight forwarding."
        actions={
          <button
            type="button"
            onClick={loadStatus}
            disabled={isLoadingStatus}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-[#141414] hover:bg-zinc-200 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingStatus && 'animate-spin text-[#f3aa18]')} />
            <span>Refresh Status</span>
          </button>
        }
      />

      {/* KPI Overview Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard className="p-4 flex flex-col justify-between min-h-[95px] border-amber-500/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase font-bold text-zinc-500 dark:text-neutral-400">
              JNE Pending
            </span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {status?.jne.pendingCount ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-neutral-400 block mt-0.5">Domestic orders awaiting dispatch</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between min-h-[95px] border-cyan-500/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase font-bold text-zinc-500 dark:text-neutral-400">
              Goorita Pending
            </span>
            <Plane className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-white">
              {status?.goorita.pendingCount ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-neutral-400 block mt-0.5">International orders ready</span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between min-h-[95px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase font-bold text-zinc-500 dark:text-neutral-400">
              JNE Last Export
            </span>
            <Calendar className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <span className="text-xs font-mono text-zinc-800 dark:text-neutral-200 truncate block">
              {status?.jne.lastGenerated || 'None yet'}
            </span>
            <span className="text-[11px] text-zinc-500 block mt-0.5">
              {status?.jne.hasFiles ? 'Files available on server' : 'No previous files'}
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex flex-col justify-between min-h-[95px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase font-bold text-zinc-500 dark:text-neutral-400">
              Goorita Last Export
            </span>
            <Calendar className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <span className="text-xs font-mono text-zinc-800 dark:text-neutral-200 truncate block">
              {status?.goorita.lastGenerated || 'None yet'}
            </span>
            <span className="text-[11px] text-zinc-500 block mt-0.5">
              {status?.goorita.hasFiles ? 'Manifest available' : 'No previous files'}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Main Export Modules (Two Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. JNE Express Domestic Export */}
        <GlassCard className="p-6 space-y-5 rounded-2xl border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111111] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">JNE Express Domestic Export</h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">Domestic orders with verified destination addresses</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                {status?.jne.pendingCount ?? 0} ready
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-neutral-900/60 border border-zinc-200 dark:border-white/[0.06] space-y-2 text-xs text-zinc-600 dark:text-neutral-300">
              <p className="font-semibold text-zinc-800 dark:text-white">Specification Details:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-500 dark:text-neutral-400">
                <li>Extracts domestic orders with status Waiting for Courier Pickup.</li>
                <li>Normalizes receiver phone numbers with Indonesian international prefix (+62).</li>
                <li>Generates dual formats: Excel (.xlsx) and comma-separated (.csv) for JNE bulk intake.</li>
              </ul>
            </div>

            {/* Previous or Generated Result */}
            {jneResult ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Batch Export Generated ({jneResult.count} orders)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={jneResult.xlsxUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download XLSX</span>
                  </a>
                  <a
                    href={jneResult.csvUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </a>
                </div>
              </div>
            ) : status?.jne.hasFiles && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-neutral-400">Previous export available</span>
                <div className="flex items-center gap-2">
                  {status.jne.xlsxUrl && (
                    <a
                      href={status.jne.xlsxUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-500 hover:underline flex items-center gap-1 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>XLSX</span>
                    </a>
                  )}
                  {status.jne.csvUrl && (
                    <a
                      href={status.jne.csvUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-500 hover:underline flex items-center gap-1 text-xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>CSV</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={handleGenerateJne}
              disabled={isGeneratingJne || (status?.jne.pendingCount ?? 0) === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <FileSpreadsheet className={clsx('w-4 h-4', isGeneratingJne && 'animate-spin')} />
              <span>{isGeneratingJne ? 'Processing JNE Export...' : 'Generate JNE Export (XLSX & CSV)'}</span>
            </button>
          </div>
        </GlassCard>

        {/* 2. Goorita International Cargo Manifest */}
        <GlassCard className="p-6 space-y-5 rounded-2xl border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111111] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                  <Plane className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Goorita International Export</h3>
                  <p className="text-xs text-zinc-500 dark:text-neutral-400">Cross-border freight manifest formatted for Goorita intake</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                {status?.goorita.pendingCount ?? 0} ready
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-neutral-900/60 border border-zinc-200 dark:border-white/[0.06] space-y-2 text-xs text-zinc-600 dark:text-neutral-300">
              <p className="font-semibold text-zinc-800 dark:text-white">Specification Details:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-500 dark:text-neutral-400">
                <li>Filters international destinations outside Indonesia.</li>
                <li>Includes commodity description, declared value, customer contact, and destination ZIP codes.</li>
                <li>Direct upload link to Goorita shipping intake portal.</li>
              </ul>
            </div>

            {/* Previous or Generated Result */}
            {gooritaResult ? (
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Goorita Manifest Ready ({gooritaResult.count} orders)</span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={gooritaResult.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Manifest (.xlsx)</span>
                  </a>
                  {status?.goorita.uploadPortal && (
                    <a
                      href={status.goorita.uploadPortal}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                    >
                      <span>Upload to Goorita</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : status?.goorita.hasFiles && (
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-neutral-400">Previous manifest available</span>
                {status.goorita.xlsxUrl && (
                  <a
                    href={status.goorita.xlsxUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1 text-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download XLSX</span>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-white/[0.06] flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateGoorita}
              disabled={isGeneratingGoorita || (status?.goorita.pendingCount ?? 0) === 0}
              className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <FileSpreadsheet className={clsx('w-4 h-4', isGeneratingGoorita && 'animate-spin')} />
              <span>{isGeneratingGoorita ? 'Processing Manifest...' : 'Generate Goorita Manifest'}</span>
            </button>
            {status?.goorita.uploadPortal && (
              <a
                href={status.goorita.uploadPortal}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl border border-zinc-300 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-neutral-300 transition-colors"
                title="Open Goorita client portal"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
