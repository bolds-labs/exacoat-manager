import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import {
  fetchCurrencySettingsDirect,
  saveCurrencySettingsDirect,
  calculateSimulatedPrice,
  CurrencyRateConfig,
  CurrencySettings,
} from '../../lib/wordpressBridge';
import {
  Coins,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  TrendingUp,
  Calculator,
  Check,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

const DEFAULT_CURRENCIES: Record<string, CurrencyRateConfig> = {
  USD: { symbol: '$', rate: 0.000059, rounding: '9_end' },
  EUR: { symbol: '€', rate: 0.000051, rounding: '9_end' },
  AUD: { symbol: 'A$', rate: 0.000089, rounding: '9_end' },
  SGD: { symbol: 'S$', rate: 0.000076, rounding: '9_end' },
  JPY: { symbol: '¥', rate: 0.00935, rounding: '50_step' },
  GBP: { symbol: '£', rate: 0.000044, rounding: '9_end' },
  CAD: { symbol: 'CA$', rate: 0.000082, rounding: '9_end' },
  CHF: { symbol: 'CHF', rate: 0.000047, rounding: '9_end' },
  HKD: { symbol: 'HK$', rate: 0.000462, rounding: '9_end' },
  THB: { symbol: '฿', rate: 0.001866, rounding: '90_end' },
  KRW: { symbol: '₩', rate: 0.0864, rounding: '500_step' },
};

const ROUNDING_OPTIONS: { id: CurrencyRateConfig['rounding']; label: string; example: string }[] = [
  { id: '9_end', label: 'End in 9', example: '$89, $29' },
  { id: '90_end', label: 'End in 90', example: '2,790฿' },
  { id: '50_step', label: 'Step 50', example: '¥13,900' },
  { id: '500_step', label: 'Step 500', example: '₩128,500' },
  { id: 'none', label: 'Raw Math (2 Decimals)', example: '$28.45' },
];

export const CurrencySettingsSection: React.FC = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [rates, setRates] = useState<Record<string, CurrencyRateConfig>>(DEFAULT_CURRENCIES);
  const [markup, setMarkup] = useState<number>(1.15);

  // Live Simulator state
  const [simPrice, setSimPrice] = useState<number>(450000);

  // Add new currency modal / inline form state
  const [newCode, setNewCode] = useState('');
  const [newSymbol, setNewSymbol] = useState('$');
  const [newRate, setNewRate] = useState('0.00006');
  const [newRounding, setNewRounding] = useState<CurrencyRateConfig['rounding']>('9_end');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);

  const loadCurrencySettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetchCurrencySettingsDirect();
      if (res.success) {
        if (res.currency_rates && Object.keys(res.currency_rates).length > 0) {
          setRates(res.currency_rates);
        }
        if (typeof res.currency_global_markup === 'number') {
          setMarkup(res.currency_global_markup);
        }
      } else {
        showToast('error', 'Could Not Load Currency Settings', res.error || 'Check server connection');
      }
    } catch (err: any) {
      showToast('error', 'Currency Load Error', err.message || 'Failed loading rates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrencySettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveCurrencySettingsDirect({
        currency_rates: rates,
        currency_global_markup: markup,
      });
      if (res.success) {
        showToast('success', 'Currency Settings Saved', 'Exchange rates and price matrix updated.');
        if (res.currency_rates) setRates(res.currency_rates);
        if (res.currency_global_markup) setMarkup(res.currency_global_markup);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed saving currency settings');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message || 'Network error saving currencies');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setRates(DEFAULT_CURRENCIES);
    setMarkup(1.15);
    showToast('info', 'Reset to Defaults', 'Loaded standard ISO FX rates and markup buffer.');
  };

  const handleUpdateRate = (code: string, field: keyof CurrencyRateConfig, value: any) => {
    setRates(prev => {
      const curr = prev[code] || { symbol: '$', rate: 0, rounding: '9_end' };
      return {
        ...prev,
        [code]: {
          ...curr,
          [field]: field === 'rate' ? Math.max(0, parseFloat(value) || 0) : value,
        },
      };
    });
  };

  const handleDeleteCurrency = (code: string) => {
    setRates(prev => {
      const copy = { ...prev };
      delete copy[code];
      return copy;
    });
  };

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode.trim().toUpperCase();
    if (!cleanCode) {
      showToast('error', 'Missing Currency Code', 'Please enter a 3-letter currency code.');
      return;
    }
    const parsedRate = parseFloat(newRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      showToast('error', 'Invalid Rate', 'Exchange rate must be greater than 0.');
      return;
    }

    setRates(prev => ({
      ...prev,
      [cleanCode]: {
        symbol: newSymbol.trim() || '$',
        rate: parsedRate,
        rounding: newRounding,
      },
    }));

    setNewCode('');
    setNewSymbol('$');
    setNewRate('0.00006');
    setNewRounding('9_end');
    setIsAddingCurrency(false);
    showToast('success', 'Currency Added', `Added ${cleanCode} to dynamic exchange registry.`);
  };

  const simulatedResults = useMemo(() => {
    return Object.entries(rates).map(([code, config]) => {
      const calculated = calculateSimulatedPrice(simPrice, config.rate, markup, config.rounding);
      const raw = simPrice * config.rate * markup;
      return {
        code,
        symbol: config.symbol,
        rate: config.rate,
        rounding: config.rounding,
        raw,
        calculated,
      };
    });
  }, [rates, markup, simPrice]);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Multi-Currency Exchange Rates & Price Matrix
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  {Object.keys(rates).length} FX Pairs
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Real-time exchange rates against IDR base, safety markup buffer, and ISO rounding rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleResetDefaults}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset Defaults
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Currencies
            </Button>
          </div>
        </div>

        {/* Global Markup & Simulator Control Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06]">
          {/* Markup Multiplier */}
          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
              Global Markup Multiplier
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                min="1.0"
                max="2.5"
                value={markup}
                onChange={e => setMarkup(Math.max(1.0, parseFloat(e.target.value) || 1.0))}
                className="w-28 p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-sm font-mono font-semibold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
              />
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300/40 dark:border-zinc-700">
                +{Math.round((markup - 1) * 100)}% Buffer
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Safety markup buffer against payment gateway FX spreads and volatility.
            </p>
          </div>

          {/* Live Simulator Base Price */}
          <div className="lg:col-span-8 space-y-2">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
              Live Price Simulator (IDR Base)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-400">Rp</span>
                <input
                  type="number"
                  step="5000"
                  value={simPrice}
                  onChange={e => setSimPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="pl-9 pr-3 py-2.5 w-40 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-sm font-mono font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white/60 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200/80 dark:border-white/[0.06]">
                {[
                  { label: '350K', val: 350000 },
                  { label: '450K', val: 450000 },
                  { label: '750K', val: 750000 },
                  { label: '1.2M', val: 1200000 },
                ].map(preset => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setSimPrice(preset.val)}
                    className={clsx(
                      'px-2.5 py-1 text-xs font-mono rounded-lg transition-colors',
                      simPrice === preset.val
                        ? 'bg-[#f3aa18] text-black font-bold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Test how an IDR catalog price transforms into each regional currency in real time.
            </p>
          </div>
        </div>

        {/* Live Simulator Price Matrix Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Live Converted Currency Matrix
              </h4>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              Base: Rp {simPrice.toLocaleString('id-ID')} x {markup}x markup
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {simulatedResults.map(item => (
              <div
                key={item.code}
                className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-black/30 border border-zinc-200/80 dark:border-white/[0.05] hover:border-amber-500/30 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
                    {item.code}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {item.rounding}
                  </span>
                </div>

                <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
                  {item.symbol}{' '}
                  {item.rounding === 'none'
                    ? item.calculated.toFixed(2)
                    : item.calculated.toLocaleString('en-US')}
                </div>

                <div className="text-[10px] font-mono text-zinc-400 truncate">
                  1 IDR = {item.rate}
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* FX Rates Table Card */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Exchange Rates & Rounding Engines
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              Configure baseline rates vs IDR and psychological pricing termination for each currency.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingCurrency(!isAddingCurrency)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {isAddingCurrency ? 'Cancel' : 'Add Currency'}
          </Button>
        </div>

        {/* Inline Add Currency Form */}
        {isAddingCurrency && (
          <form
            onSubmit={handleAddCurrency}
            className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
              Add New Regional Currency Pair
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Code (3 Letters)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MYR"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono font-bold uppercase"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Symbol
                </label>
                <input
                  type="text"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  placeholder="e.g. RM"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Rate (vs 1 IDR)
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={newRate}
                  onChange={e => setNewRate(e.target.value)}
                  placeholder="0.00028"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Rounding Engine
                </label>
                <select
                  value={newRounding}
                  onChange={e => setNewRounding(e.target.value as CurrencyRateConfig['rounding'])}
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                >
                  {ROUNDING_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({opt.example})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingCurrency(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />}>
                Add Pair
              </Button>
            </div>
          </form>
        )}

        {/* Currency Rates Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/[0.06] text-zinc-400 text-[11px] uppercase tracking-wider font-mono">
                <th className="py-3 px-3">Currency</th>
                <th className="py-3 px-3">Symbol</th>
                <th className="py-3 px-3">Exchange Rate (vs 1 IDR)</th>
                <th className="py-3 px-3">Rounding Engine</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {Object.entries(rates).map(([code, config]) => (
                <tr key={code} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono font-bold text-zinc-900 dark:text-white">
                      {code}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={config.symbol}
                      onChange={e => handleUpdateRate(code, 'symbol', e.target.value)}
                      className="w-16 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="0.00000001"
                      value={config.rate}
                      onChange={e => handleUpdateRate(code, 'rate', e.target.value)}
                      className="w-36 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <select
                      value={config.rounding || '9_end'}
                      onChange={e => handleUpdateRate(code, 'rounding', e.target.value)}
                      className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    >
                      {ROUNDING_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.example})
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteCurrency(code)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title={`Remove ${code}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
