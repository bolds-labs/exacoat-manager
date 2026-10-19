import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchProductsDirect,
  fetchGlobalFinishesDirect,
  fetchShippingRatesDirect,
  createEndorsementOrderDirect,
  GlobalFinish,
  DEFAULT_GLOBAL_FINISHES,
  ShippingRateOption,
  Product,
} from '../../lib/wordpressBridge';
import { formatCurrency } from '../../lib/formatters';
import {
  Sparkles,
  Plus,
  Trash2,
  Search,
  Truck,
  ShieldCheck,
  Smartphone,
  Layers,
  FileText,
  User,
  AtSign,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

interface EndorsementOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newOrderId?: number) => void;
}

const PLATFORMS = [
  { id: 'Instagram', label: 'Instagram', color: 'text-pink-400 border-pink-500/30 bg-pink-500/10' },
  { id: 'YouTube', label: 'YouTube', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  { id: 'TikTok', label: 'TikTok', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  { id: 'X / Twitter', label: 'X (Twitter)', color: 'text-sky-400 border-sky-500/30 bg-sky-500/10' },
  { id: 'Other', label: 'Other / VIP', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
];

const DEFAULT_COURIER_OPTIONS: ShippingRateOption[] = [
  { id: 'jne_reg', courier: 'jne', service: 'REG', label: 'JNE - Regular', price: 18000, duration: '2 - 3 Days' },
  { id: 'sicepat_reg', courier: 'sicepat', service: 'REG', label: 'SiCepat - Regular', price: 18000, duration: '2 - 3 Days' },
  { id: 'jne_yes', courier: 'jne', service: 'YES', label: 'JNE - YES (Next Day)', price: 24000, duration: '1 - 2 Days' },
  { id: 'sicepat_best', courier: 'sicepat', service: 'BEST', label: 'SiCepat - BEST (Next Day)', price: 22000, duration: '1 - 2 Days' },
];

const POPULAR_FINISHES = [
  'Matte Black',
  'Forged Carbon',
  'Carbon Fiber Black',
  'Leather Black',
  'Matte Clear',
  'Satin White',
  'Pastel Sky',
  'Titanium Gray',
  'Swarm / Honeycomb',
];

interface EndorsementItemState {
  id: string; // local temporary id
  product: Product | null;
  productSearch: string;
  isSearching: boolean;
  searchedProducts: Product[];
  coverage: string;
  finish: string;
  customNote: string;
  quantity: number;
}

export const EndorsementOrderModal: React.FC<EndorsementOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  // Influencer details
  const [influencerName, setInfluencerName] = useState('');
  const [influencerHandle, setInfluencerHandle] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Shipping destination
  const [address1, setAddress1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('ID');

  // Items list (Multi-item PR package)
  const [items, setItems] = useState<EndorsementItemState[]>([
    {
      id: 'item-1',
      product: null,
      productSearch: '',
      isSearching: false,
      searchedProducts: [],
      coverage: 'Back Only',
      finish: 'Matte Black',
      customNote: '',
      quantity: 1,
    },
  ]);

  // Global finishes from API
  const [finishes, setFinishes] = useState<GlobalFinish[]>(DEFAULT_GLOBAL_FINISHES);

  // Couriers
  const [courierOptions, setCourierOptions] = useState<ShippingRateOption[]>(DEFAULT_COURIER_OPTIONS);
  const [selectedCourierId, setSelectedCourierId] = useState('jne_reg');
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Campaign & Notes
  const [campaignName, setCampaignName] = useState('Influencer PR Unboxing');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch finishes once
  useEffect(() => {
    fetchGlobalFinishesDirect()
      .then((res) => {
        if (res.success && res.finishes && res.finishes.length > 0) {
          setFinishes(res.finishes);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch live shipping rates when postcode changes
  useEffect(() => {
    if (!postcode.trim() || postcode.trim().length < 5) return;
    const timer = setTimeout(() => {
      setIsLoadingRates(true);
      fetchShippingRatesDirect(
        postcode.trim(),
        'ID',
        undefined,
        city.trim() || undefined,
        address1.trim() || undefined,
        state.trim() || undefined
      )
        .then((res) => {
          if (res.success && res.rates && res.rates.length > 0) {
            setCourierOptions(res.rates);
            if (!res.rates.some((r) => r.id === selectedCourierId)) {
              setSelectedCourierId(res.rates[0].id);
            }
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingRates(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [postcode, city, state, address1, selectedCourierId]);

  // Selected courier price
  const selectedCourier = useMemo(() => {
    return courierOptions.find((c) => c.id === selectedCourierId) || courierOptions[0] || DEFAULT_COURIER_OPTIONS[0];
  }, [courierOptions, selectedCourierId]);

  // Item helpers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        product: null,
        productSearch: '',
        isSearching: false,
        searchedProducts: [],
        coverage: 'Back Only',
        finish: 'Matte Black',
        customNote: '',
        quantity: 1,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<EndorsementItemState>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
    );
  };

  const handleSearchProduct = async (id: string, query: string) => {
    handleUpdateItem(id, { productSearch: query });
    if (!query.trim() || query.trim().length < 2) {
      handleUpdateItem(id, { searchedProducts: [], isSearching: false });
      return;
    }

    handleUpdateItem(id, { isSearching: true });
    try {
      const res = await fetchProductsDirect({ search: query.trim(), page: 1, per_page: 10 });
      handleUpdateItem(id, {
        searchedProducts: res.products || [],
        isSearching: false,
      });
    } catch {
      handleUpdateItem(id, { searchedProducts: [], isSearching: false });
    }
  };

  const handleSubmit = async () => {
    if (!influencerName.trim()) {
      showToast('error', 'Influencer Name Required', 'Please enter the influencer or creator name.');
      return;
    }
    if (!influencerHandle.trim()) {
      showToast('error', 'Handle Required', 'Please enter the creator social handle (e.g. @gadgetins).');
      return;
    }
    if (!phone.trim()) {
      showToast('error', 'Phone Required', 'Recipient phone number is required for courier delivery.');
      return;
    }
    if (!address1.trim() || !postcode.trim()) {
      showToast('error', 'Address Required', 'Please provide delivery street address and postal code.');
      return;
    }

    const invalidItems = items.filter((it) => !it.product);
    if (invalidItems.length > 0) {
      showToast('error', 'Product Selection Incomplete', 'Please select a valid device skin for all added items.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedItems = items.map((it) => {
        const prod = it.product!;
        const configParts = [`Coverage: ${it.coverage}`, `Finish: ${it.finish}`];
        if (it.customNote.trim()) {
          configParts.push(`Note: ${it.customNote.trim()}`);
        }
        const configuration = configParts.join(' | ');

        return {
          product_id: prod.id,
          name: prod.name,
          quantity: it.quantity || 1,
          configuration,
          configurator_data: [
            { layer_name: 'Coverage', choice_name: it.coverage },
            { layer_name: 'Finish', choice_name: it.finish },
          ],
          device_model: prod.name,
          note: it.customNote.trim(),
          item_note: it.customNote.trim(),
        };
      });

      const cleanHandle = influencerHandle.trim().startsWith('@')
        ? influencerHandle.trim()
        : `@${influencerHandle.trim()}`;

      const payload = {
        influencer_name: influencerName.trim(),
        influencer_handle: cleanHandle,
        platform,
        campaign_name: campaignName.trim() || 'Influencer PR',
        admin_notes: adminNotes.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        shipping_address: {
          address_1: address1.trim(),
          city: city.trim(),
          state: state.trim(),
          postcode: postcode.trim(),
          country: country.trim() || 'ID',
        },
        items: formattedItems,
        courier_id: selectedCourier.id,
        courier_label: selectedCourier.label,
        actual_shipping_cost: selectedCourier.price,
      };

      const res = await createEndorsementOrderDirect(payload);
      if (res.success) {
        showToast(
          'success',
          'Endorsement Order Created',
          `Order #${res.order_number || res.order_id} generated and sent to production queue.`
        );
        onSuccess?.(res.order_id);
        onClose();
      } else {
        showToast('error', 'Failed to Create Endorsement', res.error || 'Server error occurred.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Could not dispatch endorsement order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
      <div className="flex flex-col max-h-[85vh] bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden font-sans text-neutral-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800/80 bg-neutral-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Create Endorsement Order</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  VIP / Influencer PR
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Dispatch complimentary custom skin PR packages to content creators (100% free with waived courier shipping).
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Section 1: Influencer / Creator Details */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
              <User className="w-4 h-4" />
              <span>1. Influencer / Creator Profile</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Creator / Recipient Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. David Brendi"
                  value={influencerName}
                  onChange={(e) => setInfluencerName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Social Media Handle <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <AtSign className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="gadgetins"
                    value={influencerHandle}
                    onChange={(e) => setInfluencerHandle(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Platform Selector */}
            <div>
              <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                Primary Platform
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const isSelected = platform === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatform(p.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold font-sans border transition-all cursor-pointer',
                        isSelected
                          ? `${p.color} border-current shadow-xs`
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Recipient Phone (Courier Delivery) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    placeholder="0812-3456-7890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Email (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="creator@channel.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Shipping Destination */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              <span>2. Shipping Destination Address</span>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Street Address <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Jl. Boulevard Raya Blok M No. 12, Kelapa Gading"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Jakarta Utara"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Province / State
                </label>
                <input
                  type="text"
                  placeholder="DKI Jakarta"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Postal Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="14240"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={country}
                  disabled
                  className="w-full px-3 py-2 bg-neutral-900/60 border border-neutral-800/80 rounded-lg text-xs text-neutral-400 font-mono cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Multi-Item PR Package Skins */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                <Smartphone className="w-4 h-4" />
                <span>3. PR Package Skins ({items.length} {items.length === 1 ? 'Device' : 'Devices'})</span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Skin</span>
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, idx) => {
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <span className="text-xs font-mono font-bold text-neutral-300">
                        Skin #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-neutral-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Product Search */}
                    <div>
                      <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                        Select Device Skin <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search device (e.g. iPhone 16 Pro Max, MacBook Pro 16...)"
                          value={item.product ? item.product.name : item.productSearch}
                          onChange={(e) => {
                            if (item.product) {
                              handleUpdateItem(item.id, { product: null });
                            }
                            handleSearchProduct(item.id, e.target.value);
                          }}
                          className="w-full pl-8 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
                        />
                        {item.isSearching && (
                          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin absolute right-3 top-2.5" />
                        )}
                      </div>

                      {/* Search Results Dropdown */}
                      {!item.product && item.searchedProducts.length > 0 && (
                        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg bg-neutral-950 border border-neutral-800 divide-y divide-neutral-800/60 shadow-xl z-20">
                          {item.searchedProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handleUpdateItem(item.id, {
                                  product: p,
                                  productSearch: p.name,
                                  searchedProducts: [],
                                });
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-amber-500/10 text-xs text-neutral-200 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="text-[10px] font-mono text-neutral-500">ID #{p.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Coverage & Finish Customization */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                          Coverage Part
                        </label>
                        <select
                          value={item.coverage}
                          onChange={(e) => handleUpdateItem(item.id, { coverage: e.target.value })}
                          className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                        >
                          <option value="Back Only">Back Only</option>
                          <option value="Full Coverage (Sides/Frame)">Full Coverage (Sides/Frame)</option>
                          <option value="Top Skin">Top Skin (Laptop / Tablet)</option>
                          <option value="Top + Bottom Skin">Top + Bottom Skin</option>
                          <option value="Complete Full Body Set">Complete Full Body Set</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                          Finish / Texture
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            list={`finishes-list-${item.id}`}
                            placeholder="e.g. Matte Black, Forged Carbon"
                            value={item.finish}
                            onChange={(e) => handleUpdateItem(item.id, { finish: e.target.value })}
                            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
                          />
                          <datalist id={`finishes-list-${item.id}`}>
                            {POPULAR_FINISHES.map((f) => (
                              <option key={f} value={f} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    </div>

                    {/* Quick Finish Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {POPULAR_FINISHES.slice(0, 6).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => handleUpdateItem(item.id, { finish: f })}
                          className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer',
                            item.finish === f
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-neutral-950/60 text-neutral-400 border-neutral-800 hover:text-white'
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    {/* Quantity & Notes */}
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white font-mono text-center focus:outline-none focus:border-amber-500/50"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                          Item Note / Engraving (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Camera lens skin included"
                          value={item.customNote}
                          onChange={(e) => handleUpdateItem(item.id, { customNote: e.target.value })}
                          className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Courier Selection & 100% Fee Waiver */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Truck className="w-4 h-4" />
                <span>4. Courier Shipping & Waiver (100% Free)</span>
              </div>
              {isLoadingRates && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  <span>Loading live rates...</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {courierOptions.map((c) => {
                const isSelected = c.id === selectedCourierId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCourierId(c.id)}
                    className={clsx(
                      'p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer',
                      isSelected
                        ? 'bg-purple-500/10 border-purple-500/40 shadow-xs'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                    )}
                  >
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{c.label}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 mt-0.5">{c.duration || 'Standard'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-neutral-300">
                        {formatCurrency(c.price, 'IDR')}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400 font-semibold">Waived</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Financial Breakdown Card */}
            <div className="p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-neutral-400">
                <span>PR Products Value ({items.length} items):</span>
                <span className="text-emerald-400 font-semibold">Rp 0 (100% Complimentary)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Courier Shipping ({selectedCourier.label}):</span>
                <span>{formatCurrency(selectedCourier.price, 'IDR')}</span>
              </div>
              <div className="flex justify-between text-purple-400">
                <span>Marketing Shipping Waiver (Borne by Exacoat):</span>
                <span>-{formatCurrency(selectedCourier.price, 'IDR')}</span>
              </div>
              <div className="pt-2 border-t border-neutral-800 flex justify-between text-sm font-bold text-white">
                <span>Total Due:</span>
                <span className="text-emerald-400">Rp 0 (Free PR Dispatch)</span>
              </div>
            </div>
          </div>

          {/* Section 5: Campaign & Deliverables */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>5. Campaign Details & Internal Notes</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Campaign / Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. iPhone 16 PR Unboxing / Review Unit"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                  Fulfillment Notes (Packing & Production)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Include thank you card & VIP packaging"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Automated WhatsApp notifications are completely bypassed to protect direct 1-on-1 creator communication.</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-800/80 bg-neutral-950/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Dispatching Order...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Dispatch Endorsement Order (Rp 0)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
