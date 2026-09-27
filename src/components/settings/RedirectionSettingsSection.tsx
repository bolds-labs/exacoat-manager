import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import {
  fetchRedirections,
  saveRedirections,
  RedirectionRule
} from '../../lib/wordpressBridge';
import {
  GitFork,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Edit2,
  X,
  ArrowRight,
  Zap,
  Globe
} from 'lucide-react';
import clsx from 'clsx';

const DEFAULT_SEEDS: RedirectionRule[] = [
  {
    id: 'red_cs',
    source: '/cs',
    target: 'https://api.whatsapp.com/send?phone=628975556000',
    status_code: 307,
    enabled: true,
    label: 'Customer Service WhatsApp',
    hits: 0,
  },
  {
    id: 'red_care',
    source: '/care',
    target: 'https://api.whatsapp.com/send?phone=628975556000',
    status_code: 307,
    enabled: true,
    label: 'Exacoat Care WhatsApp',
    hits: 0,
  },
  {
    id: 'red_wa',
    source: '/wa',
    target: 'https://api.whatsapp.com/send?phone=628975556000',
    status_code: 307,
    enabled: true,
    label: 'WhatsApp Direct',
    hits: 0,
  },
];

export const RedirectionSettingsSection: React.FC = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rules, setRules] = useState<RedirectionRule[]>(DEFAULT_SEEDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal / Drawer state for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formSource, setFormSource] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formStatusCode, setFormStatusCode] = useState<301 | 302 | 307 | 308>(307);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    const res = await fetchRedirections();
    setIsLoading(false);

    if (res.success && res.redirects && res.redirects.length > 0) {
      setRules(res.redirects);
    } else if (!res.success) {
      showToast('error', 'Redirections Offline', res.error || 'Failed to load redirection rules from WordPress.');
    }
  };

  const handleSaveAll = async (rulesToSave = rules) => {
    setIsSaving(true);
    const res = await saveRedirections(rulesToSave);
    setIsSaving(false);

    if (res.success) {
      if (res.redirects) setRules(res.redirects);
      showToast('success', 'Redirections Saved', 'All URL redirection rules updated in WordPress and synchronized with storefront.');
    } else {
      showToast('error', 'Save Failed', res.error || 'Could not persist redirection rules.');
    }
  };

  const handleOpenAdd = () => {
    setEditingRuleId(null);
    setFormSource('');
    setFormTarget('');
    setFormLabel('');
    setFormStatusCode(307);
    setFormEnabled(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: RedirectionRule) => {
    setEditingRuleId(rule.id);
    setFormSource(rule.source.replace(/^\//, ''));
    setFormTarget(rule.target);
    setFormLabel(rule.label || '');
    setFormStatusCode(rule.status_code || 307);
    setFormEnabled(rule.enabled);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: { source: string; target: string; label: string }) => {
    setFormSource(preset.source.replace(/^\//, ''));
    setFormTarget(preset.target);
    setFormLabel(preset.label);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanSource = ('/' + formSource.trim().replace(/^\/+/, '')).toLowerCase();
    const cleanTarget = formTarget.trim();

    if (cleanSource === '/' || !cleanSource) {
      setFormError('Source path cannot be empty or root.');
      return;
    }

    if (!cleanTarget) {
      setFormError('Target destination URL or path is required.');
      return;
    }

    // Check duplicate source
    const existingMatch = rules.find(r => r.source.toLowerCase() === cleanSource && r.id !== editingRuleId);
    if (existingMatch) {
      setFormError(`Source path "${cleanSource}" is already registered.`);
      return;
    }

    let updatedRules: RedirectionRule[];

    if (editingRuleId) {
      updatedRules = rules.map(r => {
        if (r.id === editingRuleId) {
          return {
            ...r,
            source: cleanSource,
            target: cleanTarget,
            label: formLabel.trim(),
            status_code: formStatusCode,
            enabled: formEnabled,
            updated_at: new Date().toISOString(),
          };
        }
        return r;
      });
    } else {
      const newRule: RedirectionRule = {
        id: 'red_' + Math.random().toString(36).substring(2, 9),
        source: cleanSource,
        target: cleanTarget,
        label: formLabel.trim(),
        status_code: formStatusCode,
        enabled: formEnabled,
        hits: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updatedRules = [newRule, ...rules];
    }

    setRules(updatedRules);
    setIsModalOpen(false);
    handleSaveAll(updatedRules);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    handleSaveAll(updated);
    showToast('info', 'Rule Removed', 'Redirection rule deleted.');
  };

  const handleToggleEnabled = (id: string) => {
    const updated = rules.map(r => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    setRules(updated);
    handleSaveAll(updated);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Link Copied', `${text} copied to clipboard.`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      r =>
        r.source.toLowerCase().includes(q) ||
        r.target.toLowerCase().includes(q) ||
        (r.label && r.label.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  const activeCount = useMemo(() => rules.filter(r => r.enabled).length, [rules]);
  const totalHits = useMemo(() => rules.reduce((acc, r) => acc + (r.hits || 0), 0), [rules]);

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 sm:p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] flex items-center justify-center shrink-0">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">Total Rules</div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
              {rules.length}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">Active Redirects</div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
              {activeCount}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-zinc-500">Total Routed Visits</div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
              {totalHits.toLocaleString()}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main GlassCard Container */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        {/* Header and Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#f3aa18]" />
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Storefront URL Redirections
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Source paths resolve automatically from <span className="font-mono text-zinc-900 dark:text-zinc-200">exacoat.com/&#123;xxx&#125;</span> and redirect customers directly to WhatsApp or internal landing pages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={loadRules}
              isLoading={isLoading}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSaveAll()}
              isLoading={isSaving}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save All
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Redirection
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by source path, target URL, or label..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f3aa18]"
          />
        </div>

        {/* Redirection Rules Table */}
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/[0.06]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-zinc-100 dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/[0.06] text-zinc-500 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-medium">Source Path</th>
                <th className="py-3.5 px-4 font-medium">Target Destination</th>
                <th className="py-3.5 px-3 font-medium text-center">Type</th>
                <th className="py-3.5 px-3 font-medium text-center">Clicks</th>
                <th className="py-3.5 px-3 font-medium text-center">Status</th>
                <th className="py-3.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GitFork className="w-6 h-6 text-zinc-400" />
                      <span>No redirection rules found.</span>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-xs text-[#f3aa18] hover:underline"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const fullSourceUrl = `https://exacoat.com${rule.source}`;
                  const isExternal = rule.target.startsWith('http');

                  return (
                    <tr
                      key={rule.id}
                      className={clsx(
                        'transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]',
                        !rule.enabled && 'opacity-60'
                      )}
                    >
                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-zinc-900 dark:text-[#f3aa18]">
                            exacoat.com{rule.source}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(fullSourceUrl, rule.id)}
                            title="Copy full URL"
                            className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            {copiedId === rule.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={fullSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Test redirect in new tab"
                            className="p-1 rounded text-zinc-400 hover:text-[#f3aa18] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        {rule.label && (
                          <div className="text-[11px] text-zinc-500 mt-0.5">{rule.label}</div>
                        )}
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                        <div className="flex items-center gap-1.5 truncate">
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span
                            className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate"
                            title={rule.target}
                          >
                            {rule.target}
                          </span>
                        </div>
                      </td>

                      {/* Status Code */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-mono font-medium border',
                            rule.status_code === 301
                              ? 'border-purple-500/20 bg-purple-500/10 text-purple-400'
                              : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                          )}
                        >
                          {rule.status_code} {rule.status_code === 301 ? 'Permanent' : 'Temporary'}
                        </span>
                      </td>

                      {/* Hits */}
                      <td className="py-3.5 px-3 text-center font-mono text-xs text-zinc-500">
                        {rule.hits || 0}
                      </td>

                      {/* Enabled Toggle */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(rule.id)}
                          className="inline-flex items-center transition-colors focus:outline-none"
                          title={rule.enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          {rule.enabled ? (
                            <ToggleRight className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-zinc-500" />
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rule)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                            title="Edit rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141414] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mb-1">
              {editingRuleId ? 'Edit Redirection' : 'Add New Redirection'}
            </h3>
            <p className="text-xs text-zinc-500 mb-5">
              Specify source path and the target destination.
            </p>

            {formError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div className="mb-4">
              <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1.5">
                Quick Presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      source: 'cs',
                      target: 'https://api.whatsapp.com/send?phone=628975556000',
                      label: 'Customer Service WhatsApp',
                    })
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 hover:border-[#f3aa18]/40 hover:text-[#f3aa18] transition-colors"
                >
                  WhatsApp Care (/cs)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      source: 'care',
                      target: 'https://api.whatsapp.com/send?phone=628975556000',
                      label: 'Exacoat Care WhatsApp',
                    })
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 hover:border-[#f3aa18]/40 hover:text-[#f3aa18] transition-colors"
                >
                  Exacoat Care (/care)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyPreset({
                      source: 'warranty-help',
                      target: '/warranty',
                      label: 'Warranty Claim Wizard',
                    })
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300 hover:border-[#f3aa18]/40 hover:text-[#f3aa18] transition-colors"
                >
                  Warranty (/warranty)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Source Path */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Source Path <span className="text-zinc-600">(from exacoat.com)</span>
                </label>
                <div className="flex items-center rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] overflow-hidden focus-within:ring-1 focus-within:ring-[#f3aa18]">
                  <span className="px-3 py-2 text-xs font-mono text-zinc-500 border-r border-zinc-200 dark:border-white/10 select-none">
                    exacoat.com/
                  </span>
                  <input
                    type="text"
                    required
                    value={formSource}
                    onChange={e => setFormSource(e.target.value.replace(/^\/+/, ''))}
                    placeholder="cs"
                    className="flex-1 px-3 py-2 text-xs sm:text-sm font-mono bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Target Destination */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Target Destination URL or Path
                </label>
                <input
                  type="text"
                  required
                  value={formTarget}
                  onChange={e => setFormTarget(e.target.value)}
                  placeholder="https://api.whatsapp.com/send?phone=628975556000 or /warranty"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono rounded-xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#f3aa18]"
                />
              </div>

              {/* Label / Description */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Label or Note <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  placeholder="e.g. Customer Service WhatsApp Link"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] text-zinc-900 dark:text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#f3aa18]"
                />
              </div>

              {/* Status Code & Enabled Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    HTTP Redirect Type
                  </label>
                  <select
                    value={formStatusCode}
                    onChange={e => setFormStatusCode(Number(e.target.value) as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c] text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#f3aa18]"
                  >
                    <option value={307}>307 Temporary (Recommended)</option>
                    <option value={301}>301 Permanent (SEO)</option>
                    <option value={302}>302 Found</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Initial Status
                  </label>
                  <div className="flex items-center h-[38px]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={formEnabled}
                        onChange={e => setFormEnabled(e.target.checked)}
                        className="rounded border-white/20 bg-white/5 text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      <span>Active immediately</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-white/10">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  {editingRuleId ? 'Update Rule' : 'Add Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
