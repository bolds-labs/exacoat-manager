import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchExportStatus,
  generateJneExportDirect,
  generateGooritaExportDirect,
  loadJneEmailConfig,
  buildJneMailtoUrl,
  DEFAULT_JNE_EMAIL_CONFIG,
  JneEmailConfig,
  ExportStatus
} from '../../lib/exportManager';
import { 
  FileSpreadsheet, 
  Download, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Truck, 
  Plane,
  FolderOpen
} from 'lucide-react';
import { clsx } from 'clsx';

interface ExportShipmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportSuccess?: () => void;
}

export const ExportShipmentsModal: React.FC<ExportShipmentsModalProps> = ({
  isOpen,
  onClose,
  onExportSuccess,
}) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'jne' | 'goorita'>('jne');
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // JNE State
  const [isGeneratingJne, setIsGeneratingJne] = useState(false);
  const [jneResult, setJneResult] = useState<{ xlsxUrl: string; csvUrl: string; count: number } | null>(null);

  // Goorita State
  const [isGeneratingGoorita, setIsGeneratingGoorita] = useState(false);
  const [gooritaResult, setGooritaResult] = useState<{ fileUrl: string; count: number } | null>(null);

  const [emailConfig, setEmailConfig] = useState<JneEmailConfig>(DEFAULT_JNE_EMAIL_CONFIG);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetchExportStatus();
      if (res.success && res.status) {
        setStatus(res.status);
      }
    } catch {
      // Non-critical status load error
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadJneEmailConfig().then(setEmailConfig);
    }
  }, [isOpen]);

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
        if (onExportSuccess) onExportSuccess();
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
        showToast('success', 'Goorita Export Ready', `${res.count || 0} orders exported to XLSX.`);
        loadStatus();
        if (onExportSuccess) onExportSuccess();
      } else {
        showToast('error', 'Export Failed', res.error || 'Could not generate Goorita export.');
      }
    } catch (err: any) {
      showToast('error', 'Export Error', err?.message || 'Failed to trigger Goorita export.');
    } finally {
      setIsGeneratingGoorita(false);
    }
  };

  const jneMailto = buildJneMailtoUrl(emailConfig);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Logistics Shipment Exports</h2>
            <p className="text-xs text-zinc-400 font-mono">Master Data generator for JNE and Goorita</p>
          </div>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-6 pt-2 font-sans">
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/[0.08] gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('jne')}
            className={clsx(
              "flex items-center gap-2 pb-3 px-3 text-xs font-bold font-mono transition-all border-b-2 cursor-pointer",
              activeTab === 'jne'
                ? "text-amber-400 border-amber-400"
                : "text-zinc-400 border-transparent hover:text-white"
            )}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>JNE Express (.xlsx & .csv)</span>
            {status?.jne && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {status.jne.pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goorita')}
            className={clsx(
              "flex items-center gap-2 pb-3 px-3 text-xs font-bold font-mono transition-all border-b-2 cursor-pointer",
              activeTab === 'goorita'
                ? "text-sky-400 border-sky-400"
                : "text-zinc-400 border-transparent hover:text-white"
            )}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Goorita US Bulk (.xlsx)</span>
            {status?.goorita && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {status.goorita.pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: JNE Express */}
        {activeTab === 'jne' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/[0.08] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">JNE Master Data & Data Loader</h3>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Filters orders in status <code>Waiting for Courier Pickup</code> with carrier <code>JNE</code>.
                  </p>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <span className="text-[10px] uppercase text-zinc-400 block">Orders Ready</span>
                  <span className="text-lg font-bold text-amber-400">
                    {isLoadingStatus ? '...' : (status?.jne?.pendingCount ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Success Download & Workflow Actions */}
            {jneResult && (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Files Generated for {jneResult.count} Orders</span>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <a
                    href={jneResult.xlsxUrl}
                    download
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download XLSX
                  </a>
                  <a
                    href={jneResult.csvUrl}
                    download
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </a>
                  <a
                    href={jneMailto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[#f3aa18] hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ml-auto"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Kirim Email ke JNE
                  </a>
                </div>

                <div className="pt-2 text-[11px] text-zinc-400 font-mono flex items-start gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    Simpan di laptop: <code>\Exacoat CS\Resi (JNE SICEPAT)\JNE Ruby E-Connote (untuk email)</code>
                  </span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-400 font-mono">
                {status?.jne?.lastGenerated ? `Last generated: ${status.jne.lastGenerated}` : 'Ready to export'}
              </span>

              <button
                type="button"
                onClick={handleGenerateJne}
                disabled={isGeneratingJne}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingJne ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating XLSX & CSV...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Generate JNE Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Goorita US Bulk */}
        {activeTab === 'goorita' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/[0.08] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Goorita US Bulk Shipment</h3>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Builds sequential item columns with normalized state and weights for US export shipments.
                  </p>
                </div>
                <div className="text-right shrink-0 font-mono">
                  <span className="text-[10px] uppercase text-zinc-400 block">Orders Ready</span>
                  <span className="text-lg font-bold text-sky-400">
                    {isLoadingStatus ? '...' : (status?.goorita?.pendingCount ?? 0)}
                  </span>
                </div>
              </div>

            </div>

            {/* Success Download & Workflow Actions */}
            {gooritaResult && (
              <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/30 space-y-3">
                <div className="flex items-center gap-2.5 text-sky-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Goorita Bulk File Ready for {gooritaResult.count} Orders</span>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <a
                    href={gooritaResult.fileUrl}
                    download
                    className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download XLSX
                  </a>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-400 font-mono">
                {status?.goorita?.lastGenerated ? `Last generated: ${status.goorita.lastGenerated}` : 'Ready to export'}
              </span>

              <button
                type="button"
                onClick={handleGenerateGoorita}
                disabled={isGeneratingGoorita}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingGoorita ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating XLSX...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Generate Goorita Export</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
