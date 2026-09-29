import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { normalizeIndonesianPhone } from '../../lib/phoneUtils';
import { Copy, Check, ExternalLink, MessageCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

export interface WhatsAppContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone?: string | null;
  customerName?: string | null;
  orderNumber?: string | number | null;
  trackingNumber?: string | null;
}

type TemplateKey = 'followup' | 'shipping' | 'payment' | 'blank';

export const WhatsAppContactModal: React.FC<WhatsAppContactModalProps> = ({
  isOpen,
  onClose,
  phone,
  customerName,
  orderNumber,
  trackingNumber,
}) => {
  const { showToast } = useToast();
  const [targetPhone, setTargetPhone] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('followup');
  const [message, setMessage] = useState('');
  const [copiedType, setCopiedType] = useState<'phone' | 'message' | null>(null);

  const getCleanPhone = (val: string) => {
    return normalizeIndonesianPhone(val);
  };

  const getFirstName = () => {
    const trimmed = (customerName || '').trim();
    if (!trimmed) return 'Kak';
    return trimmed.split(' ')[0] || 'Kak';
  };

  const generateTemplate = (key: TemplateKey, name: string, orderRef: string, tracking: string): string => {
    switch (key) {
      case 'followup':
        return `Halo Kak ${name}, terima kasih telah berbelanja di Exacoat.\n\nMengenai pesanan #${orderRef}, kami ingin konfirmasi terkait...`;
      case 'shipping':
        return `Halo Kak ${name}, pesanan #${orderRef} di Exacoat sudah kami proses dan dikirimkan.\n\nNomor Resi: ${tracking || '[nomor resi]'}\nKamu dapat melacak pengiriman melalui aplikasi kurir terkait. Terima kasih telah berbelanja di Exacoat!`;
      case 'payment':
        return `Halo Kak ${name}, kami dari tim Exacoat ingin konfirmasi terkait pembayaran untuk pesanan #${orderRef}.\n\nJika sudah melakukan transfer, mohon bantu kirimkan bukti pembayarannya ya. Terima kasih!`;
      case 'blank':
        return '';
      default:
        return '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      const normalized = getCleanPhone(phone || '');
      setTargetPhone(normalized);
      const name = getFirstName();
      const orderRef = String(orderNumber || '');
      const track = trackingNumber || '';
      setMessage(generateTemplate(activeTemplate, name, orderRef, track));
      setCopiedType(null);
    }
  }, [isOpen, phone, customerName, orderNumber, trackingNumber]);

  const handleSelectTemplate = (key: TemplateKey) => {
    setActiveTemplate(key);
    const name = getFirstName();
    const orderRef = String(orderNumber || '');
    const track = trackingNumber || '';
    setMessage(generateTemplate(key, name, orderRef, track));
  };

  const handleCopy = async (text: string, type: 'phone' | 'message') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      showToast('success', type === 'phone' ? 'Phone Number Copied' : 'Message Copied', text.slice(0, 40));
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      showToast('error', 'Copy Failed', 'Unable to copy text to clipboard.');
    }
  };

  const handleLaunchWhatsApp = () => {
    const cleaned = getCleanPhone(targetPhone);
    if (!cleaned) {
      showToast('warning', 'Invalid Phone Number', 'Please enter a valid phone number formatted for WhatsApp.');
      return;
    }

    const encoded = encodeURIComponent(message.trim());
    const waUrl = `https://wa.me/${cleaned}${encoded ? `?text=${encoded}` : ''}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast('success', 'WhatsApp Launched', `Opened chat for ${cleaned}`);
  };

  const currentFormatted = getCleanPhone(targetPhone);
  const isValidPhone = currentFormatted.length >= 10;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <WhatsAppIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-zinc-950 dark:text-white text-base">WhatsApp Customer</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
              Direct message dispatch for Order #{orderNumber || ''}
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(currentFormatted, 'phone')}
              disabled={!currentFormatted}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Copy formatted phone number"
            >
              {copiedType === 'phone' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Phone</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleCopy(message, 'message')}
              disabled={!message.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Copy message text"
            >
              {copiedType === 'message' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleLaunchWhatsApp}
              disabled={!isValidPhone}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm hover:shadow flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Open in WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-4 text-sm text-zinc-800 dark:text-zinc-200">
        {/* Customer & Phone Card */}
        <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
                Recipient Customer
              </span>
              <div className="font-semibold text-zinc-900 dark:text-white text-sm">
                {customerName || 'No customer name'}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1">
                Raw Input Number
              </span>
              <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {phone || '(empty)'}
              </div>
            </div>
          </div>

          <div>
            <label 
              htmlFor="wa-phone-input"
              className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1"
            >
              Formatted WhatsApp Number (Editable)
            </label>
            <div className="relative">
              <input
                id="wa-phone-input"
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="628123456789"
                className="w-full pl-3 pr-24 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-lg text-sm font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs">
                {isValidPhone ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    <Check className="w-3 h-3" />
                    Valid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    <AlertCircle className="w-3 h-3" />
                    Invalid
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Target URL: <code className="text-zinc-700 dark:text-zinc-300 font-mono">wa.me/{currentFormatted || '...'}</code>
            </p>
          </div>
        </div>

        {/* Message Templates Selection */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1.5">
            Quick Message Template
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'followup', label: 'Order Follow-up' },
              { id: 'shipping', label: 'Shipping & Resi' },
              { id: 'payment', label: 'Payment Notice' },
              { id: 'blank', label: 'Custom Blank' },
            ].map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id as TemplateKey)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all text-center truncate ${
                  activeTemplate === tpl.id
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label 
              htmlFor="wa-message-textarea"
              className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Message Content
            </label>
            <span className="text-[11px] text-zinc-500 font-mono">
              {message.length} chars
            </span>
          </div>
          <textarea
            id="wa-message-textarea"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your WhatsApp message to the customer here..."
            className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  );
};
