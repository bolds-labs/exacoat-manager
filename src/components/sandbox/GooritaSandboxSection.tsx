import React, { useState, useEffect } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { useToast } from '../../context/ToastContext';
import {
  calculateGooritaShipmentWeight,
  calculateGooritaDimensions,
  lookupGooritaZipcode,
  checkGooritaRates,
  createGooritaSandboxOrder,
  trackGooritaOrder,
  fetchGooritaTransactions,
  downloadGooritaAwbPdf,
  simulateGooritaWebhook,
  buildSampleGooritaWebhookPayload,
  GOORITA_CONFIG,
  GOORITA_US_STATES,
  GooritaPackageRate,
  GooritaTrackingEvent,
} from '../../lib/gooritaService';
import {
  Truck,
  Package,
  Calculator,
  FileText,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Printer,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Clock,
  Layers,
  ArrowRight,
  Webhook,
  Copy,
} from 'lucide-react';
import { clsx } from 'clsx';

export const GooritaSandboxSection: React.FC = () => {
  const { showToast } = useToast();

  // Preset quick zip codes
  const QUICK_ZIPS = [
    { zip: '90210', city: 'Beverly Hills', state: 'CA' },
    { zip: '10001', city: 'New York', state: 'NY' },
    { zip: '75001', city: 'Dallas', state: 'TX' },
    { zip: '98101', city: 'Seattle', state: 'WA' },
    { zip: '33101', city: 'Miami', state: 'FL' },
  ];

  // 1. Parcel Config State
  const [skinCount, setSkinCount] = useState<number>(2);
  const [laptopSkinCount, setLaptopSkinCount] = useState<number>(0);
  const [declaredValueUsd, setDeclaredValueUsd] = useState<number>(30);

  // 2. Destination State
  const [zipcode, setZipcode] = useState<string>('90210');
  const [selectedStateCode, setSelectedStateCode] = useState<string>('CA');
  const [cityName, setCityName] = useState<string>('Beverly Hills');
  const [isLookingUpZip, setIsLookingUpZip] = useState<boolean>(false);

  // 3. Rate Check State
  const [isCheckingRates, setIsCheckingRates] = useState<boolean>(false);
  const [availablePackages, setAvailablePackages] = useState<GooritaPackageRate[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');

  // 4. Order Creation State
  const [customerName, setCustomerName] = useState<string>('Alex Johnson');
  const [customerEmail, setCustomerEmail] = useState<string>('alex.johnson@example.com');
  const [customerPhone, setCustomerPhone] = useState<string>('+1 415 555 0192');
  const [addressLine1, setAddressLine1] = useState<string>('9641 Sunset Blvd');
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [createdOrderResult, setCreatedOrderResult] = useState<any>(null);

  // 5. Tracking State
  const [trackOrderId, setTrackOrderId] = useState<string>('');
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [trackingEvents, setTrackingEvents] = useState<GooritaTrackingEvent[]>([]);
  const [trackingMessage, setTrackingMessage] = useState<string>('');

  // 6. Recent Dev Transactions
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState<boolean>(false);

  // 7. Webhook Simulation State
  const [webhookTargetUrl, setWebhookTargetUrl] = useState<string>(
    'https://exacoat.com/wp-json/exacoat-core/v1/shipping/goorita-webhook'
  );
  const [webhookSimStatus, setWebhookSimStatus] = useState<string>('In Transit');
  const [webhookLocation, setWebhookLocation] = useState<string>('Jakarta Delivery Hub');
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState<boolean>(false);
  const [webhookSimResult, setWebhookSimResult] = useState<any>(null);

  // Computations
  const computedWeightKg = calculateGooritaShipmentWeight(skinCount, laptopSkinCount);
  const computedDims = calculateGooritaDimensions(skinCount, laptopSkinCount);

  // Handle Zipcode Resolution
  const handleZipcodeChange = async (newZip: string) => {
    setZipcode(newZip);
    if (newZip.trim().length === 5) {
      setIsLookingUpZip(true);
      try {
        const res = await lookupGooritaZipcode(newZip);
        if (res.success && res.stateCode) {
          setSelectedStateCode(res.stateCode);
          if (res.city) setCityName(res.city);
          showToast('success', 'Zipcode Verified', `${res.city || 'Found'}, ${res.stateCode}`);
        }
      } catch (e: any) {
        // Fallback without breaking
      } finally {
        setIsLookingUpZip(false);
      }
    }
  };

  // Run Rate Check
  const handleCheckRates = async () => {
    if (!zipcode.trim()) {
      showToast('error', 'Zipcode Required', 'Please provide a 5-digit US postal code.');
      return;
    }

    setIsCheckingRates(true);
    setAvailablePackages([]);
    setSelectedPackageId('');

    try {
      const stateObj = GOORITA_US_STATES[selectedStateCode] || GOORITA_US_STATES.CA;
      const res = await checkGooritaRates({
        postalCode: zipcode.trim(),
        stateId: stateObj.id,
        skinCount,
        laptopSkinCount,
        declaredValueUsd,
      });

      if (res.success && res.packages.length > 0) {
        setAvailablePackages(res.packages);
        setSelectedPackageId(res.packages[0].id);
        showToast('success', 'Goorita Rates Loaded', `${res.packages.length} services available for ${computedWeightKg}kg`);
      } else {
        showToast('error', 'Rate Calculation Failed', res.message || 'No available packages');
      }
    } catch (err: any) {
      showToast('error', 'API Network Error', err.message);
    } finally {
      setIsCheckingRates(false);
    }
  };

  // Create Test Order
  const handleCreateOrder = async () => {
    if (!selectedPackageId) {
      showToast('error', 'Package Required', 'Please run check rate and select a service package first.');
      return;
    }

    setIsCreatingOrder(true);
    setCreatedOrderResult(null);

    try {
      const stateObj = GOORITA_US_STATES[selectedStateCode] || GOORITA_US_STATES.CA;
      const res = await createGooritaSandboxOrder({
        packageId: selectedPackageId,
        customerName,
        customerEmail,
        customerPhone,
        addressLine1,
        city: cityName || 'Beverly Hills',
        stateId: stateObj.id,
        postalCode: zipcode.trim(),
        skinCount,
        laptopSkinCount,
        declaredValueUsd,
      });

      if (res.success) {
        setCreatedOrderResult(res);
        setTrackOrderId(res.orderId || '');
        showToast('success', 'Test AWB Booked!', `Order Code #${res.orderId}`);
        loadTransactions();
      } else {
        showToast('error', 'Order Booking Error', res.message || 'Failed to create AWB');
      }
    } catch (err: any) {
      showToast('error', 'Submission Failed', err.message);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Track Order
  const handleTrack = async (orderIdToTrack?: string) => {
    const id = (orderIdToTrack || trackOrderId).trim();
    if (!id) {
      showToast('error', 'Order Code Required', 'Please input a Goorita Order Code (e.g. 6343534900).');
      return;
    }

    setIsTracking(true);
    setTrackingEvents([]);
    setTrackingMessage('');

    try {
      const res = await trackGooritaOrder(id);
      if (res.success) {
        setTrackingEvents(res.events);
        setTrackingMessage(res.events.length === 0 ? 'Order registered. No transit scans recorded yet in sandbox.' : '');
        showToast('info', 'Tracking Synchronized', `Loaded ${res.events.length} transit events`);
      } else {
        setTrackingMessage(res.message || 'Order not found');
        showToast('error', 'Tracking Query Failed', res.message);
      }
    } catch (err: any) {
      showToast('error', 'Tracking Network Error', err.message);
    } finally {
      setIsTracking(false);
    }
  };

  // Load Past Transactions
  const loadTransactions = async () => {
    setIsLoadingTx(true);
    try {
      const res = await fetchGooritaTransactions();
      if (res.success) {
        setTransactions(res.orders);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingTx(false);
    }
  };

  // Dispatch Simulated Webhook
  const handleSimulateWebhook = async () => {
    const orderIdToSimulate = trackOrderId || (transactions[0]?.order_id) || '6343534900';
    setIsSimulatingWebhook(true);
    setWebhookSimResult(null);

    const payload = buildSampleGooritaWebhookPayload(
      orderIdToSimulate,
      webhookSimStatus,
      webhookLocation,
      `Status updated: ${webhookSimStatus}`
    );

    try {
      const res = await simulateGooritaWebhook(webhookTargetUrl, payload);
      setWebhookSimResult(res);
      if (res.success) {
        showToast('success', 'Webhook Received (200 OK)', `Goorita webhook handled successfully`);
      } else {
        showToast('error', `Webhook Failed (HTTP ${res.status})`, typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
      }
    } catch (err: any) {
      showToast('error', 'Webhook Dispatch Error', err.message);
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Header Information Banner */}
      <GlassCard className="p-5 md:p-6 border-l-4 border-l-amber-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Truck className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Goorita USA Shipping Engine (Development Sandbox)
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Live Dev Connected
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              Live testing sandbox for rates, AWB generation, and tracking. Runs isolated from live customer checkout.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/10 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-zinc-500 dark:text-zinc-400">Origin:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Bekasi Barat ({GOORITA_CONFIG.ORIGIN_POSTAL_CODE})</span>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rate Calculator & Config (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <GlassCard className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                  1. Parcel & Weight Specification
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                US Direct Saver
              </span>
            </div>

            {/* Weight Rules Visual Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone Skins */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-500" />
                    Phone Skins
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">50g / item</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSkinCount(Math.max(0, skinCount - 1))}
                    className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 font-bold text-sm text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-mono font-bold text-base text-zinc-900 dark:text-white">
                    {skinCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSkinCount(skinCount + 1)}
                    className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 font-bold text-sm text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition"
                  >
                    +
                  </button>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 ml-auto">
                    = {skinCount * 50}g
                  </span>
                </div>
              </div>

              {/* Laptop Skins */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-500" />
                    Laptop Skins
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">200g 1st, +100g/extra</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLaptopSkinCount(Math.max(0, laptopSkinCount - 1))}
                    className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 font-bold text-sm text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-mono font-bold text-base text-zinc-900 dark:text-white">
                    {laptopSkinCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLaptopSkinCount(laptopSkinCount + 1)}
                    className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 font-bold text-sm text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition"
                  >
                    +
                  </button>
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 ml-auto">
                    = {laptopSkinCount > 0 ? 200 + (laptopSkinCount - 1) * 100 : 0}g
                  </span>
                </div>
              </div>
            </div>

            {/* Computed Summary Bar */}
            <div className="p-3.5 rounded-xl bg-zinc-900 text-white font-mono text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Total Weight:</span>
                <span className="font-bold text-amber-400 text-sm">{computedWeightKg} kg</span>
                <span className="text-zinc-500">({Math.round(computedWeightKg * 1000)} grams)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Dimensions:</span>
                <span className="font-bold text-zinc-200">
                  {computedDims.length} × {computedDims.width} × {computedDims.height} cm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Declared Value:</span>
                <input
                  type="number"
                  value={declaredValueUsd}
                  onChange={(e) => setDeclaredValueUsd(Number(e.target.value) || 25)}
                  className="w-16 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-right text-xs font-bold text-white focus:outline-none"
                />
                <span className="text-zinc-400">USD</span>
              </div>
            </div>

            {/* Destination US Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 font-mono flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  US Destination Zipcode:
                </label>
                <div className="flex items-center gap-1.5">
                  {QUICK_ZIPS.map((q) => (
                    <button
                      key={q.zip}
                      type="button"
                      onClick={() => {
                        handleZipcodeChange(q.zip);
                        setCityName(q.city);
                      }}
                      className={clsx(
                        'px-2 py-0.5 rounded text-[10px] font-mono border transition',
                        zipcode === q.zip
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                          : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300'
                      )}
                    >
                      {q.state} ({q.zip})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                <div className="relative">
                  <input
                    type="text"
                    maxLength={5}
                    value={zipcode}
                    onChange={(e) => handleZipcodeChange(e.target.value)}
                    placeholder="e.g. 90210"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                  {isLookingUpZip && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-3 text-amber-500" />
                  )}
                </div>

                <div className="md:col-span-2 flex items-center gap-2">
                  <select
                    value={selectedStateCode}
                    onChange={(e) => setSelectedStateCode(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    {Object.entries(GOORITA_US_STATES).map(([code, s]) => (
                      <option key={code} value={code} className="bg-zinc-900 text-white">
                        {s.name} ({code})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleCheckRates}
                    disabled={isCheckingRates}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    {isCheckingRates ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Calculator className="w-3.5 h-3.5" />
                    )}
                    <span>Check Rates</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Rate Results Cards */}
            {availablePackages.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 font-mono">
                  Available Goorita Services ({availablePackages.length}):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availablePackages.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={clsx(
                          'p-4 rounded-xl border transition-all cursor-pointer relative',
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 shadow-sm'
                            : 'bg-zinc-50 dark:bg-white/[0.02] border-zinc-200 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/20'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
                            {pkg.name}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            {pkg.delivery_time?.format || '3-7 Days'}
                          </span>
                        </div>

                        <div className="space-y-1 font-mono text-xs">
                          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                            <span>Basic Rate:</span>
                            <span>{pkg.basic_rate?.format || `IDR ${pkg.basic_rate?.raw?.toLocaleString()}`}</span>
                          </div>
                          {pkg.surcharges?.map((sc, idx) => (
                            <div key={idx} className="flex items-center justify-between text-zinc-400 text-[11px]">
                              <span>+ {sc.description || 'Surcharge'}:</span>
                              <span>IDR {Number(sc.amount).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="border-t border-zinc-200 dark:border-white/10 pt-1.5 flex items-center justify-between text-zinc-900 dark:text-white font-bold text-sm">
                            <span>Total Rate:</span>
                            <span className="text-amber-500">
                              {pkg.price?.format || `IDR ${pkg.price?.raw?.toLocaleString()}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Test Order & AWB Creator Section */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                  2. Sandbox AWB Generation
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                Safe Testing • Dev Environment
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500">Recipient Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500">Recipient Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500">Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500">Street Address</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-500">
                Selected Service: {availablePackages.find((p) => p.id === selectedPackageId)?.name || 'None Selected'}
              </span>

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isCreatingOrder || !selectedPackageId}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
              >
                {isCreatingOrder ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>Generate Test AWB</span>
              </button>
            </div>

            {/* Created Order Confirmation */}
            {createdOrderResult && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-mono text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-emerald-500 text-sm">
                      AWB Created Successfully!
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                    #{createdOrderResult.orderId}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-zinc-300">
                  <div>
                    <span className="text-zinc-500 block">Service:</span>
                    <span className="font-bold">{createdOrderResult.service}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Status:</span>
                    <span className="font-bold">{createdOrderResult.status}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Reference:</span>
                    <span className="font-bold">{createdOrderResult.trackingNumber}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Weight:</span>
                    <span className="font-bold">{computedWeightKg} kg</span>
                  </div>
                </div>

                {createdOrderResult.awbUrl && (
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadGooritaAwbPdf(createdOrderResult.awbUrl)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / Download Thermal AWB PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTrack(createdOrderResult.orderId)}
                      className="px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-200 font-bold text-xs flex items-center gap-1.5 hover:bg-zinc-700 transition"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Track Order #{createdOrderResult.orderId}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Column: Tracking & Past Transactions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tracking Inspector */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                  3. Live Tracking Probe
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-500">Status Check</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={trackOrderId}
                  onChange={(e) => setTrackOrderId(e.target.value)}
                  placeholder="Enter Goorita Order Code"
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => handleTrack()}
                  disabled={isTracking}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isTracking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Query</span>
                </button>
              </div>

              {trackingMessage && (
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 text-zinc-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>{trackingMessage}</span>
                </div>
              )}

              {trackingEvents.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-zinc-300">Transit Milestones:</div>
                  <div className="space-y-2 relative border-l border-zinc-700 pl-4 ml-2">
                    {trackingEvents.map((evt, i) => (
                      <div key={i} className="relative space-y-0.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500 absolute -left-[21px] top-1" />
                        <div className="font-bold text-zinc-200">{evt.status}</div>
                        <div className="text-[11px] text-zinc-400">{evt.location} • {evt.datetime}</div>
                        {evt.remarks && <div className="text-[10px] text-zinc-500">{evt.remarks}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Past Transactions Ledger */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                  Sandbox Order History
                </h3>
              </div>
              <button
                type="button"
                onClick={loadTransactions}
                disabled={isLoadingTx}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                <RefreshCw className={clsx('w-3 h-3', isLoadingTx && 'animate-spin')} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {transactions.length === 0 ? (
                <div className="text-center py-6 text-zinc-500">
                  {isLoadingTx ? 'Loading transactions...' : 'No sandbox orders recorded yet.'}
                </div>
              ) : (
                transactions.map((tx: any, idx: number) => {
                  const firstItem = tx.items?.[0];
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <span>#{tx.order_id}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {tx.created_at} • {tx.total_weight || 0.1} kg
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {firstItem?.awb_url && (
                          <button
                            type="button"
                            onClick={() => downloadGooritaAwbPdf(firstItem.awb_url)}
                            title="Print AWB"
                            className="p-1.5 rounded-lg bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-800 dark:text-zinc-200 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setTrackOrderId(tx.order_id);
                            handleTrack(tx.order_id);
                          }}
                          title="Track this order"
                          className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 transition"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>

          {/* 4. Webhook Receiver & Simulator */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] pb-4">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider font-mono">
                  4. Webhook Receiver & Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                tracking.updated
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500 block text-[11px]">
                  Configured Receiver Endpoint URL:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={webhookTargetUrl}
                    onChange={(e) => setWebhookTargetUrl(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 text-[11px] text-zinc-900 dark:text-zinc-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookTargetUrl);
                      showToast('info', 'Copied URL', 'Paste into Goorita /panel/my-token');
                    }}
                    title="Copy URL"
                    className="p-1.5 rounded-lg bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-300 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400 block pt-0.5">
                  Set this URL in Goorita portal: <code className="text-zinc-300">/panel/my-token → Set Webhook</code>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="text-zinc-500 text-[11px]">Event Status</label>
                  <select
                    value={webhookSimStatus}
                    onChange={(e) => setWebhookSimStatus(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="In Transit" className="bg-zinc-900">In Transit</option>
                    <option value="Arrived at Hub" className="bg-zinc-900">Arrived at Hub</option>
                    <option value="Customs Cleared" className="bg-zinc-900">Customs Cleared</option>
                    <option value="Out for delivery" className="bg-zinc-900">Out for delivery</option>
                    <option value="Delivered" className="bg-zinc-900">Delivered</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-500 text-[11px]">Hub Location</label>
                  <input
                    type="text"
                    value={webhookLocation}
                    onChange={(e) => setWebhookLocation(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-300 dark:border-white/10 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSimulateWebhook}
                disabled={isSimulatingWebhook}
                className="w-full py-2 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                {isSimulatingWebhook ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Webhook className="w-3.5 h-3.5" />
                )}
                <span>Simulate Webhook Dispatch</span>
              </button>

              {webhookSimResult && (
                <div className="mt-2 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Response Code:</span>
                    <span className={clsx('font-bold', webhookSimResult.success ? 'text-emerald-400' : 'text-rose-400')}>
                      HTTP {webhookSimResult.status}
                    </span>
                  </div>
                  <pre className="text-[10px] text-zinc-300 overflow-x-auto no-scrollbar max-h-24">
                    {JSON.stringify(webhookSimResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
