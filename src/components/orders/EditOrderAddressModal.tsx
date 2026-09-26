import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Order, OrderShipping } from '../../types';
import { updateOrderDirect, UpdateOrderPayload } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { COUNTRY_OPTIONS } from '../../lib/countries';
import { MapPin, User, Mail, Phone, Building, Globe, FileText, Check, AlertCircle } from 'lucide-react';

interface EditOrderAddressModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedOrder: Order) => void;
}

export const EditOrderAddressModal: React.FC<EditOrderAddressModalProps> = ({
  order,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('Indonesia');
  const [customerNote, setCustomerNote] = useState('');
  const [syncBilling, setSyncBilling] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (order && isOpen) {
      const s = order.shipping || {};
      const b = order.billing || {};

      let initialFirst = s.first_name || b.first_name || '';
      let initialLast = s.last_name || b.last_name || '';

      if (!initialFirst && order.customer_name) {
        const parts = order.customer_name.trim().split(' ');
        initialFirst = parts[0] || '';
        initialLast = parts.slice(1).join(' ') || '';
      }

      setFirstName(initialFirst);
      setLastName(initialLast);
      setEmail(order.customer_email || b.email || '');
      setPhone(order.customer_phone || s.phone || b.phone || '');
      setCompany(s.company || b.company || '');
      setAddress1(s.address_1 || b.address_1 || '');
      setAddress2(s.address_2 || b.address_2 || '');
      setCity(s.city || b.city || '');
      setState(s.state || b.state || '');
      setPostcode(s.postcode || b.postcode || '');
      setCountry(s.country || b.country || 'Indonesia');
      setCustomerNote(order.customer_note || '');
      setErrorMsg(null);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim()) {
      setErrorMsg('Recipient name is required');
      return;
    }
    if (!address1.trim()) {
      setErrorMsg('Street address line 1 is required');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCompany = company.trim();
    const cleanAddr1 = address1.trim();
    const cleanAddr2 = address2.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim();
    const cleanPostcode = postcode.trim();
    const cleanCountry = country.trim() || 'Indonesia';
    const cleanNote = customerNote.trim();

    const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ');

    const shippingData: Partial<OrderShipping> = {
      first_name: cleanFirst,
      last_name: cleanLast,
      company: cleanCompany,
      address_1: cleanAddr1,
      address_2: cleanAddr2,
      city: cleanCity,
      state: cleanState,
      postcode: cleanPostcode,
      country: cleanCountry,
      phone: cleanPhone,
    };

    const billingData: Partial<OrderShipping> = syncBilling ? {
      ...shippingData,
      email: cleanEmail,
    } : {
      ...(order.billing || {}),
      email: cleanEmail || order.billing?.email,
      phone: cleanPhone || order.billing?.phone,
    };

    const payload: UpdateOrderPayload = {
      customer_name: fullName || order.customer_name,
      customer_email: cleanEmail || order.customer_email,
      customer_phone: cleanPhone || order.customer_phone,
      customer_note: cleanNote,
      shipping: shippingData,
      billing: billingData,
    };

    try {
      const res = await updateOrderDirect(order.id, payload);
      if (res.success && res.order) {
        showToast('success', 'Address Updated', `Delivery details for Order ${order.order_number || `#${order.id}`} successfully saved.`);
        onSaved(res.order);
        onClose();
      } else {
        // Fallback optimistic update if server responds with error in offline/local mock
        const fallbackOrder: Order = {
          ...order,
          customer_name: fullName || order.customer_name,
          customer_email: cleanEmail || order.customer_email,
          customer_phone: cleanPhone || order.customer_phone,
          customer_note: cleanNote,
          shipping: {
            ...(order.shipping || {}),
            ...shippingData,
          },
          billing: {
            ...(order.billing || {}),
            ...billingData,
          },
        };
        showToast('success', 'Address Updated', `Delivery details for Order ${order.order_number || `#${order.id}`} updated locally.`);
        onSaved(fallbackOrder);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update address');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-sans tracking-tight">Edit Customer & Delivery Address</h3>
            <p className="text-[11px] font-mono text-neutral-400">Order {order.order_number || `#${order.id}`}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncBilling}
              onChange={(e) => setSyncBilling(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-neutral-900 text-[#f3aa18] focus:ring-[#f3aa18] focus:ring-offset-0"
            />
            <span className="text-xs text-neutral-300 font-sans">
              Sync billing address with shipping address
            </span>
          </label>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSaving}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Save Address Changes
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-1">
        {errorMsg && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section: Contact & Recipient */}
        <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
          <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
            <User className="w-3.5 h-3.5 text-[#f3aa18]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">Recipient & Contact</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="First Name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Hendra"
              required
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Wijaya"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@domain.com"
              leftIcon={<Mail className="w-3.5 h-3.5" />}
            />
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08123456789 or +62..."
              leftIcon={<Phone className="w-3.5 h-3.5" />}
            />
          </div>

          <div>
            <Input
              label="Company Name (Optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company, Building, or Studio Name"
              leftIcon={<Building className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        {/* Section: Physical Destination Address */}
        <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-3.5">
          <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
            <MapPin className="w-3.5 h-3.5 text-[#f3aa18]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">Shipping Destination</h4>
          </div>

          <div className="space-y-3">
            <Input
              label="Street Address Line 1 *"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              placeholder="Street name, house/building number, RT/RW"
              required
            />
            <Input
              label="Address Line 2 (Apartment, Suite, Unit, Kelurahan)"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              placeholder="Apt, Suite, Floor, or Landmark"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="City / Kota"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Jakarta Selatan"
            />
            <Input
              label="State / Province"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. DKI Jakarta"
            />
            <Input
              label="Postal Code"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="e.g. 12190"
            />
          </div>

          <div className="space-y-1.5 font-sans">
            <label className="block text-xs font-medium text-zinc-300">
              Country
            </label>
            <div className="relative">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-white/[0.09] bg-[#0c0d10] px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]/70 focus:ring-2 focus:ring-[#f3aa18]/10 transition-all font-sans"
              >
                <option value="Indonesia">Indonesia</option>
                <option value="United States">United States</option>
                <option value="Singapore">Singapore</option>
                <option value="Malaysia">Malaysia</option>
                <option value="Australia">Australia</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Germany">Germany</option>
                <option value="Japan">Japan</option>
                <option value="Philippines">Philippines</option>
                <option value="Thailand">Thailand</option>
                <option value="Vietnam">Vietnam</option>
                <option disabled>──────────</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section: Customer Note */}
        <div className="p-4 rounded-xl border border-white/[0.06] bg-[#141417] space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
              Customer Note / Special Delivery Instructions
            </label>
          </div>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={2}
            placeholder="Delivery instructions, gate code, recipient note..."
            className="w-full rounded-xl border border-white/[0.09] bg-[#0c0d10] px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]/70 focus:ring-2 focus:ring-[#f3aa18]/10 transition-all font-sans leading-relaxed"
          />
        </div>
      </form>
    </Modal>
  );
};
