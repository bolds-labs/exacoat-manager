import React, { useState, useEffect } from 'react';
import { Modal } from '../ds/Modal';
import { Button } from '../ds/Button';
import { TextField } from '../ds/TextField';
import { Select } from '../ds/Select';
import { Checkbox } from '../ds/Checkbox';
import { Order, OrderShipping } from '../../types';
import { updateOrderDirect, UpdateOrderPayload } from '../../lib/wordpressBridge';
import { toggleLocalStorePickupOrder } from '../../lib/orderUtils';
import { useToast } from '../../context/ToastContext';
import { COUNTRY_OPTIONS } from '../../lib/countries';
import { MapPin, User, FileText, Check, AlertCircle } from 'lucide-react';

const PRIORITY_COUNTRIES = ['Indonesia', 'United States', 'Singapore', 'Malaysia', 'Australia', 'United Kingdom', 'Canada', 'Germany', 'Japan', 'Philippines', 'Thailand', 'Vietnam'];

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
      const rawCompany = (s.company || b.company || '').trim();
      setCompany(/exacoat\s*store|store\s*bekasi/i.test(rawCompany) ? '' : rawCompany);
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
    let cleanCompany = company.trim();
    if (/exacoat\s*store|store\s*bekasi/i.test(cleanCompany)) {
      cleanCompany = '';
    }
    const cleanAddr1 = address1.trim();
    const cleanAddr2 = address2.trim();
    const cleanCity = city.trim();
    const cleanState = state.trim();
    const cleanPostcode = postcode.trim();
    const cleanCountry = country.trim() || 'Indonesia';
    const cleanNote = customerNote.trim();

    const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ');

    const isStoreAddr = (cleanAddr1.toLowerCase().includes('ruby commercial') || cleanAddr1.toLowerCase().includes('summarecon bekasi')) &&
      (cleanPostcode === '17142' || cleanCity.toLowerCase().includes('bekasi'));

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
      email: cleanEmail,
      phone: cleanPhone || order.billing?.phone,
    };

    const payload: UpdateOrderPayload = {
      customer_name: fullName || order.customer_name,
      customer_email: cleanEmail,
      customer_phone: cleanPhone || order.customer_phone,
      customer_note: cleanNote,
      is_store_pickup: isStoreAddr ? true : false,
      shipping: shippingData,
      billing: billingData,
    };

    try {
      const res = await updateOrderDirect(order.id, payload);
      if (!res.success || !res.order) {
        setErrorMsg(res.error || 'Failed to update address');
        return;
      }
      if ((res.order.customer_email || '') !== cleanEmail || (res.order.billing?.email || '') !== cleanEmail) {
        setErrorMsg('The saved order still has a different customer email address.');
        return;
      }
      if (!isStoreAddr) {
        toggleLocalStorePickupOrder(order.id, false);
      }
      showToast('success', 'Address Updated', `Delivery details for Order ${order.order_number || `#${order.id}`} successfully saved.`);
      onSaved(res.order);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update address');
    } finally {
      setIsSaving(false);
    }
  };

  const countryOptions = (() => {
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    const add = (value: string, label = value) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      list.push({ value, label });
    };
    // A stored ISO code (e.g. ID) that is not in the list stays selectable so the saved value is unchanged.
    add(country);
    PRIORITY_COUNTRIES.forEach((c) => add(c));
    COUNTRY_OPTIONS.forEach((c) => add(c.value, c.label));
    return list;
  })();

  const sectionClass = 'flex flex-col gap-3 rounded-[12px] border border-card-border bg-card p-4';
  const sectionTitle = (Icon: typeof MapPin, label: string) => (
    <div className="flex items-center gap-2 border-b border-line pb-2">
      <Icon className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} aria-hidden />
      <h4 className="m-0 text-[13px] font-semibold text-fg">{label}</h4>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onOpenChange={(o) => {
        if (!o && !isSaving) onClose();
      }}
      title="Edit customer and address"
      reference={order.order_number ? `#${String(order.order_number).replace(/^#+/, '')}` : `#${order.id}`}
      width={720}
      footer={
        <>
          <Checkbox
            className="mr-auto"
            label="Sync billing address with shipping address"
            checked={syncBilling}
            onChange={(e) => setSyncBilling(e.target.checked)}
          />
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" icon={Check} onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save address'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-[10px] border border-st-stop-border bg-st-stop-bg px-3 py-2.5 text-[12.5px] text-st-stop-fg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className={sectionClass}>
          {sectionTitle(User, 'Recipient and contact')}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="First name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Hendra" required />
            <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Wijaya" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@domain.com" />
            <TextField label="Phone" type="tel" mono value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08123456789 or +62..." />
          </div>
          <TextField label="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company, building or studio name" />
        </div>

        <div className={sectionClass}>
          {sectionTitle(MapPin, 'Shipping destination')}
          <TextField label="Street address line 1 *" value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Street name, house or building number, RT/RW" required />
          <TextField label="Address line 2 (apartment, suite, unit, kelurahan)" value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="Apt, suite, floor or landmark" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Jakarta Selatan" />
            <TextField label="State / province" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. DKI Jakarta" />
            <TextField label="Postal code" mono value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="e.g. 12190" />
          </div>
          <Select label="Country" value={country} options={countryOptions} onChange={setCountry} />
        </div>

        <div className={sectionClass}>
          {sectionTitle(FileText, 'Customer note and delivery instructions')}
          <textarea
            data-ds=""
            aria-label="Customer note"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            rows={2}
            placeholder="Delivery instructions, gate code, recipient note..."
            className="w-full rounded-[9px] border border-field-border bg-field px-3 py-2 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-faint focus:border-accent"
          />
        </div>
      </form>
    </Modal>
  );
};
