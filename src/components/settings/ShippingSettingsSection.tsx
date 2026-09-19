import React, { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import {
  fetchShippingSettingsDirect,
  saveShippingSettingsDirect,
  ShippingZoneConfig,
  LogisticsCarrierConfig,
} from '../../lib/wordpressBridge';
import {
  Truck,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Globe,
  Package,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

const DEFAULT_ZONES: Record<string, ShippingZoneConfig> = {
  indonesia: { name: 'Indonesia', countries: 'ID', currency: 'IDR', free: 300000, filter_text: '' },
  united_states: { name: 'United States', countries: 'US', currency: 'USD', free: 30, filter_text: 'goorita' },
  default: { name: 'Default (Rest of World)', countries: '*', currency: 'USD', free: 50, filter_text: 'goorita' },
};

const DEFAULT_CARRIERS: Record<string, LogisticsCarrierConfig> = {
  jne: { name: 'JNE Express', url: 'https://www.jne.co.id/' },
  sicepat: { name: 'SiCepat', url: 'https://www.sicepat.com' },
  pos: { name: 'POS Indonesia', url: 'https://www.posindonesia.co.id/en/tracking/?tracknumbers=%s' },
  goorita: { name: 'Goorita', url: 'https://send.goorita.com/track' },
  dhl: { name: 'DHL Express', url: 'https://www.dhl.com/en/express/tracking.html?AWB=%s' },
  fedex: { name: 'FedEx', url: 'https://www.fedex.com/fedextrack/?trknbr=%s' },
  biteship: { name: 'Biteship / Default', url: 'https://biteship.com/track/%s' },
};

const SUPPORTED_CURRENCIES = ['IDR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'JPY', 'CHF', 'HKD', 'THB', 'KRW', 'MYR', 'NZD'];

export const ShippingSettingsSection: React.FC = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [zones, setZones] = useState<Record<string, ShippingZoneConfig>>(DEFAULT_ZONES);
  const [targetMethods, setTargetMethods] = useState('flat_rate, biteship_shipping');
  const [carriers, setCarriers] = useState<Record<string, LogisticsCarrierConfig>>(DEFAULT_CARRIERS);

  // Add Zone inline form state
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneKey, setNewZoneKey] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneCountries, setNewZoneCountries] = useState('');
  const [newZoneCurrency, setNewZoneCurrency] = useState('USD');
  const [newZoneFree, setNewZoneFree] = useState('50');
  const [newZoneFilter, setNewZoneFilter] = useState('');

  // Add Carrier inline form state
  const [isAddingCarrier, setIsAddingCarrier] = useState(false);
  const [newCarrierKey, setNewCarrierKey] = useState('');
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierUrl, setNewCarrierUrl] = useState('');

  const loadShippingSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetchShippingSettingsDirect();
      if (res.success) {
        if (res.shipping_zones && Object.keys(res.shipping_zones).length > 0) {
          setZones(res.shipping_zones);
        }
        if (res.shipping_target_method_ids) {
          setTargetMethods(res.shipping_target_method_ids);
        }
        if (res.logistics_carriers && Object.keys(res.logistics_carriers).length > 0) {
          setCarriers(res.logistics_carriers);
        }
      } else {
        showToast('error', 'Could Not Load Shipping Settings', res.error || 'Check store connection');
      }
    } catch (err: any) {
      showToast('error', 'Shipping Load Error', err.message || 'Failed loading shipping settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShippingSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveShippingSettingsDirect({
        shipping_zones: zones,
        shipping_target_method_ids: targetMethods,
        logistics_carriers: carriers,
      });
      if (res.success) {
        showToast('success', 'Shipping Settings Saved', 'Multi-zone thresholds and carrier registry updated.');
        if (res.shipping_zones) setZones(res.shipping_zones);
        if (res.shipping_target_method_ids) setTargetMethods(res.shipping_target_method_ids);
        if (res.logistics_carriers) setCarriers(res.logistics_carriers);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed saving shipping settings');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message || 'Network error saving shipping settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setZones(DEFAULT_ZONES);
    setTargetMethods('flat_rate, biteship_shipping');
    setCarriers(DEFAULT_CARRIERS);
    showToast('info', 'Reset to Defaults', 'Loaded standard multi-zone tiers and courier registry.');
  };

  const handleUpdateZone = (key: string, field: keyof ShippingZoneConfig, value: any) => {
    setZones(prev => {
      const curr = prev[key] || { name: key, countries: '', currency: 'USD', free: 0 };
      return {
        ...prev,
        [key]: {
          ...curr,
          [field]: field === 'free' ? Math.max(0, parseFloat(value) || 0) : value,
        },
      };
    });
  };

  const handleDeleteZone = (key: string) => {
    setZones(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    const rawKey = (newZoneKey || newZoneName).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!rawKey) {
      showToast('error', 'Missing Region Key', 'Please enter a region name or key.');
      return;
    }
    const freeVal = parseFloat(newZoneFree) || 0;

    setZones(prev => ({
      ...prev,
      [rawKey]: {
        name: newZoneName.trim() || rawKey,
        countries: newZoneCountries.trim().toUpperCase(),
        currency: newZoneCurrency,
        free: freeVal,
        filter_text: newZoneFilter.trim(),
      },
    }));

    setNewZoneKey('');
    setNewZoneName('');
    setNewZoneCountries('');
    setNewZoneCurrency('USD');
    setNewZoneFree('250');
    setNewZoneFilter('');
    setIsAddingZone(false);
    showToast('success', 'Region Added', `Added region ${rawKey} to shipping thresholds.`);
  };

  const handleUpdateCarrier = (key: string, field: keyof LogisticsCarrierConfig, value: string) => {
    setCarriers(prev => {
      const curr = prev[key] || { name: key, url: '' };
      return {
        ...prev,
        [key]: {
          ...curr,
          [field]: value,
        },
      };
    });
  };

  const handleDeleteCarrier = (key: string) => {
    setCarriers(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleAddCarrier = (e: React.FormEvent) => {
    e.preventDefault();
    const rawKey = (newCarrierKey || newCarrierName).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!rawKey) {
      showToast('error', 'Missing Carrier Key', 'Please enter a carrier key.');
      return;
    }

    setCarriers(prev => ({
      ...prev,
      [rawKey]: {
        name: newCarrierName.trim() || rawKey,
        url: newCarrierUrl.trim(),
      },
    }));

    setNewCarrierKey('');
    setNewCarrierName('');
    setNewCarrierUrl('');
    setIsAddingCarrier(false);
    showToast('success', 'Carrier Added', `Added courier ${rawKey} to registry.`);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-500">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Multi-Zone Free Shipping & Carrier Registry
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lime-500/15 text-lime-600 dark:text-lime-400 border border-lime-500/30">
                  {Object.keys(zones).length} Regions
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  {Object.keys(carriers).length} Couriers
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Autonomous 100% Free Shipping rules evaluated dynamically per regional currency threshold.
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
              Save Shipping
            </Button>
          </div>
        </div>

        {/* Target Method IDs */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/[0.06] space-y-2">
          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
            Target Shipping Method IDs (Comma-Separated)
          </label>
          <input
            type="text"
            value={targetMethods}
            onChange={e => setTargetMethods(e.target.value)}
            placeholder="flat_rate, biteship_shipping"
            className="w-full max-w-xl p-2.5 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-white/10 text-xs font-mono font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
          />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Eligible method IDs discounted to 0.00 when the cart subtotal meets the regional threshold.
          </p>
        </div>
      </GlassCard>

      {/* Multi-Zone Thresholds Table Card */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Regional Free Shipping Thresholds
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              Cart subtotal triggers 100% free shipping once reaching the threshold for the customer country.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingZone(!isAddingZone)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {isAddingZone ? 'Cancel' : 'Add Region'}
          </Button>
        </div>

        {/* Inline Add Zone Form */}
        {isAddingZone && (
          <form
            onSubmit={handleAddZone}
            className="p-4 rounded-2xl bg-lime-500/5 border border-lime-500/20 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-lime-600 dark:text-lime-400">
              <Sparkles className="w-4 h-4" />
              Add New Regional Shipping Zone
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Region Name
                </label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  placeholder="e.g. Middle East"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Country Codes
                </label>
                <input
                  type="text"
                  value={newZoneCountries}
                  onChange={e => setNewZoneCountries(e.target.value.toUpperCase())}
                  placeholder="e.g. AE, SA, QA or *"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Currency
                </label>
                <select
                  value={newZoneCurrency}
                  onChange={e => setNewZoneCurrency(e.target.value)}
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                >
                  {SUPPORTED_CURRENCIES.map(curr => (
                    <option key={curr} value={curr}>
                      {curr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  100% Free Threshold
                </label>
                <input
                  type="number"
                  step="any"
                  value={newZoneFree}
                  onChange={e => setNewZoneFree(e.target.value)}
                  placeholder="250"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono font-bold text-lime-600 dark:text-lime-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Filter Match (Optional)
                </label>
                <input
                  type="text"
                  value={newZoneFilter}
                  onChange={e => setNewZoneFilter(e.target.value)}
                  placeholder="e.g. goorita"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingZone(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />}>
                Add Region
              </Button>
            </div>
          </form>
        )}

        {/* Zones Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/[0.06] text-zinc-400 text-[11px] uppercase tracking-wider font-mono">
                <th className="py-3 px-3">Zone Key & Name</th>
                <th className="py-3 px-3 min-w-[200px]">Country Codes</th>
                <th className="py-3 px-3">Currency</th>
                <th className="py-3 px-3">100% Free Threshold</th>
                <th className="py-3 px-3">Filter Text</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {Object.entries(zones).map(([key, zone]) => (
                <tr key={key} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={zone.name || key}
                      onChange={e => handleUpdateZone(key, 'name', e.target.value)}
                      className="w-full min-w-[130px] p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-bold text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={zone.countries}
                      onChange={e => handleUpdateZone(key, 'countries', e.target.value.toUpperCase())}
                      placeholder="e.g. US, CA or *"
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <select
                      value={zone.currency || 'USD'}
                      onChange={e => handleUpdateZone(key, 'currency', e.target.value)}
                      className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    >
                      {SUPPORTED_CURRENCIES.map(curr => (
                        <option key={curr} value={curr}>
                          {curr}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="any"
                      value={zone.free}
                      onChange={e => handleUpdateZone(key, 'free', e.target.value)}
                      className="w-32 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono font-bold text-xs text-lime-600 dark:text-lime-400 focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={zone.filter_text || ''}
                      onChange={e => handleUpdateZone(key, 'filter_text', e.target.value)}
                      placeholder="e.g. goorita"
                      className="w-28 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteZone(key)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title={`Remove ${key}`}
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

      {/* Logistics Carriers & Tracking Registry Card */}
      <GlassCard className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Logistics Carriers & Tracking Registry
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
              Tracking link patterns embedded in customer completion emails. Use %s for the tracking code token.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingCarrier(!isAddingCarrier)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {isAddingCarrier ? 'Cancel' : 'Add Carrier'}
          </Button>
        </div>

        {/* Inline Add Carrier Form */}
        {isAddingCarrier && (
          <form
            onSubmit={handleAddCarrier}
            className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
              Add New Logistics Carrier
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Carrier Key (e.g. anteraja)
                </label>
                <input
                  type="text"
                  value={newCarrierKey}
                  onChange={e => setNewCarrierKey(e.target.value.toLowerCase())}
                  placeholder="anteraja"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  value={newCarrierName}
                  onChange={e => setNewCarrierName(e.target.value)}
                  placeholder="AnterAja"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Tracking URL Pattern (%s token)
                </label>
                <input
                  type="text"
                  value={newCarrierUrl}
                  onChange={e => setNewCarrierUrl(e.target.value)}
                  placeholder="https://anteraja.id/tracking?awb=%s"
                  className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingCarrier(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />}>
                Add Carrier
              </Button>
            </div>
          </form>
        )}

        {/* Carriers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/[0.06] text-zinc-400 text-[11px] uppercase tracking-wider font-mono">
                <th className="py-3 px-3 w-32">Carrier Key</th>
                <th className="py-3 px-3 w-48">Display Label</th>
                <th className="py-3 px-3">Tracking URL Pattern (%s)</th>
                <th className="py-3 px-3 text-right w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {Object.entries(carriers).map(([key, carrier]) => (
                <tr key={key} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      {key}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <input
                      type="text"
                      value={carrier.name || key}
                      onChange={e => handleUpdateCarrier(key, 'name', e.target.value)}
                      className="w-full p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-medium text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                    />
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={carrier.url || ''}
                        onChange={e => handleUpdateCarrier(key, 'url', e.target.value)}
                        placeholder="https://carrier.com/track/%s"
                        className="w-full p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#f3aa18]"
                      />
                      {carrier.url && (
                        <a
                          href={carrier.url.replace('%s', 'TEST12345')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-[#f3aa18] p-1"
                          title="Test Link Format"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteCarrier(key)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title={`Remove ${key}`}
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
