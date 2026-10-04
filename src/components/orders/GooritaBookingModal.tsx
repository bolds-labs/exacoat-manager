import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Order } from '../../types';
import { 
  Plane, 
  Loader2, 
  AlertCircle, 
  Check, 
  Package, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  RefreshCw 
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../../context/ToastContext';
import { getGooritaOrderRatesDirect, createGooritaAwbDirect } from '../../lib/wordpressBridge';

interface GooritaBookingModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: {
    order_id?: string;
    tracking_number?: string;
    awb_url?: string;
    service?: string;
  }) => void;
}

export const GooritaBookingModal: React.FC<GooritaBookingModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [ratesData, setRatesData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');

  const isAlreadyBooked = Boolean(
    order?.goorita_order_id ||
    (order?.meta_data || []).some((m: any) => m.key === '_goorita_order_id' && m.value)
  );

  const fetchRates = async () => {
    if (!order) return;
    setIsLoadingRates(true);
    setError(null);

    try {
      const res = await getGooritaOrderRatesDirect(order.id);
      if (res.success && res.packages && res.packages.length > 0) {
        setRatesData(res);
        // Find default package: lowest price or Saver Lite
        const saverLite = res.packages.find((p: any) => p.name.toLowerCase().includes('lite'));
        const saver = res.packages.find((p: any) => p.name.toLowerCase().includes('saver'));
        const defaultPkg = saverLite || saver || res.packages[0];
        setSelectedPackageId(defaultPkg.id);
      } else {
        setError(res.error || 'No shipping services returned by Goorita for this destination.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed connecting to Goorita rate engine.');
    } finally {
      setIsLoadingRates(false);
    }
  };

  useEffect(() => {
    if (isOpen && order) {
      fetchRates();
    } else {
      setRatesData(null);
      setError(null);
      setSelectedPackageId('');
    }
  }, [isOpen, order?.id]);

  if (!order) return null;

  const packagesList = ratesData?.packages || [];
  const selectedPackage = packagesList.find((p: any) => p.id === selectedPackageId) || packagesList[0];
  const recipient = ratesData?.recipient || {
    name: `${order.shipping?.first_name || ''} ${order.shipping?.last_name || ''}`.trim() || 'Customer',
    address: order.shipping?.address_1 || '',
    city: order.shipping?.city || '',
    state: order.shipping?.state || '',
    postcode: order.shipping?.postcode || '',
    phone: order.shipping?.phone || order.billing?.phone || '',
  };
  const calculation = ratesData?.calculation || null;

  const handleConfirmBooking = async () => {
    if (!order || !selectedPackage) return;
    setIsBooking(true);

    try {
      const res = await createGooritaAwbDirect(order.id, {
        package_id: selectedPackage.id,
        force_rebook: isAlreadyBooked,
      });

      if (res.success && (res.order_id || res.tracking_number)) {
        const tracking = res.order_id || res.tracking_number || '';
        showToast(
          'success',
          'Goorita AWB Booked',
          `AWB ${tracking} generated via ${selectedPackage.name}. Cost: ${selectedPackage.price?.format || 'Standard'}.`
        );
        onSuccess(res);
        onClose();
      } else {
        const errMsg = res.error || res.message || 'Goorita booking failed.';
        setError(errMsg);
        showToast('error', 'Booking Failed', errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Error executing Goorita booking.';
      setError(errMsg);
      showToast('error', 'Booking Error', errMsg);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isBooking && onClose()}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Goorita Production Booking Preview</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                USPS Airwaybill
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-normal">
              Order #{order.id} &bull; Review shipping costs and select service before generating official AWB
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-left">
            {selectedPackage && (
              <div className="text-xs font-sans">
                <span className="text-neutral-400">Selected Cost: </span>
                <span className="text-sky-400 font-bold font-mono text-sm">
                  {selectedPackage.price?.format}
                </span>
                <span className="text-neutral-500 text-[11px] ml-1.5 font-mono">
                  ({selectedPackage.name})
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBooking}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLoadingRates || isBooking || !selectedPackage}
              onClick={handleConfirmBooking}
              className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold font-sans flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Goorita AWB...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {isAlreadyBooked
                      ? `Re-book AWB (${selectedPackage?.price?.format || 'Confirm'})`
                      : `Confirm & Generate AWB (${selectedPackage?.price?.format || 'Confirm'})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1 font-sans">
        {/* Recipient & Destination Box */}
        <div className="p-3.5 rounded-xl bg-[#141414] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>Recipient Destination</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-sky-400">
              {recipient.city}, {recipient.state} {recipient.postcode}
            </span>
          </div>
          <div className="text-xs text-neutral-300 leading-relaxed">
            <span className="font-bold text-white">{recipient.name}</span> &bull; {recipient.phone}
            <div className="text-neutral-400 mt-0.5">
              {recipient.address}, {recipient.city}, {recipient.state} {recipient.postcode}, United States
            </div>
          </div>
        </div>

        {/* Package Dimensions & Weight Calculation */}
        {calculation && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Weight</div>
              <div className="text-xs font-mono font-bold text-white mt-0.5">
                {calculation.weight_kg} kg <span className="text-neutral-500 font-normal">({calculation.weight_kg * 1000}g)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Dimensions</div>
              <div className="text-xs font-mono font-bold text-white mt-0.5">
                {calculation.dimensions.length}&times;{calculation.dimensions.width}&times;{calculation.dimensions.height} cm
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Declared Value</div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                ${calculation.declared_value_usd} USD
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] text-neutral-400 uppercase font-bold">Parcel Type</div>
              <div className="text-xs font-mono font-bold text-sky-400 mt-0.5">
                {calculation.item_type === 'box' ? 'Box Package' : 'Small Envelope'}
              </div>
            </div>
          </div>
        )}

        {/* Rate Services Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-sky-400" />
              <span>Available Goorita Services</span>
            </span>
            <button
              type="button"
              disabled={isLoadingRates}
              onClick={fetchRates}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className={clsx("w-3 h-3", isLoadingRates && "animate-spin")} />
              <span>Refresh Rates</span>
            </button>
          </div>

          {isLoadingRates ? (
            <div className="p-8 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center gap-2.5 text-neutral-400">
              <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
              <span className="text-xs">Fetching real-time rates from Goorita Send...</span>
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-xl bg-red-950/25 border border-red-500/30 text-red-300 flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold">Rate Calculation Notice</div>
                <div className="text-[11px] text-red-300/90">{error}</div>
              </div>
            </div>
          ) : packagesList.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-neutral-400">
              No available Goorita shipping options found for this destination.
            </div>
          ) : (
            <div className="space-y-2">
              {packagesList.map((pkg: any) => {
                const isSelected = pkg.id === selectedPackageId;
                const isLite = pkg.name.toLowerCase().includes('lite');

                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={clsx(
                      "p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                      isSelected
                        ? "bg-sky-500/10 border-sky-500 text-white shadow-sm"
                        : "bg-[#141414] border-white/[0.08] text-neutral-300 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                        isSelected ? "border-sky-400 bg-sky-500" : "border-neutral-600 bg-transparent"
                      )}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{pkg.name}</span>
                          {isLite && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              LITE RATE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-0.5 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neutral-500" />
                            {pkg.delivery_time?.format || '3-7 Business Days'}
                          </span>
                          {pkg.basic_rate && (
                            <span>Base: {pkg.basic_rate.format}</span>
                          )}
                          {pkg.surcharges_total ? (
                            <span>Surcharges: IDR {Number(pkg.surcharges_total).toLocaleString('id-ID')}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={clsx("text-sm font-bold font-mono", isSelected ? "text-sky-400" : "text-white")}>
                        {pkg.price?.format}
                      </div>
                      <div className="text-[10px] text-neutral-500">Goorita Send (USPS)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Operational Notice */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
          <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-amber-300">
            Confirming this will immediately book the parcel with Goorita Send Production API and generate the official USPS airwaybill. Order tracking will update to the generated AWB code.
          </div>
        </div>
      </div>
    </Modal>
  );
};
