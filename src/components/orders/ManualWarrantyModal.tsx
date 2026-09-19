import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchProductsDirect,
  fetchGlobalFinishesDirect,
  fetchShippingRatesDirect,
  createManualWarrantyClaimDirect,
  checkMarketplaceInvoiceDirect,
  fetchProductConfiguratorProfileDirect,
  GlobalFinish,
  DEFAULT_GLOBAL_FINISHES,
  ShippingRateOption,
  Product,
  ShopeeOrder,
  TikTokOrder,
} from '../../lib/wordpressBridge';
import { Order } from '../../types';
import { formatCurrency } from '../../lib/formatters';

export interface DynamicProductLayer {
  id: string;
  name: string;
  is_required: boolean;
  default_selected: boolean;
}

function inferDeviceLayers(product: Product): DynamicProductLayer[] {
  const nameLower = (product.name || '').toLowerCase();
  const catNames = (product.categories || []).map((c) => (c.name || '').toLowerCase()).join(' ');
  const combined = `${nameLower} ${catNames}`;

  if (
    combined.includes('macbook') ||
    combined.includes('laptop') ||
    combined.includes('notebook') ||
    combined.includes('thinkpad') ||
    combined.includes('surface laptop')
  ) {
    return [
      { id: 'top', name: 'Top Skin', is_required: true, default_selected: true },
      { id: 'bottom', name: 'Bottom Skin', is_required: false, default_selected: true },
      { id: 'palmrest', name: 'Inside / Palmrest', is_required: false, default_selected: false },
      { id: 'trackpad', name: 'Trackpad', is_required: false, default_selected: false },
    ];
  }

  if (combined.includes('pad') || combined.includes('tablet') || combined.includes('tab')) {
    return [
      { id: 'back', name: 'Back Skin', is_required: true, default_selected: true },
      { id: 'pencil', name: 'Apple Pencil / Accent', is_required: false, default_selected: false },
      { id: 'frame', name: 'Frame / Sides', is_required: false, default_selected: false },
    ];
  }

  if (
    combined.includes('playstation') ||
    combined.includes('ps5') ||
    combined.includes('xbox') ||
    combined.includes('switch') ||
    combined.includes('steam deck') ||
    combined.includes('rog ally')
  ) {
    return [
      { id: 'body', name: 'Main Body / Plates', is_required: true, default_selected: true },
      { id: 'middle', name: 'Middle Strip / Accent', is_required: false, default_selected: false },
      { id: 'controller', name: 'Controller Skin', is_required: false, default_selected: false },
    ];
  }

  if (combined.includes('keyboard')) {
    return [
      { id: 'body', name: 'Main Keyboard Body', is_required: true, default_selected: true },
      { id: 'surround', name: 'Key Surround Accent', is_required: false, default_selected: false },
    ];
  }

  // Default for smartphones (iPhone, Samsung Galaxy, Pixel, Xiaomi, etc.)
  return [
    { id: 'back', name: 'Back Skin', is_required: true, default_selected: true },
    { id: 'camera', name: 'Camera Accent', is_required: false, default_selected: false },
    { id: 'frame', name: 'Frame / Sides', is_required: false, default_selected: false },
  ];
}

function inferDeviceOptions(product: Product): { hasCoverage: boolean; hasLogo: boolean } {
  const nameLower = (product.name || '').toLowerCase();
  const catNames = (product.categories || []).map((c) => (c.name || '').toLowerCase()).join(' ');
  const combined = `${nameLower} ${catNames}`;

  const isLaptop =
    combined.includes('macbook') ||
    combined.includes('laptop') ||
    combined.includes('notebook') ||
    combined.includes('thinkpad') ||
    combined.includes('surface laptop');

  const isTablet =
    combined.includes('pad') ||
    combined.includes('tablet') ||
    combined.includes('tab');

  const isConsole =
    combined.includes('playstation') ||
    combined.includes('ps5') ||
    combined.includes('xbox') ||
    combined.includes('switch') ||
    combined.includes('steam deck') ||
    combined.includes('rog ally');

  const isKeyboard = combined.includes('keyboard');

  // Phone if not laptop, tablet, console, or keyboard
  const isPhone = !isLaptop && !isTablet && !isConsole && !isKeyboard;

  // Logo Cutout is available on MacBooks, iPads, iPhones, and Apple devices
  const hasLogo =
    isLaptop ||
    combined.includes('iphone') ||
    combined.includes('apple') ||
    combined.includes('ipad') ||
    combined.includes('macbook');

  // Coverage (Model Cut vs Model 360) is primarily for smartphones
  const hasCoverage = isPhone;

  return { hasCoverage, hasLogo };
}

import {
  ShieldCheck,
  Search,
  Truck,
  Package,
  Layers,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  MapPin,
  FileText,
  DollarSign,
  Palette,
  Sliders,
  X,
  Plus,
  ChevronDown,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ManualWarrantyModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingOrder?: Order | null;
  initialClaimType?: 'Warranty' | 'Redeem';
  initialShopeeOrder?: ShopeeOrder | null;
  initialTikTokOrder?: TikTokOrder | null;
  onSuccess?: (newOrderId?: number) => void;
}

const MARKETPLACE_CHANNELS = [
  { id: 'Tokopedia', label: 'Tokopedia', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { id: 'Shopee', label: 'Shopee', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  { id: 'TikTok Shop', label: 'TikTok Shop', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
  { id: 'Manual / WhatsApp', label: 'Manual / WhatsApp', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
];

const CLAIM_REASONS = [
  'Wrinkled skin during installation',
  'Torn edge or corner during application',
  'Bubbles or misaligned fit',
  'Customer mishap during self-installation',
  'Customer complaint via WhatsApp',
  'Other / Courtesy replacement',
];

export const REDEEM_REASON_GROUPS = [
  {
    group: 'QC Fault',
    isQcFault: true,
    description: 'Defect or fulfillment error: automatic shipping deduction dispatched to HR',
    reasons: [
      'Precision cut defect / sizing mismatch',
      'Incorrect design or finish sent by factory',
      'Missing multi-part component (e.g. bottom skin not included)',
      'Surface defect / printing flaw on arrival',
      'Other Exacoat factory or fulfillment error',
    ],
  },
  {
    group: 'External Cause',
    isQcFault: false,
    description: 'Logistics or courier damage (no HR deduction)',
    reasons: [
      'Damaged in transit / packaging crushed',
    ],
  },
] as const;

export const REDEEM_DEFECT_REASONS = REDEEM_REASON_GROUPS.flatMap((g) => g.reasons);

export const isQcFaultReason = (reason: string): boolean => {
  const qcGroup = REDEEM_REASON_GROUPS.find((g) => g.isQcFault);
  return Boolean(qcGroup?.reasons.includes(reason as any));
};

export const ManualWarrantyModal: React.FC<ManualWarrantyModalProps> = ({
  isOpen,
  onClose,
  existingOrder,
  initialClaimType = 'Warranty',
  initialShopeeOrder,
  initialTikTokOrder,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const isExisting = Boolean(existingOrder);

  // Claim Type: Warranty (customer error) vs Redeem (Exacoat fault)
  const [claimType, setClaimType] = useState<'Warranty' | 'Redeem'>(initialClaimType);

  // Channel & Reference
  const [channel, setChannel] = useState<string>('Tokopedia');
  const [marketplaceInvoice, setMarketplaceInvoice] = useState('');

  // Customer & Address
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address1, setAddress1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('ID');

  // Existing order items selection & granular multi-part selection
  const [selectedParentItemIds, setSelectedParentItemIds] = useState<number[]>([]);
  const [selectedParts, setSelectedParts] = useState<Record<number, string[]>>({});

  // Product Selection for Marketplace mode
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Configuration Dual Mode (Mode A: Visual Finishes vs Mode B: Quick Variant Text)
  const [configMode, setConfigMode] = useState<'modeA' | 'modeB'>('modeA');
  const [finishes, setFinishes] = useState<GlobalFinish[]>(DEFAULT_GLOBAL_FINISHES);
  const [deviceLayers, setDeviceLayers] = useState<DynamicProductLayer[]>([]);
  const [isLoadingLayers, setIsLoadingLayers] = useState(false);
  const [layerFinishes, setLayerFinishes] = useState<Record<string, string>>({});
  const [layerClaimed, setLayerClaimed] = useState<Record<string, boolean>>({});
  const [freeformConfigText, setFreeformConfigText] = useState('');

  // Device cut and coverage options (Coverage: Model Cut vs 360, Logo Cutout: With vs Without)
  const [hasCoverageOption, setHasCoverageOption] = useState(false);
  const [selectedCoverage, setSelectedCoverage] = useState<'Model Cut' | 'Model 360°'>('Model Cut');
  const [hasLogoOption, setHasLogoOption] = useState(false);
  const [selectedLogoCutout, setSelectedLogoCutout] = useState<'With Logo Cutout' | 'Without Logo Cutout'>('With Logo Cutout');

  // Live Biteship Shipping Calculation
  const [shippingRates, setShippingRates] = useState<ShippingRateOption[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState('jne_reg');
  const [selectedCourierLabel, setSelectedCourierLabel] = useState('JNE Regular');
  const [selectedCourierPrice, setSelectedCourierPrice] = useState(10000);
  const [waiveShipping, setWaiveShipping] = useState(false);

  // Claim Details
  const [claimReason, setClaimReason] = useState(CLAIM_REASONS[0]);
  const [initialStatus, setInitialStatus] = useState<'processing' | 'on-hold'>('processing');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReasonMenuOpen, setIsReasonMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const claimReasonMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (claimReasonMenuRef.current && !claimReasonMenuRef.current.contains(e.target as Node)) {
        setIsReasonMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Invoice validation state to prevent duplicates
  const [isCheckingInvoice, setIsCheckingInvoice] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState<{
    checked: boolean;
    available: boolean;
    message?: string;
    existingOrderNumber?: string;
    existingOrderType?: string;
  } | null>(null);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState(false);

  // Sync initialClaimType when prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setAllowDuplicateOverride(false);
      setClaimType(initialClaimType);
      if (initialClaimType === 'Redeem') {
        setWaiveShipping(true);
        setClaimReason(REDEEM_DEFECT_REASONS[0]);
        setInitialStatus('processing');
      } else {
        setClaimReason(CLAIM_REASONS[0]);
        setWaiveShipping(false);
      }
    }
  }, [initialClaimType, isOpen]);

  // Load global finishes on mount
  useEffect(() => {
    fetchGlobalFinishesDirect().then((res) => {
      if (res.success && res.finishes?.length) {
        setFinishes(res.finishes);
      }
    });
  }, []);

  // Prepopulate if opened from an existing order
  useEffect(() => {
    if (existingOrder && isOpen) {
      setCustomerName(
        `${existingOrder.shipping?.first_name || ''} ${existingOrder.shipping?.last_name || ''}`.trim() ||
          existingOrder.customer_name ||
          ''
      );
      setCustomerPhone(existingOrder.shipping?.phone || existingOrder.billing?.phone || '');
      setCustomerEmail(existingOrder.shipping?.email || existingOrder.billing?.email || '');
      setAddress1(existingOrder.shipping?.address_1 || '');
      setCity(existingOrder.shipping?.city || '');
      const stateVal = existingOrder.shipping?.state || existingOrder.billing?.state || '';
      setState(stateVal);
      const zip = existingOrder.shipping?.postcode || '';
      setPostcode(zip);
      const countryVal = existingOrder.shipping?.country || existingOrder.billing?.country || 'ID';
      setCountry(countryVal);

      // Pre-select all items and their parts
      const allItemIds = (existingOrder.items || []).map((i) => i.id);
      setSelectedParentItemIds(allItemIds);

      const partsMap: Record<number, string[]> = {};
      (existingOrder.items || []).forEach((item) => {
        if (item.parsed_configurator && item.parsed_configurator.length > 0) {
          partsMap[item.id] = item.parsed_configurator.map((p) => p.layer_name || p.name || 'Part');
        }
      });
      setSelectedParts(partsMap);

      // Auto-calculate shipping rates if zip exists or if international
      if (zip.trim().length >= 3 || countryVal !== 'ID') {
        handleCalculateShipping(zip.trim(), countryVal);
      }
    } else if (initialShopeeOrder && isOpen) {
      setChannel('Shopee');
      setMarketplaceInvoice(initialShopeeOrder.order_sn || '');
      setCustomerName(
        initialShopeeOrder.recipient_name ||
          initialShopeeOrder.buyer_username ||
          ''
      );
      setCustomerPhone(initialShopeeOrder.recipient_phone || '');
      setCustomerEmail('');
      setAddress1(initialShopeeOrder.recipient_address || '');
      setCity(initialShopeeOrder.recipient_city || '');
      setState('');
      setCountry('ID');
      const zip = initialShopeeOrder.recipient_postcode || '';
      setPostcode(zip);

      // Format purchased Shopee products and variations
      const itemsText = (initialShopeeOrder.items || [])
        .map((it) => `${it.item_name}${it.model_name ? ` (${it.model_name})` : ''} x${it.quantity}`)
        .join('\n');
      setFreeformConfigText(itemsText);
      setConfigMode('modeB');

      // Trigger invoice duplicate check immediately
      if (initialShopeeOrder.order_sn) {
        checkMarketplaceInvoiceDirect(initialShopeeOrder.order_sn).then((chk) => {
          if (chk.success && chk.available === false) {
            setInvoiceStatus({
              checked: true,
              available: false,
              message: chk.message || 'This Shopee order invoice has already been claimed.',
              existingOrderNumber: chk.existing_order_number,
              existingOrderType: chk.existing_order_type,
            });
          } else {
            setInvoiceStatus({
              checked: true,
              available: true,
              message: 'Shopee invoice verified. No previous claims recorded.',
            });
          }
        });
      }

      // Auto-calculate shipping if zip exists
      if (zip.trim().length >= 4) {
        handleCalculateShipping(zip.trim(), 'ID');
      }
    } else if (initialTikTokOrder && isOpen) {
      setChannel('TikTok Shop');
      const orderId = initialTikTokOrder.order_id || initialTikTokOrder.order_sn || '';
      setMarketplaceInvoice(orderId);
      setCustomerName(
        initialTikTokOrder.recipient_name ||
          initialTikTokOrder.buyer_username ||
          ''
      );
      setCustomerPhone(initialTikTokOrder.recipient_phone || '');
      setCustomerEmail('');
      setAddress1(initialTikTokOrder.recipient_address || '');
      setCity(initialTikTokOrder.recipient_city || '');
      setState('');
      setCountry('ID');
      const zip = initialTikTokOrder.recipient_postcode || '';
      setPostcode(zip);

      // Format purchased TikTok products and variations
      const itemsText = (initialTikTokOrder.items || [])
        .map((it) => `${it.item_name}${it.sku_name ? ` (${it.sku_name})` : ''} x${it.quantity}`)
        .join('\n');
      setFreeformConfigText(itemsText);
      setConfigMode('modeB');

      // Trigger invoice duplicate check immediately
      if (orderId) {
        checkMarketplaceInvoiceDirect(orderId, 'TikTok Shop').then((chk) => {
          if (chk.success && chk.available === false) {
            setInvoiceStatus({
              checked: true,
              available: false,
              message: chk.message || 'This TikTok Shop order invoice has already been claimed.',
              existingOrderNumber: chk.existing_order_number,
              existingOrderType: chk.existing_order_type,
            });
          } else {
            setInvoiceStatus({
              checked: true,
              available: true,
              message: 'TikTok Shop invoice verified. No previous claims recorded.',
            });
          }
        });
      }

      // Auto-calculate shipping if zip exists
      if (zip.trim().length >= 4) {
        handleCalculateShipping(zip.trim(), 'ID');
      }
    } else if (isOpen) {
      // Reset form for fresh marketplace claim
      setMarketplaceInvoice('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setAddress1('');
      setCity('');
      setState('');
      setPostcode('');
      setCountry('ID');
      setSelectedProduct(null);
      setFreeformConfigText('');
      setShippingRates([]);
      setSelectedCourierPrice(10000);
      setSelectedParentItemIds([]);
      setSelectedParts({});
      if (claimType === 'Redeem') {
        setWaiveShipping(true);
      } else {
        setWaiveShipping(false);
      }
    }
  }, [existingOrder, initialShopeeOrder, isOpen]);

  // Product Search with Debounce
  useEffect(() => {
    if (!productSearch.trim() || isExisting) {
      setSearchedProducts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingProducts(true);
      const res = await fetchProductsDirect({ search: productSearch.trim(), per_page: 20 });
      if (res.success) {
        setSearchedProducts(res.products || []);
      }
      setIsSearchingProducts(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [productSearch, isExisting]);

  // Dynamically resolve product configurator layers and options when selectedProduct changes
  useEffect(() => {
    if (!selectedProduct) {
      setDeviceLayers([]);
      setLayerFinishes({});
      setLayerClaimed({});
      setHasCoverageOption(false);
      setHasLogoOption(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingLayers(true);

    const inferred = inferDeviceOptions(selectedProduct);
    let detectedHasCoverage = inferred.hasCoverage;
    let detectedHasLogo = inferred.hasLogo;

    fetchProductConfiguratorProfileDirect(selectedProduct.id)
      .then((res) => {
        if (isCancelled) return;
        setIsLoadingLayers(false);

        let resolved: DynamicProductLayer[] = [];
        if (res.success && res.profile?.layers && res.profile.layers.length > 0) {
          const rawLayers = res.profile.layers;

          rawLayers.forEach((l: any) => {
            const lName = (l.name || '').toLowerCase();
            if (lName.includes('model') || lName.includes('coverage') || lName.includes('360')) {
              detectedHasCoverage = true;
            }
            if (lName.includes('logo') || lName.includes('cutout')) {
              detectedHasLogo = true;
            }
          });

          if (res.profile.variants && Array.isArray(res.profile.variants)) {
            res.profile.variants.forEach((v: any) => {
              const vName = (v.name || '').toLowerCase();
              if (vName.includes('model') || vName.includes('coverage') || vName.includes('360')) {
                detectedHasCoverage = true;
              }
              if (vName.includes('logo') || vName.includes('cutout')) {
                detectedHasLogo = true;
              }
            });
          }

          // Strict filter out of non-skin layers: logo, cutout, model, coverage, 360, device body
          resolved = rawLayers
            .filter((l: any) => {
              const lName = (l.name || '').toLowerCase();
              if (lName === 'device' || lName.includes('device-body')) return false;
              if (lName.includes('logo') || lName.includes('cutout')) return false;
              if (lName.includes('model') || lName.includes('coverage') || lName.includes('360') || lName.includes('series')) return false;
              return true;
            })
            .map((l: any, idx: number) => ({
              id: String(l.id || `layer_${idx}`),
              name: String(l.name || `Part ${idx + 1}`),
              is_required: Boolean(l.is_required),
              default_selected: l.default_selected ?? (idx === 0 || Boolean(l.is_required)),
            }));
        }

        // Fallback to intelligent category/name inference if no skin layers found
        if (resolved.length === 0) {
          resolved = inferDeviceLayers(selectedProduct);
        }

        setHasCoverageOption(detectedHasCoverage);
        setSelectedCoverage('Model Cut');
        setHasLogoOption(detectedHasLogo);
        setSelectedLogoCutout('With Logo Cutout');
        setDeviceLayers(resolved);

        const initialFinishes: Record<string, string> = {};
        const initialClaimed: Record<string, boolean> = {};

        resolved.forEach((l, idx) => {
          // In Model Cut (back only), frame / sides is not selected by default
          const isFrame = l.id.toLowerCase().includes('frame') || l.name.toLowerCase().includes('frame');
          const isPrimary = (idx === 0 || l.is_required) && !isFrame;
          const shouldClaim = (isPrimary || l.default_selected) && !isFrame;
          initialClaimed[l.id] = shouldClaim;
          initialFinishes[l.id] = shouldClaim ? 'black-camo' : '';
        });

        setLayerFinishes(initialFinishes);
        setLayerClaimed(initialClaimed);
      })
      .catch(() => {
        if (isCancelled) return;
        setIsLoadingLayers(false);
        const fallback = inferDeviceLayers(selectedProduct);
        setHasCoverageOption(detectedHasCoverage);
        setSelectedCoverage('Model Cut');
        setHasLogoOption(detectedHasLogo);
        setSelectedLogoCutout('With Logo Cutout');
        setDeviceLayers(fallback);

        const initialFinishes: Record<string, string> = {};
        const initialClaimed: Record<string, boolean> = {};
        fallback.forEach((l, idx) => {
          const isFrame = l.id.toLowerCase().includes('frame') || l.name.toLowerCase().includes('frame');
          const isPrimary = (idx === 0 || l.is_required) && !isFrame;
          const shouldClaim = (isPrimary || l.default_selected) && !isFrame;
          initialClaimed[l.id] = shouldClaim;
          initialFinishes[l.id] = shouldClaim ? 'black-camo' : '';
        });
        setLayerFinishes(initialFinishes);
        setLayerClaimed(initialClaimed);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedProduct]);

  // Debounced check for invoice availability to prevent duplicates
  useEffect(() => {
    setAllowDuplicateOverride(false);
    if (isExisting) {
      setInvoiceStatus(null);
      return;
    }

    const cleanInvoice = marketplaceInvoice.trim().replace(/^#+/, '');
    if (!cleanInvoice || cleanInvoice.length < 3) {
      setInvoiceStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingInvoice(true);
      const res = await checkMarketplaceInvoiceDirect(cleanInvoice, channel);
      setIsCheckingInvoice(false);

      if (res.success) {
        setInvoiceStatus({
          checked: true,
          available: res.available,
          message: res.message,
          existingOrderNumber: res.existing_order_number,
          existingOrderType: res.existing_order_type,
        });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [marketplaceInvoice, channel, isExisting]);

  // Live Biteship / WooCommerce International Shipping Rates calculation
  const handleCalculateShipping = async (zip: string, overrideCountry?: string) => {
    const activeCountry = (overrideCountry || country || 'ID').toUpperCase().trim();
    const cleanZip = zip.trim();
    if (activeCountry === 'ID' && (!cleanZip || cleanZip.length < 3)) {
      showToast('warning', 'Postal Code Required', 'Please enter a valid postal code to calculate shipping.');
      return;
    }

    setIsLoadingShipping(true);
    const res = await fetchShippingRatesDirect(
      cleanZip,
      activeCountry,
      existingOrder?.id,
      city.trim(),
      address1.trim(),
      state.trim()
    );
    setIsLoadingShipping(false);

    if (res.success && res.rates?.length) {
      let finalRates = res.rates;
      if (activeCountry === 'ID') {
        // Filter strictly to JNE and SiCepat, no J&T
        const filteredRates = res.rates.filter((r) => {
          const c = (r.courier || '').toLowerCase();
          return c.includes('jne') || c.includes('sicepat');
        });
        finalRates = filteredRates.length ? filteredRates : res.rates;
      }
      setShippingRates(finalRates);
      const first = finalRates[0];
      setSelectedCourierId(first.id);
      setSelectedCourierLabel(first.label);
      setSelectedCourierPrice(first.price);
      if (res.is_fallback) {
        showToast('info', 'Standard Rates', 'Using standard courier rate estimates.');
      } else {
        const sourceLabel = activeCountry === 'ID' ? 'Biteship' : 'WooCommerce';
        showToast('success', 'Live Rates Loaded', `Loaded ${finalRates.length} live ${sourceLabel} rates.`);
      }
    } else {
      showToast('warning', 'Rates Fallback', 'Using standard courier rate estimates.');
    }
  };

  const handleSelectRate = (rate: ShippingRateOption) => {
    setSelectedCourierId(rate.id);
    setSelectedCourierLabel(rate.label);
    setSelectedCourierPrice(rate.price);
  };

  const toggleParentItem = (itemId: number) => {
    setSelectedParentItemIds((prev) => {
      const exists = prev.includes(itemId);
      if (exists) {
        return prev.filter((id) => id !== itemId);
      } else {
        const item = existingOrder?.items?.find((i) => i.id === itemId);
        if (item?.parsed_configurator && item.parsed_configurator.length > 0) {
          setSelectedParts((p) => ({
            ...p,
            [itemId]: item.parsed_configurator!.map((pt) => pt.layer_name || pt.name || 'Part'),
          }));
        }
        return [...prev, itemId];
      }
    });
  };

  const toggleItemPart = (itemId: number, partId: string, allParts: string[]) => {
    setSelectedParts((prev) => {
      const current = prev[itemId] || [...allParts];
      const next = current.includes(partId)
        ? current.filter((p) => p !== partId)
        : [...current, partId];
      return { ...prev, [itemId]: next };
    });
  };

  const isParentAlreadyClaimed = isExisting && Boolean(
    existingOrder?.meta_data?.some((m) => (m.key === '_has_warranty_claim' || m.key === '_has_redeem_claim') && m.value === 'yes') ||
    existingOrder?.meta_data?.some((m) => (m.key === '_warranty_replacement_order_id' || m.key === '_redeem_replacement_order_id') && Boolean(m.value))
  );

  const handleSubmit = async () => {
    // Validation
    if (!isExisting) {
      if (!marketplaceInvoice.trim()) {
        showToast('error', 'Invoice Required', 'Please enter the marketplace order number / invoice.');
        return;
      }
      if (invoiceStatus?.checked && !invoiceStatus.available && !allowDuplicateOverride) {
        showToast('error', 'Duplicate Invoice Blocked', invoiceStatus.message || 'This invoice has already been claimed or redeemed. Check "Allow duplicate claim" to override.');
        return;
      }
      if (!customerName.trim() || !customerPhone.trim()) {
        showToast('error', 'Customer Info Required', 'Please provide customer name and phone number.');
        return;
      }
      if (!address1.trim() || !postcode.trim()) {
        showToast('error', 'Address Required', 'Please provide destination street address and postal code.');
        return;
      }
      if (!selectedProduct) {
        showToast('error', 'Product Required', 'Please search and select a device skin.');
        return;
      }
    } else {
      if (selectedParentItemIds.length === 0) {
        showToast('error', 'Select Items', 'Please select at least one skin to replace.');
        return;
      }
      if (isParentAlreadyClaimed && !allowDuplicateOverride) {
        showToast('error', 'Order Already Claimed', 'This order has already been processed for an RMA warranty or redeem replacement. Check "Allow secondary RMA claim" to override.');
        return;
      }
    }

    const isQc = claimType === 'Redeem' && isQcFaultReason(claimReason);
    if (isQc && !adminNotes.trim()) {
      showToast('error', 'QC Reason Required', 'Please enter internal admin notes explaining the QC defect for HR shipping deduction.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isExisting && existingOrder) {
        const payload = {
          source_type: 'existing_order' as const,
          rma_type: claimType,
          parent_order_id: existingOrder.id,
          selected_item_ids: selectedParentItemIds,
          selected_parts: selectedParts,
          claim_reason: claimReason,
          courier_id: selectedCourierId,
          courier_label: selectedCourierLabel,
          shipping_cost: claimType === 'Redeem' || waiveShipping ? 0 : selectedCourierPrice,
          actual_shipping_cost: selectedCourierPrice,
          is_qc_fault: isQc,
          qc_deduction_reason: adminNotes.trim(),
          waive_shipping: claimType === 'Redeem' || waiveShipping,
          initial_status: claimType === 'Redeem' ? 'processing' : initialStatus,
          notes: adminNotes,
          allow_duplicate: allowDuplicateOverride,
          shipping_address: {
            address_1: address1.trim(),
            city: city.trim(),
            state: state.trim(),
            postcode: postcode.trim(),
            country: country.trim() || 'ID',
          },
        };

        const res = await createManualWarrantyClaimDirect(payload);
        if (res.success) {
          const webhookNote = res.hr_webhook?.dispatched
            ? (res.hr_webhook.success ? ' HR deduction webhook dispatched.' : ' (HR webhook logged in notes)')
            : '';
          showToast('success', `${claimType} Claim Created`, (res.message || 'Replacement order generated successfully.') + webhookNote);
          onSuccess?.(res.replacement_order_id);
          onClose();
        } else {
          showToast('error', 'Claim Failed', res.error || (res as any).message || `Could not create ${claimType.toLowerCase()} claim.`);
        }
      } else {
        // Prepare configuration for Marketplace mode
        let configurationString = '';
        const configuratorData: any[] = [];

        if (configMode === 'modeA') {
          const parts: string[] = [];

          if (hasCoverageOption) {
            parts.push(`Coverage: ${selectedCoverage}`);
            configuratorData.push({ layer_name: 'Model', choice_name: selectedCoverage });
          }

          if (hasLogoOption) {
            parts.push(`Logo: ${selectedLogoCutout}`);
            configuratorData.push({ layer_name: 'Logo Cutout', choice_name: selectedLogoCutout });
          }

          let claimedCount = 0;
          deviceLayers.forEach((layer) => {
            const isClaimed = layerClaimed[layer.id];
            const finishSlug = layerFinishes[layer.id];

            if (isClaimed && finishSlug) {
              claimedCount++;
              const finishObj = finishes.find((f) => f.slug === finishSlug || f.id === finishSlug);
              const finishName = finishObj ? finishObj.name : finishSlug;
              parts.push(`${layer.name}: ${finishName}`);
              configuratorData.push({ layer_name: layer.name, choice_name: finishName });
            }
          });

          if (claimedCount === 0) {
            showToast('error', 'Select Skin Part', 'Please select and configure at least one skin part to replace.');
            setIsSubmitting(false);
            return;
          }

          configurationString = parts.join(' | ');
        } else {
          configurationString = freeformConfigText.trim() || 'Standard Replacement Skin';
          configuratorData.push({ layer_name: 'Configuration', choice_name: configurationString });
        }

        const payload = {
          source_type: 'marketplace' as const,
          rma_type: claimType,
          channel,
          marketplace_invoice: marketplaceInvoice.trim(),
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim(),
          shipping_address: {
            address_1: address1.trim(),
            city: city.trim(),
            state: state.trim(),
            postcode: postcode.trim(),
            country: country.trim() || 'ID',
          },
          items: [
            {
              product_id: selectedProduct!.id,
              name: selectedProduct!.name,
              quantity: 1,
              configuration: configurationString,
              configurator_data: configuratorData,
              device_model: selectedProduct!.name,
            },
          ],
          courier_id: selectedCourierId,
          courier_label: selectedCourierLabel,
          shipping_cost: claimType === 'Redeem' || waiveShipping ? 0 : selectedCourierPrice,
          actual_shipping_cost: selectedCourierPrice,
          is_qc_fault: isQc,
          qc_deduction_reason: adminNotes.trim(),
          waive_shipping: claimType === 'Redeem' || waiveShipping,
          claim_reason: claimReason,
          initial_status: claimType === 'Redeem' ? 'processing' : initialStatus,
          notes: adminNotes,
          allow_duplicate: allowDuplicateOverride,
        };

        const res = await createManualWarrantyClaimDirect(payload);
        if (res.success) {
          const webhookNote = res.hr_webhook?.dispatched
            ? (res.hr_webhook.success ? ' HR deduction webhook dispatched.' : ' (HR webhook logged in notes)')
            : '';
          showToast('success', `${claimType} Order Created`, (res.message || 'Replacement order generated successfully.') + webhookNote);
          onSuccess?.(res.replacement_order_id);
          onClose();
        } else {
          showToast('error', 'Claim Failed', res.error || (res as any).message || `Could not create marketplace ${claimType.toLowerCase()} claim.`);
        }
      }
    } catch (err: any) {
      showToast('error', 'Submission Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFreeShipping = claimType === 'Redeem' || waiveShipping;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2.5 font-sans">
          <div
            className={clsx(
              'w-8 h-8 rounded-xl border flex items-center justify-center shrink-0',
              claimType === 'Redeem'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            )}
          >
            {claimType === 'Redeem' ? <RotateCcw className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">
              {isExisting
                ? claimType === 'Redeem'
                  ? `Redeem Claim (Order #${existingOrder?.order_number || existingOrder?.id})`
                  : `Installation Warranty Claim (Order #${existingOrder?.order_number || existingOrder?.id})`
                : claimType === 'Redeem'
                ? 'Create Marketplace Redeem Order'
                : 'Create Marketplace Warranty Claim'}
            </span>
          </div>
        </div>
      }
      subtitle={
        claimType === 'Redeem'
          ? 'Generate a replacement order with free shipping (borne by Exacoat) due to factory defect, wrong finish, or damaged item.'
          : isExisting
          ? 'Select line items and courier to generate an installation warranty replacement order for this customer.'
          : 'Generate an approved warranty replacement order for Shopee, Tokopedia, TikTok Shop, or WhatsApp orders.'
      }
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-3">
          <div className="text-xs font-mono text-neutral-400">
            <span>Customer shipping: </span>
            <span className={clsx('font-bold', isFreeShipping ? 'text-amber-400' : 'text-white')}>
              {isFreeShipping
                ? 'Rp 0 (Free)'
                : formatCurrency(selectedCourierPrice, 'IDR')}
            </span>
            {isFreeShipping && (
              <span className="text-[11px] text-neutral-400 ml-2">
                (Courier rate: <span className="text-emerald-400 font-bold">{formatCurrency(selectedCourierPrice, 'IDR')}</span>)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (isParentAlreadyClaimed && !allowDuplicateOverride) ||
                (!isExisting && invoiceStatus?.checked && !invoiceStatus.available && !allowDuplicateOverride)
              }
              className={clsx(
                'px-5 py-2 rounded-xl text-xs font-bold text-neutral-950 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2 cursor-pointer',
                claimType === 'Redeem'
                  ? 'bg-amber-400 hover:bg-amber-300'
                  : 'bg-emerald-500 hover:bg-emerald-400'
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating {claimType}...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Create {claimType} Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar font-sans text-sm">
        {/* Claim Type Selector: Warranty vs Redeem */}
        <div className="p-1 rounded-2xl bg-neutral-900 border border-white/[0.08] grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setClaimType('Warranty');
              setClaimReason(CLAIM_REASONS[0]);
              setWaiveShipping(false);
            }}
            className={clsx(
              'py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer',
              claimType === 'Warranty'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            )}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="font-bold">Installation Warranty</div>
              <div className="text-[10px] font-normal text-neutral-400">Customer installation mishap</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setClaimType('Redeem');
              setClaimReason(REDEEM_DEFECT_REASONS[0]);
              setWaiveShipping(true);
              setInitialStatus('processing');
            }}
            className={clsx(
              'py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 cursor-pointer',
              claimType === 'Redeem'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            )}
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="font-bold">Redeem</div>
              <div className="text-[10px] font-normal text-amber-300/80">Cut defect, wrong skin (Free Shipping)</div>
            </div>
          </button>
        </div>

        {claimType === 'Redeem' && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold">Redeem Protocol Active: </span>
              Issued for Exacoat factory defects or fulfillment mistakes. Shipping fee is automatically locked to <strong>Rp 0 (Free)</strong> and replacement order proceeds straight to production.
            </div>
          </div>
        )}

        {/* Section 1: Channel & Reference (Marketplace Only) */}
        {!isExisting && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Marketplace Channel & Invoice
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MARKETPLACE_CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className={clsx(
                    'py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer',
                    channel === ch.id
                      ? `${ch.color} font-bold shadow-xs`
                      : 'bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white'
                  )}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs text-neutral-400 mb-1 block">
                {channel} Order Number / Invoice ID *
              </label>
              <input
                type="text"
                placeholder={
                  channel === 'Tokopedia'
                    ? 'e.g. INV/20260318/MPL/39201928'
                    : channel === 'Shopee'
                    ? 'e.g. 240918ABCD1234'
                    : 'e.g. Order #12345678'
                }
                value={marketplaceInvoice}
                onChange={(e) => setMarketplaceInvoice(e.target.value)}
                className={clsx(
                  "w-full px-3.5 py-2 rounded-xl bg-[#141414] border font-mono text-xs focus:outline-none transition-colors",
                  invoiceStatus?.checked && !invoiceStatus.available
                    ? allowDuplicateOverride
                      ? "border-amber-500/70 text-amber-300 focus:border-amber-500"
                      : "border-rose-500/70 text-rose-300 focus:border-rose-500"
                    : invoiceStatus?.checked && invoiceStatus.available
                    ? "border-emerald-500/60 text-white focus:border-emerald-500"
                    : "border-white/[0.08] text-white focus:border-emerald-500"
                )}
              />
              {isCheckingInvoice && (
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1.5 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-[#f3aa18]" />
                  <span>Checking invoice history for duplicates...</span>
                </div>
              )}
              {invoiceStatus?.checked && !invoiceStatus.available && (
                <div className={clsx(
                  "mt-2 p-3.5 rounded-xl border text-xs space-y-2.5 transition-colors",
                  allowDuplicateOverride
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                )}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={clsx(
                      "w-4 h-4 shrink-0 mt-0.5",
                      allowDuplicateOverride ? "text-amber-400" : "text-rose-400"
                    )} />
                    <div>
                      <p className={clsx(
                        "font-bold",
                        allowDuplicateOverride ? "text-amber-400" : "text-rose-400"
                      )}>
                        {allowDuplicateOverride ? "Duplicate Claim (Admin Override Active)" : "Duplicate Claim Blocked"}
                      </p>
                      <p className="mt-0.5 leading-relaxed opacity-90">{invoiceStatus.message}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-amber-300 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={allowDuplicateOverride}
                        onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                        className="w-4 h-4 rounded border-amber-500/50 bg-neutral-900 text-amber-500 focus:ring-amber-400 focus:ring-offset-neutral-950 cursor-pointer"
                      />
                      <span>Allow duplicate claim (Admin Override)</span>
                    </label>
                    {allowDuplicateOverride && (
                      <span className="text-[11px] text-amber-400/90 font-mono">
                        Override active. Reason will be logged in order notes.
                      </span>
                    )}
                  </div>
                </div>
              )}
              {invoiceStatus?.checked && invoiceStatus.available && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1.5 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Invoice is eligible (No prior claims found).</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 2: Items Selection */}
        {isExisting ? (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
            {isParentAlreadyClaimed && (
              <div className={clsx(
                "p-3.5 rounded-xl border text-xs space-y-2.5 transition-colors",
                allowDuplicateOverride
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              )}>
                <div className="flex items-start gap-2.5">
                  <AlertCircle className={clsx(
                    "w-4 h-4 shrink-0 mt-0.5",
                    allowDuplicateOverride ? "text-amber-400" : "text-rose-400"
                  )} />
                  <div>
                    <p className={clsx(
                      "font-bold",
                      allowDuplicateOverride ? "text-amber-400" : "text-rose-400"
                    )}>
                      {allowDuplicateOverride ? "Order RMA (Admin Override Active)" : "Order Already Processed for RMA"}
                    </p>
                    <p className="mt-0.5 opacity-90 leading-relaxed">
                      This order has already been processed for an RMA warranty or redeem replacement. Duplicate replacements are restricted without admin authorization.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-amber-300 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={allowDuplicateOverride}
                      onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-500/50 bg-neutral-900 text-amber-500 focus:ring-amber-400 focus:ring-offset-neutral-950 cursor-pointer"
                    />
                    <span>Allow secondary RMA claim (Admin Override)</span>
                  </label>
                  {allowDuplicateOverride && (
                    <span className="text-[11px] text-amber-400/90 font-mono">
                      Override active. Secondary replacement permitted.
                    </span>
                  )}
                </div>
              </div>
            )}
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Select Skins to Replace (From Order #{existingOrder?.order_number || existingOrder?.id})
            </label>
            <div className="space-y-2">
              {(existingOrder?.items || []).map((item) => {
                const isChecked = selectedParentItemIds.includes(item.id);
                const itemParts = (item.parsed_configurator || []).map((p) => ({
                  id: p.layer_name || p.name || 'Part',
                  label: `${p.layer_name || 'Part'}${p.name && p.name !== p.layer_name ? ` (${p.name})` : ''}`,
                }));
                const hasParts = itemParts.length > 1;
                const activeParts = selectedParts[item.id] || itemParts.map((p) => p.id);

                return (
                  <div
                    key={item.id}
                    className={clsx(
                      'p-3 rounded-xl border transition-all',
                      isChecked
                        ? claimType === 'Redeem'
                          ? 'bg-amber-500/10 border-amber-500/30 text-white'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/20'
                    )}
                  >
                    <div
                      onClick={() => toggleParentItem(item.id)}
                      className="flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className={clsx(
                            'rounded border-neutral-700',
                            claimType === 'Redeem'
                              ? 'text-amber-500 focus:ring-amber-400'
                              : 'text-emerald-500 focus:ring-emerald-400'
                          )}
                        />
                        <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-white/10 overflow-hidden shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-neutral-600 m-auto mt-2.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-white truncate">{item.name}</p>
                          <p className="text-[11px] text-neutral-400 font-mono truncate">
                            Qty: {item.quantity} {item.finish_type ? `• Finish: ${item.finish_type}` : ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'text-xs font-mono font-bold',
                          claimType === 'Redeem' ? 'text-amber-400' : 'text-emerald-400'
                        )}
                      >
                        {claimType === 'Redeem' ? 'Rp 0 (Redeem)' : 'Rp 0 (Warranty)'}
                      </span>
                    </div>

                    {isChecked && hasParts && (
                      <div
                        className="mt-2.5 pt-2.5 border-t border-white/[0.06] pl-6 space-y-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[11px] font-semibold text-neutral-300 flex items-center justify-between">
                          <span>Granular Parts Selection (Cut & replace claimed parts only):</span>
                          <span className="text-[10px] text-neutral-400">
                            {activeParts.length} / {itemParts.length} parts
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {itemParts.map((part) => {
                            const isPartChecked = activeParts.includes(part.id);
                            return (
                              <label
                                key={part.id}
                                className={clsx(
                                  'px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-colors',
                                  isPartChecked
                                    ? claimType === 'Redeem'
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isPartChecked}
                                  onChange={() =>
                                    toggleItemPart(
                                      item.id,
                                      part.id,
                                      itemParts.map((p) => p.id)
                                    )
                                  }
                                  className={clsx(
                                    'rounded border-neutral-700 w-3.5 h-3.5',
                                    claimType === 'Redeem'
                                      ? 'text-amber-500 focus:ring-amber-400'
                                      : 'text-emerald-500 focus:ring-emerald-400'
                                  )}
                                />
                                <span className="truncate">{part.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Marketplace Product Selection & Dual Mode Configuration */
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Device Skin & Configuration
              </label>
              {/* Dual Mode Switcher */}
              <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setConfigMode('modeA')}
                  className={clsx(
                    'px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                    configMode === 'modeA'
                      ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  )}
                >
                  <Palette className="w-3 h-3" />
                  <span>Mode A: Swatches</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfigMode('modeB')}
                  className={clsx(
                    'px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                    configMode === 'modeB'
                      ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  )}
                >
                  <FileText className="w-3 h-3" />
                  <span>Mode B: Quick Text</span>
                </button>
              </div>
            </div>

            {/* Device Search */}
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Search Device Model *</label>
              {selectedProduct ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">{selectedProduct.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">ID: #{selectedProduct.id}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="p-1 rounded text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type device name e.g. iPhone 16 Pro, S24 Ultra, MacBook..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                  {isSearchingProducts && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                  {searchedProducts.length > 0 && (
                    <div className="absolute top-full mt-1.5 left-0 right-0 max-h-48 overflow-y-auto rounded-xl bg-[#181818] border border-white/10 shadow-2xl z-30 divide-y divide-white/[0.04]">
                      {searchedProducts.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setSelectedProduct(prod);
                            setProductSearch('');
                            setSearchedProducts([]);
                          }}
                          className="p-2.5 hover:bg-white/[0.06] cursor-pointer flex items-center justify-between text-xs transition-colors"
                        >
                          <span className="text-white font-medium">{prod.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">#{prod.id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mode A: Dynamic Finishes Selection based on Device Model */}
            {/* Mode A: Dynamic Finishes Selection based on Device Model */}
            {configMode === 'modeA' ? (
              <div className="pt-1 space-y-3">
                {!selectedProduct ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
                    <p className="text-xs text-neutral-400">
                      Please search and select a device model above to load its customizable parts (e.g. Top, Bottom for MacBook; Back, Camera for phones).
                    </p>
                  </div>
                ) : isLoadingLayers ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center gap-2 text-xs text-neutral-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Loading configurator parts for {selectedProduct.name}...</span>
                  </div>
                ) : (
                  <>
                    {/* Device Cut Style & Logo Options Panel */}
                    {(hasCoverageOption || hasLogoOption) && (
                      <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-300">
                            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Cut Style & Device Options</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            {!hasCoverageOption && (
                              <button
                                type="button"
                                onClick={() => setHasCoverageOption(true)}
                                className="text-neutral-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Coverage Option</span>
                              </button>
                            )}
                            {!hasLogoOption && (
                              <button
                                type="button"
                                onClick={() => setHasLogoOption(true)}
                                className="text-neutral-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Logo Cutout</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Coverage: Model Cut vs Model 360 */}
                          {hasCoverageOption && (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
                                <span>Phone Coverage Style</span>
                                <span className="text-[10px] text-neutral-500 font-mono">Back only vs Full body</span>
                              </label>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCoverage('Model Cut');
                                    // In Model Cut, frame/sides is not covered
                                    const frameLayer = deviceLayers.find(
                                      (l) => l.id.toLowerCase().includes('frame') || l.name.toLowerCase().includes('frame')
                                    );
                                    if (frameLayer) {
                                      setLayerClaimed((prev) => ({ ...prev, [frameLayer.id]: false }));
                                      setLayerFinishes((prev) => ({ ...prev, [frameLayer.id]: '' }));
                                    }
                                  }}
                                  className={clsx(
                                    'p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none',
                                    selectedCoverage === 'Model Cut'
                                      ? 'bg-emerald-500/15 border-emerald-500/60 text-white font-bold ring-1 ring-emerald-500/40'
                                      : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:border-white/20'
                                  )}
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span>Model Cut</span>
                                    {selectedCoverage === 'Model Cut' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  </div>
                                  <p className="text-[10px] text-neutral-400 font-normal mt-0.5 leading-tight">Back skin only (Case friendly)</p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCoverage('Model 360°');
                                    // In Model 360, frame/sides is covered
                                    const frameLayer = deviceLayers.find(
                                      (l) => l.id.toLowerCase().includes('frame') || l.name.toLowerCase().includes('frame')
                                    );
                                    if (frameLayer) {
                                      setLayerClaimed((prev) => ({ ...prev, [frameLayer.id]: true }));
                                      setLayerFinishes((prev) => ({ ...prev, [frameLayer.id]: prev[frameLayer.id] || 'black-camo' }));
                                    }
                                  }}
                                  className={clsx(
                                    'p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none',
                                    selectedCoverage === 'Model 360°'
                                      ? 'bg-emerald-500/15 border-emerald-500/60 text-white font-bold ring-1 ring-emerald-500/40'
                                      : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:border-white/20'
                                  )}
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span>Model 360°</span>
                                    {selectedCoverage === 'Model 360°' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  </div>
                                  <p className="text-[10px] text-neutral-400 font-normal mt-0.5 leading-tight">Full body (Back & sides)</p>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Logo Cutout: With vs Without Cutout */}
                          {hasLogoOption && (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold text-neutral-400 flex items-center justify-between">
                                <span>Logo Cutout</span>
                                <span className="text-[10px] text-neutral-500 font-mono">No skin swatch required</span>
                              </label>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLogoCutout('With Logo Cutout')}
                                  className={clsx(
                                    'p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none',
                                    selectedLogoCutout === 'With Logo Cutout'
                                      ? 'bg-emerald-500/15 border-emerald-500/60 text-white font-bold ring-1 ring-emerald-500/40'
                                      : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:border-white/20'
                                  )}
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span>With Cutout</span>
                                    {selectedLogoCutout === 'With Logo Cutout' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  </div>
                                  <p className="text-[10px] text-neutral-400 font-normal mt-0.5 leading-tight">Exposes device logo</p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedLogoCutout('Without Logo Cutout')}
                                  className={clsx(
                                    'p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none',
                                    selectedLogoCutout === 'Without Logo Cutout'
                                      ? 'bg-emerald-500/15 border-emerald-500/60 text-white font-bold ring-1 ring-emerald-500/40'
                                      : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:border-white/20'
                                  )}
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span>Without Cutout</span>
                                    {selectedLogoCutout === 'Without Logo Cutout' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                  </div>
                                  <p className="text-[10px] text-neutral-400 font-normal mt-0.5 leading-tight">Solid skin covers logo</p>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Skin Parts Finishes Grid */}
                    {deviceLayers.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>Select customizable skin parts and choose finishes:</span>
                          <span className="text-[11px] font-mono text-emerald-400">
                            {Object.values(layerClaimed).filter(Boolean).length} of {deviceLayers.length} parts claimed
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {deviceLayers.map((layer) => {
                            const isClaimed = Boolean(layerClaimed[layer.id]);
                            const currentFinish = layerFinishes[layer.id] || '';
                            const isFrameLayer = layer.id.toLowerCase().includes('frame') || layer.name.toLowerCase().includes('frame');
                            const isFrameDisabled = isFrameLayer && hasCoverageOption && selectedCoverage === 'Model Cut';

                            return (
                              <div
                                key={layer.id}
                                className={clsx(
                                  'p-3 rounded-xl border transition-all space-y-2',
                                  isFrameDisabled
                                    ? 'bg-neutral-900/40 border-white/[0.04] text-neutral-500 opacity-70'
                                    : isClaimed
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                    : 'bg-white/[0.02] border-white/[0.06] text-neutral-400'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <label className={clsx(
                                    'flex items-center gap-2 select-none',
                                    isFrameDisabled ? 'cursor-not-allowed text-neutral-500' : 'cursor-pointer text-white'
                                  )}>
                                    <input
                                      type="checkbox"
                                      disabled={isFrameDisabled}
                                      checked={isClaimed && !isFrameDisabled}
                                      onChange={(e) => {
                                        const nextClaimed = e.target.checked;
                                        setLayerClaimed((prev) => ({ ...prev, [layer.id]: nextClaimed }));
                                        if (nextClaimed && !layerFinishes[layer.id]) {
                                          setLayerFinishes((prev) => ({ ...prev, [layer.id]: 'black-camo' }));
                                        }
                                      }}
                                      className="rounded border-neutral-700 w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-400 disabled:opacity-40"
                                    />
                                    <span className="text-xs font-bold truncate">{layer.name}</span>
                                  </label>
                                  <span
                                    className={clsx(
                                      'text-[10px] uppercase font-mono px-1.5 py-0.5 rounded',
                                      isFrameDisabled
                                        ? 'bg-white/5 text-neutral-500'
                                        : isClaimed
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-white/5 text-neutral-500'
                                    )}
                                  >
                                    {isFrameDisabled ? 'Model 360 Only' : isClaimed ? 'Claimed' : 'Skipped'}
                                  </span>
                                </div>

                                {isFrameDisabled ? (
                                  <p className="text-[11px] text-neutral-500 italic">
                                    Not included in Model Cut (Back only). Switch to Model 360° above to include frame wrap.
                                  </p>
                                ) : (
                                  <div>
                                    <select
                                      value={isClaimed ? currentFinish : ''}
                                      disabled={!isClaimed}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setLayerFinishes((prev) => ({ ...prev, [layer.id]: val }));
                                        if (!val) {
                                          setLayerClaimed((prev) => ({ ...prev, [layer.id]: false }));
                                        } else {
                                          setLayerClaimed((prev) => ({ ...prev, [layer.id]: true }));
                                        }
                                      }}
                                      className={clsx(
                                        'w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-emerald-500',
                                        isClaimed
                                          ? 'bg-[#141414] border-white/[0.12] text-white cursor-pointer'
                                          : 'bg-neutral-900/60 border-white/[0.04] text-neutral-600 cursor-not-allowed'
                                      )}
                                    >
                                      <option value="">None / Not Claimed</option>
                                      {finishes.map((f) => (
                                        <option key={f.id} value={f.slug || f.id}>
                                          {f.name} {f.group ? `(${f.group})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Mode B: Freeform Variant Text */
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">
                  Configuration / Variant Details (Copy-paste from Shopee / Tokopedia note) *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Back: Black Camo | Camera: Carbon Fiber Black | Full Body"
                  value={freeformConfigText}
                  onChange={(e) => setFreeformConfigText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Section 3: Customer Info & Shipping Address */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Customer Information & Shipping Address
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">WhatsApp Phone *</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0812xxxxxxx"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Email (Optional)</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-neutral-400 mb-1 block">Street Address *</label>
              <input
                type="text"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                placeholder="Street name, house number, RT/RW, building"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">City / Sub-district</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City or district"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Jawa Barat, California, Singapore"
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Destination Country *</label>
              <select
                value={country}
                onChange={(e) => {
                  const newCountry = e.target.value;
                  setCountry(newCountry);
                  setShippingRates([]);
                  if (postcode.trim() || newCountry !== 'ID') {
                    handleCalculateShipping(postcode, newCountry);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ID">Indonesia (Domestic - Biteship)</option>
                <option value="US">United States (Goorita / POS)</option>
                <option value="SG">Singapore</option>
                <option value="MY">Malaysia</option>
                <option value="AU">Australia</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="DE">Germany</option>
                <option value="NL">Netherlands</option>
                <option value="FR">France</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="PH">Philippines</option>
                <option value="TH">Thailand</option>
                <option value="VN">Vietnam</option>
                <option value="AE">United Arab Emirates</option>
                <option value="OTHER">Other International (WooCommerce Zone)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Live Shipping Calculator */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              {country === 'ID'
                ? 'Live Biteship Shipping Calculator (Domestic)'
                : `Live WooCommerce Shipping Calculator (${country})`}
            </label>
            {claimType === 'Redeem' ? (
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Customer Shipping: Free (Rp 0 - Borne by Exacoat)</span>
              </span>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={waiveShipping}
                  onChange={(e) => setWaiveShipping(e.target.checked)}
                  className="rounded border-neutral-700 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-xs font-bold text-emerald-400">Waive Shipping Fee (Rp 0 for Customer)</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder={
                  country === 'ID'
                    ? 'Enter 5-digit destination Postal Code (Zipcode)'
                    : 'Enter destination Postal Code / Zipcode (or click calculate)'
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#141414] border border-white/[0.08] text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => handleCalculateShipping(postcode)}
              disabled={isLoadingShipping || (country === 'ID' && !postcode.trim())}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isLoadingShipping ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Calculating...</span>
                </>
              ) : (
                <>
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{country === 'ID' ? 'Calculate Shipping' : 'Calculate International Rates'}</span>
                </>
              )}
            </button>
          </div>

          {shippingRates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {shippingRates.map((rate) => {
                const isSelected = selectedCourierId === rate.id;
                return (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => handleSelectRate(rate)}
                    className={clsx(
                      'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                      isSelected
                        ? claimType === 'Redeem'
                          ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-xs'
                          : 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-xs'
                        : 'bg-[#141414] border-white/[0.06] text-neutral-400 hover:text-white'
                    )}
                  >
                    <div>
                      <span className="font-bold text-xs block text-white">{rate.label}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{rate.duration}</span>
                    </div>
                    <span className="text-xs font-mono font-bold mt-1.5 block text-emerald-400">
                      {formatCurrency(rate.price, 'IDR')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 5: Claim Reason & Initial Status */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Claim Reason & Order Queue Status
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Custom Beautiful Claim Reason Select */}
            <div className="relative" ref={claimReasonMenuRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-neutral-400 font-medium">Claim Reason</label>
                {claimType === 'Redeem' && (
                  <span className={clsx(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded",
                    isQcFaultReason(claimReason)
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-sky-500/20 text-sky-300"
                  )}>
                    {isQcFaultReason(claimReason) ? 'QC Fault' : 'External Cause'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsReasonMenuOpen(!isReasonMenuOpen)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#181818] border border-white/[0.12] hover:border-white/25 text-white text-xs font-sans flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs focus:outline-none focus:border-emerald-500"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={clsx(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    claimType === 'Redeem'
                      ? (isQcFaultReason(claimReason) ? "bg-amber-400" : "bg-sky-400")
                      : "bg-emerald-400"
                  )} />
                  <span className="font-semibold text-neutral-100 truncate">{claimReason}</span>
                </div>
                <ChevronDown className={clsx("w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200", isReasonMenuOpen && "rotate-180 text-white")} />
              </button>

              {isReasonMenuOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-xl bg-[#121215] border border-white/15 shadow-2xl overflow-hidden py-1 backdrop-blur-2xl max-h-72 overflow-y-auto">
                  {claimType === 'Redeem' ? (
                    REDEEM_REASON_GROUPS.map((group, gIdx) => (
                      <div key={group.group} className={clsx(gIdx > 0 && "border-t border-white/[0.08] pt-1 mt-1")}>
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center justify-between bg-white/[0.02]">
                          <div className="flex items-center gap-1.5">
                            <span className={clsx("w-1.5 h-1.5 rounded-full", group.isQcFault ? "bg-amber-400" : "bg-sky-400")} />
                            <span>{group.group}</span>
                          </div>
                          {group.isQcFault && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                              HR Webhook
                            </span>
                          )}
                        </div>
                        {group.reasons.map((r) => {
                          const isSelected = claimReason === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setClaimReason(r);
                                setIsReasonMenuOpen(false);
                              }}
                              className={clsx(
                                "w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-emerald-500/15 text-emerald-300 font-bold"
                                  : "text-neutral-200 hover:bg-white/[0.08]"
                              )}
                            >
                              <span>{r}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    CLAIM_REASONS.map((r) => {
                      const isSelected = claimReason === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setClaimReason(r);
                            setIsReasonMenuOpen(false);
                          }}
                          className={clsx(
                            "w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors",
                            isSelected
                              ? "bg-emerald-500/15 text-emerald-300 font-bold"
                              : "text-neutral-200 hover:bg-white/[0.08]"
                          )}
                        >
                          <span>{r}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Custom Beautiful Initial Order Status Select */}
            <div className="relative" ref={statusMenuRef}>
              <label className="text-xs text-neutral-400 mb-1 block font-medium">Initial Order Status</label>
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#181818] border border-white/[0.12] hover:border-white/25 text-white text-xs font-sans flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs focus:outline-none focus:border-emerald-500"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={clsx(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    initialStatus === 'processing' ? "bg-emerald-400" : "bg-amber-400"
                  )} />
                  <span className="font-semibold text-neutral-100 truncate">
                    {initialStatus === 'processing'
                      ? 'Payment Confirmed (Ready to Cut)'
                      : 'Waiting for Payment (Awaiting Customer Transfer)'}
                  </span>
                </div>
                <ChevronDown className={clsx("w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200", isStatusMenuOpen && "rotate-180 text-white")} />
              </button>

              {isStatusMenuOpen && (
                <div className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-xl bg-[#121215] border border-white/15 shadow-2xl overflow-hidden py-1 backdrop-blur-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setInitialStatus('processing');
                      setIsStatusMenuOpen(false);
                    }}
                    className={clsx(
                      "w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors",
                      initialStatus === 'processing'
                        ? "bg-emerald-500/15 text-emerald-300 font-bold"
                        : "text-neutral-200 hover:bg-white/[0.08]"
                    )}
                  >
                    <span>Payment Confirmed (Ready to Cut / Production)</span>
                    {initialStatus === 'processing' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInitialStatus('on-hold');
                      setIsStatusMenuOpen(false);
                    }}
                    className={clsx(
                      "w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors",
                      initialStatus === 'on-hold'
                        ? "bg-amber-500/15 text-amber-300 font-bold"
                        : "text-neutral-200 hover:bg-white/[0.08]"
                    )}
                  >
                    <span>Waiting for Payment (Awaiting Customer Transfer)</span>
                    {initialStatus === 'on-hold' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-neutral-400 font-medium">
                {claimType === 'Redeem' && isQcFaultReason(claimReason) ? (
                  <span>
                    Internal Admin Notes (QC Deduction Reason) <span className="text-rose-400">*</span>
                  </span>
                ) : (
                  'Internal Admin Notes (Optional)'
                )}
              </label>
              {claimType === 'Redeem' && isQcFaultReason(claimReason) && (
                <span className="text-[10px] text-amber-400 font-mono">
                  Deducted via HR Webhook
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={
                claimType === 'Redeem'
                  ? 'Kesalahan kirim, iPhone 18 Pro dikirim iPhone 18.'
                  : 'e.g. Approved via WhatsApp chat by admin. Customer sent photo of damaged edge.'
              }
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className={clsx(
                "w-full px-3 py-2 rounded-xl bg-[#141414] border text-white text-xs focus:outline-none transition-colors",
                claimType === 'Redeem' && isQcFaultReason(claimReason) && !adminNotes.trim()
                  ? "border-amber-500/40 focus:border-amber-400 placeholder:text-neutral-500"
                  : "border-white/[0.08] focus:border-emerald-500 placeholder:text-neutral-500"
              )}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
