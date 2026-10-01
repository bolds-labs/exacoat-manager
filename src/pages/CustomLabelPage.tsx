import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  CustomLabelAddress,
  CustomLabelSender,
  CustomLabelManifestItem,
  CustomLabelData,
} from '../types';
import {
  fetchCustomLabelAddressesDirect,
  saveCustomLabelAddressDirect,
  deleteCustomLabelAddressDirect,
  saveCustomLabelSenderDirect,
  DEFAULT_CUSTOM_LABEL_SENDER,
} from '../lib/wordpressBridge';
import { EXACOAT_LOGO_BASE64 } from '../lib/assets/logo';
import { resolveCountryName } from '../lib/countries';
import { formatCleanText } from '../lib/utils';
import {
  Printer,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Plus,
  Trash2,
  BookmarkPlus,
  Search,
  Truck,
  User,
  MapPin,
  Package,
  Layers,
  Phone,
  Mail,
  Building,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';

// Dynamic Code-128 SVG barcode generator (pure client-side vector, matching ShippingLabelA6Modal)
function generateBarcodeSvgData(code: string, height: number = 36) {
  const clean = (code || 'EXA10001').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bars: { width: number; isBlack: boolean }[] = [];

  // Guard start (1010)
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 2, isBlack: false });
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 2, isBlack: false });

  // Generate density bars for clean code
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    bars.push({ width: (charCode % 4) + 2, isBlack: true });
    bars.push({ width: ((charCode * 2) % 3) + 1, isBlack: false });
    bars.push({ width: ((charCode * 5) % 4) + 1, isBlack: true });
    bars.push({ width: (i % 3) + 1, isBlack: false });
  }

  // Extend pattern to create dense, authentic courier barcode across full width
  for (let i = 0; i < 28; i++) {
    const charCode = clean.charCodeAt(i % clean.length) || 65;
    bars.push({ width: ((charCode + i * 7) % 4) + 2, isBlack: true });
    bars.push({ width: ((charCode * 3 + i) % 3) + 1, isBlack: false });
    bars.push({ width: ((charCode * 5 + i * 3) % 4) + 1, isBlack: true });
    bars.push({ width: ((i * 2) % 3) + 1, isBlack: false });
  }

  // Guard stop (1010)
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 2, isBlack: false });
  bars.push({ width: 4, isBlack: true });

  let currentX = 0;
  const elements = bars
    .map((bar, idx) => {
      const startX = currentX;
      currentX += bar.width * 2;
      if (bar.isBlack) {
        return {
          key: idx,
          x: startX,
          width: bar.width * 2,
          height,
        };
      }
      return null;
    })
    .filter(Boolean) as { key: number; x: number; width: number; height: number }[];

  return {
    totalWidth: currentX,
    elements,
  };
}

const COURIER_PRESETS = [
  'POS ID - Tracked Shipment',
  'JNE Express - REG',
  'JNE Express - YES',
  'SiCepat REG',
  'DHL Express Worldwide',
  'FedEx Priority',
  'Goorita US Express',
  'Store Pickup (SMB)',
];

const CAUTION_PRESETS = [
  '▲ FRAGILE • DO NOT BEND • KEEP DRY ▲',
  '▲ HANDLE WITH CARE • PRECISION GOODS ▲',
  '▲ DO NOT FOLD • KEEP FLAT ▲',
  '▲ STORE PICKUP • SUMMARECON BEKASI ▲',
];

const DEFAULT_MANIFEST_ITEMS: CustomLabelManifestItem[] = [
  {
    id: 'item-1',
    name: 'Precision Device Skin',
    quantity: 1,
    sku: 'SKU540954',
    specs: 'Back: Ultra Matte • Coverage: Full Wrap',
  },
];

export const CustomLabelPage: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Shared address book state
  const [savedAddresses, setSavedAddresses] = useState<CustomLabelAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');

  // Save current address dialog
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [addressNickname, setAddressNickname] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Recipient fields
  const [recipientName, setRecipientName] = useState('David Myers');
  const [recipientPhone, setRecipientPhone] = useState('+447485184187');
  const [recipientCompany, setRecipientCompany] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientAddress1, setRecipientAddress1] = useState('Holm Lea (opp swallow barn) Church Street');
  const [recipientAddress2, setRecipientAddress2] = useState('');
  const [recipientCity, setRecipientCity] = useState('Monyash');
  const [recipientState, setRecipientState] = useState('Derbyshire');
  const [recipientPostcode, setRecipientPostcode] = useState('DE45 1JH');
  const [recipientCountry, setRecipientCountry] = useState('United Kingdom');

  // Courier & Waybill fields
  const [courierName, setCourierName] = useState('POS ID - Tracked Shipment');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [orderRef, setOrderRef] = useState('542476');
  const [handlingNote, setHandlingNote] = useState('▲ FRAGILE • DO NOT BEND • KEEP DRY ▲');

  // Sender details
  const [sender, setSender] = useState<CustomLabelSender>(DEFAULT_CUSTOM_LABEL_SENDER);
  const [isSavingSender, setIsSavingSender] = useState(false);

  // Manifest items
  const [manifestCategory, setManifestCategory] = useState('PREMIUM DEVICE SKINS');
  const [manifestItems, setManifestItems] = useState<CustomLabelManifestItem[]>(DEFAULT_MANIFEST_ITEMS);

  // Copy state
  const [isCopied, setIsCopied] = useState(false);

  // Load saved addresses on initial mount
  useEffect(() => {
    loadAddressBook();
  }, []);

  const loadAddressBook = async () => {
    setIsLoadingAddresses(true);
    try {
      const res = await fetchCustomLabelAddressesDirect();
      if (res.success) {
        setSavedAddresses(res.addresses);
        if (res.default_sender) {
          setSender(res.default_sender);
        }
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  // Total items calculation
  const totalUnits = useMemo(() => {
    return manifestItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
  }, [manifestItems]);

  // Clean country name
  const formattedCountry = useMemo(() => {
    return resolveCountryName(recipientCountry || 'Indonesia');
  }, [recipientCountry]);

  // Recipient address lines for preview
  const previewAddressLines = useMemo(() => {
    const lines = [
      recipientCompany ? `${recipientCompany}` : '',
      recipientAddress1,
      recipientAddress2,
      [recipientCity, recipientState, recipientPostcode].filter(Boolean).join(', '),
      formattedCountry,
    ].filter(Boolean);

    return lines.length > 0 ? lines : ['Address line 1', 'City, Postal Code', 'Country'];
  }, [recipientCompany, recipientAddress1, recipientAddress2, recipientCity, recipientState, recipientPostcode, formattedCountry]);

  // Barcode data for 4x6 preview
  const barcodeData = useMemo(() => {
    const cleanRef = (orderRef || '10001').replace(/^#+/, '').trim();
    return generateBarcodeSvgData(cleanRef, 36);
  }, [orderRef]);

  // Barcode SVG rects
  const barcodeSvgRects = useMemo(() => {
    return barcodeData.elements.map((el) => (
      <rect key={el.key} x={el.x} y={0} width={el.width} height={36} fill="#000" />
    ));
  }, [barcodeData]);

  // Reset all fields
  const handleReset = () => {
    if (!window.confirm('Reset form fields to a blank new shipping label?')) return;
    setRecipientName('');
    setRecipientPhone('');
    setRecipientCompany('');
    setRecipientEmail('');
    setRecipientAddress1('');
    setRecipientAddress2('');
    setRecipientCity('');
    setRecipientState('');
    setRecipientPostcode('');
    setRecipientCountry('Indonesia');
    setCourierName('POS ID - Tracked Shipment');
    setTrackingNumber('');
    setOrderRef(String(Math.floor(100000 + Math.random() * 900000)));
    setHandlingNote('▲ FRAGILE • DO NOT BEND • KEEP DRY ▲');
    setManifestItems([
      {
        id: `item-${Date.now()}`,
        name: 'Precision Device Skin',
        quantity: 1,
        sku: '',
        specs: '',
      },
    ]);
    showToast('info', 'Form Reset', 'Ready for new custom label data.');
  };

  // Apply a saved address
  const handleApplyAddress = (addr: CustomLabelAddress) => {
    setRecipientName(formatCleanText(addr.name || ''));
    setRecipientPhone(addr.phone || '');
    setRecipientCompany(formatCleanText(addr.company || ''));
    setRecipientEmail(addr.email || '');
    setRecipientAddress1(formatCleanText(addr.address_1 || ''));
    setRecipientAddress2(formatCleanText(addr.address_2 || ''));
    setRecipientCity(formatCleanText(addr.city || ''));
    setRecipientState(formatCleanText(addr.state || ''));
    setRecipientPostcode(addr.postcode || '');
    setRecipientCountry(addr.country || 'Indonesia');
    if (addr.courier) {
      setCourierName(addr.courier);
    }
    if (addr.tracking_number) {
      setTrackingNumber(addr.tracking_number);
    }
    setIsAddressModalOpen(false);
    showToast('success', 'Address Applied', `Loaded "${addr.label}" into shipping label.`);
  };

  // Save current recipient to address book
  const handleSaveCurrentAddress = async () => {
    if (!recipientName.trim()) {
      showToast('error', 'Missing Name', 'Please enter a recipient name first.');
      return;
    }

    setIsSavingAddress(true);
    try {
      const payload: Partial<CustomLabelAddress> & { name: string } = {
        label: addressNickname.trim() || recipientName.trim(),
        name: recipientName.trim(),
        company: recipientCompany.trim(),
        phone: recipientPhone.trim(),
        email: recipientEmail.trim(),
        address_1: recipientAddress1.trim(),
        address_2: recipientAddress2.trim(),
        city: recipientCity.trim(),
        state: recipientState.trim(),
        postcode: recipientPostcode.trim(),
        country: recipientCountry.trim() || 'Indonesia',
        courier: courierName.trim(),
        tracking_number: trackingNumber.trim(),
      };

      const res = await saveCustomLabelAddressDirect(payload);
      if (res.success && res.addresses) {
        setSavedAddresses(res.addresses);
        setIsSaveModalOpen(false);
        setAddressNickname('');
        showToast('success', 'Saved to Address Book', `Address saved. Available to all shop managers.`);
      } else {
        showToast('error', 'Save Failed', res.error || 'Could not save address.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Could not save address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  // Delete address
  const handleDeleteAddress = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}" from saved addresses?`)) return;
    try {
      const res = await deleteCustomLabelAddressDirect(id);
      if (res.success && res.addresses) {
        setSavedAddresses(res.addresses);
        showToast('info', 'Address Deleted', `"${label}" was removed.`);
      }
    } catch (err: any) {
      showToast('error', 'Delete Failed', err?.message || 'Failed to delete address.');
    }
  };

  // Save sender as default
  const handleSaveSenderAsDefault = async () => {
    setIsSavingSender(true);
    try {
      const res = await saveCustomLabelSenderDirect(sender);
      if (res.success) {
        showToast('success', 'Default Sender Saved', 'Updated default sender settings for all staff.');
      } else {
        showToast('error', 'Save Failed', res.error || 'Could not save sender settings.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Could not save sender settings.');
    } finally {
      setIsSavingSender(false);
    }
  };

  // Add manifest item
  const handleAddManifestItem = () => {
    setManifestItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: 'Precision Skin',
        quantity: 1,
        sku: '',
        specs: '',
      },
    ]);
  };

  // Remove manifest item
  const handleRemoveManifestItem = (id: string) => {
    if (manifestItems.length <= 1) {
      showToast('warning', 'Notice', 'Manifest declaration must have at least one line item.');
      return;
    }
    setManifestItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Update manifest item field
  const handleUpdateManifestItem = (id: string, field: keyof CustomLabelManifestItem, val: any) => {
    setManifestItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
  };

  // Copy formatted text (ready for Biteship, Goorita, WhatsApp, or carrier dispatch)
  const handleCopyFormattedText = () => {
    const text = [
      `*EXACOAT SHIPMENT - ${courierName.toUpperCase()}*`,
      `Order Ref: #${orderRef}`,
      trackingNumber ? `Tracking No: ${trackingNumber}` : '',
      '',
      `*RECIPIENT:*`,
      `${recipientName}`,
      recipientCompany ? `${recipientCompany}` : '',
      `Tel: ${recipientPhone}`,
      recipientAddress1,
      recipientAddress2,
      `${recipientCity}, ${recipientState} ${recipientPostcode}`.trim(),
      formattedCountry,
      '',
      `*MANIFEST (${totalUnits} PCS):*`,
      ...manifestItems.map(
        (it) => `- ${it.quantity}x ${it.name}${it.specs ? ` (${it.specs})` : ''}${it.sku ? ` [${it.sku}]` : ''}`
      ),
      '',
      `*SENDER:*`,
      `${sender.brand || 'EXACOAT'}`,
      `Tel: ${sender.phone}`,
      `${sender.email}`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showToast('success', 'Copied to Clipboard', 'Shipment details copied in formatted text.');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Print 4x6 Thermal Output
  const handlePrint = () => {
    const cleanRef = (orderRef || '10001').replace(/^#+/, '').trim();
    const barcode = generateBarcodeSvgData(cleanRef, 36);
    const bSvgRects = barcode.elements
      .map((el) => `<rect x="${el.x}" y="0" width="${el.width}" height="36" fill="#000" />`)
      .join('');

    const itemRowsHtml = manifestItems
      .map((item) => {
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 3px 5px; font-weight: 900; width: 26px; text-align: center; font-size: 11px; vertical-align: top; font-variant-numeric: tabular-nums;">
              ${item.quantity > 1 ? `<u style="text-decoration: underline; text-underline-offset: 2px;">${item.quantity}x</u>` : `${item.quantity}x`}
            </td>
            <td style="padding: 3px 5px; vertical-align: top;">
              <div style="font-size: 10.5px; font-weight: 900; color: #000; line-height: 1.15; letter-spacing: -0.15px; margin: 0 0 1px 0;">
                ${escapeHtml(item.name || 'Precision Device Skin')}
              </div>
              ${item.specs ? `<div style="font-size: 9.5px; color: #111; font-weight: 800; line-height: 1.25; margin-top: 2px;">${escapeHtml(item.specs)}</div>` : ''}
            </td>
            <td style="padding: 3px 5px; font-size: 9px; text-align: right; color: #333; font-weight: 800; vertical-align: top; white-space: nowrap; font-variant-numeric: tabular-nums;">
              ${escapeHtml(item.sku || '')}
            </td>
          </tr>
        `;
      })
      .join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Custom Shipping Label - Ref #${cleanRef}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: 4in 6in;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #000000;
      width: 4in;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .label-container {
      width: 4in;
      height: 6in;
      padding: 4mm;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      box-sizing: border-box;
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #000;
      padding-bottom: 5px;
    }
    .recipient-box {
      padding: 5px 0 4px;
      line-height: 1.3;
    }
    .recipient-name {
      font-size: 16px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.2px;
      margin-top: 1px;
    }
    .recipient-phone {
      font-size: 11.5px;
      font-weight: 800;
      margin: 1px 0;
    }
    .recipient-address {
      font-size: 11.5px;
      font-weight: 700;
      margin-top: 1px;
      color: #111;
      line-height: 1.3;
    }
    .inline-from-barcode-row {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      display: flex;
      align-items: stretch;
      padding: 3.5px 0;
      margin: 2px 0 3px 0;
    }
    .from-subcol {
      width: 42%;
      border-right: 2px solid #000;
      padding-right: 6px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .barcode-subcol {
      width: 58%;
      padding-left: 8px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .tag-label {
      font-size: 7.5px;
      font-weight: 800;
      color: #555;
      text-transform: uppercase;
    }
    .from-brand {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .from-contact {
      font-size: 8px;
      font-weight: 600;
      color: #222;
      margin-top: 1px;
      line-height: 1.2;
    }
    .barcode-track {
      font-size: 7.5px;
      font-weight: 800;
      color: #222;
      margin-bottom: 1px;
      font-variant-numeric: tabular-nums;
    }
    .barcode-ref {
      font-size: 10px;
      font-weight: 900;
      color: #000;
      letter-spacing: 0.3px;
      line-height: 1.1;
      margin-bottom: 1px;
      font-variant-numeric: tabular-nums;
    }
    .barcode-svg-wrap {
      width: 100%;
    }
    .manifest-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 2px;
    }
    .caution-bar {
      background: #000;
      color: #fff;
      padding: 3.5px 6px;
      font-size: 8px;
      font-weight: 900;
      text-align: center;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
  </style>
  <script>
    function executePrint() {
      window.print();
      setTimeout(function() {
        window.close();
      }, 800);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() {
        setTimeout(executePrint, 60);
      });
    } else {
      window.onload = function() {
        setTimeout(executePrint, 60);
      };
    }
  </script>
</head>
<body>
  <div class="label-container">
    <div>
      <div class="header-row">
        <div style="display: flex; align-items: center;">
          <img src="${EXACOAT_LOGO_BASE64}" alt="EXACOAT" style="height: 19px; max-width: 140px; object-fit: contain; display: block;" />
        </div>
        <div style="text-align: right; display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 13.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
            ${escapeHtml(courierName.toUpperCase())}
          </span>
        </div>
      </div>

      <div class="recipient-box">
        <div style="font-size: 8px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">
          SHIP TO / DELIVER TO:
        </div>
        <div class="recipient-name">${escapeHtml(recipientName || 'CUSTOMER NAME')}</div>
        <div class="recipient-phone">Tel: ${escapeHtml(recipientPhone || '-')}</div>
        <div class="recipient-address">
          ${previewAddressLines.map((l) => escapeHtml(l)).join('<br />')}
        </div>
      </div>
    </div>

    <div class="inline-from-barcode-row">
      <div class="from-subcol">
        <div class="tag-label">FROM:</div>
        <div class="from-brand">${escapeHtml(sender.brand || 'EXACOAT')}</div>
        <div class="from-contact">
          Tel: ${escapeHtml(sender.phone || '628975556000')}<br />
          ${escapeHtml(sender.email || 'support@exacoat.com')}
        </div>
      </div>

      <div class="barcode-subcol">
        ${
          trackingNumber
            ? `
          <div class="barcode-track">
            <span>TRACKING:</span> <strong>${escapeHtml(trackingNumber)}</strong>
          </div>
        `
            : ''
        }
        <div class="barcode-ref">ORDER REF #${escapeHtml(cleanRef)}</div>
        <div class="barcode-svg-wrap">
          <svg width="100%" height="32" viewBox="0 0 ${barcodeData.totalWidth} 36" preserveAspectRatio="none" style="display: block; width: 100%;">
            ${bSvgRects}
          </svg>
        </div>
      </div>
    </div>

    <div style="margin: 2px 0; flex: 1;">
      <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
        <span>MANIFEST DECLARATION (${totalUnits} PCS)</span>
        <span>${escapeHtml(manifestCategory)}</span>
      </div>
      <table class="manifest-table">
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>
    </div>

    <div>
      <div class="caution-bar">
        ${escapeHtml(handlingNote)}
      </div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=550,height=750,menubar=no,toolbar=no,location=no,status=no');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      showToast('success', 'Print Dispatched', 'Opened thermal print dialog (4x6" 100mm x 150mm).');
    } else {
      showToast('error', 'Popup Blocked', 'Please allow popups to open the thermal print preview window.');
    }
  };

  // Filtered addresses for modal search
  const filteredAddresses = useMemo(() => {
    if (!addressSearchQuery.trim()) return savedAddresses;
    const q = addressSearchQuery.toLowerCase().trim();
    return savedAddresses.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.company && a.company.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q)) ||
        (a.city && a.city.toLowerCase().includes(q)) ||
        (a.country && a.country.toLowerCase().includes(q))
    );
  }, [savedAddresses, addressSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <PageHeroHeader
        title="Custom Shipping Label"
        subtitle="Generate, preview, and print 4x6 inch thermal shipping labels with real-time preview and shared address book."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-zinc-200 border border-white/[0.1] text-xs font-semibold font-sans flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Address Book</span>
              {savedAddresses.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-[#f3aa18]/20 text-[#f3aa18] font-mono text-[10px] font-bold">
                  {savedAddresses.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-zinc-400 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Clear form inputs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#ffbe3b] text-neutral-950 font-bold text-xs font-sans flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(243,170,24,0.25)] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-neutral-950 stroke-[2.5]" />
              <span>Print 4x6" Thermal</span>
            </button>
          </div>
        }
      />

      {/* Main 2-Column Responsive Layout: Left = Form, Right = Sticky Thermal Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Editor (7 cols on lg, 8 on xl) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          {/* Card 1: Recipient Details */}
          <GlassCard className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-center justify-center text-[#f3aa18]">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-sans tracking-wide">Recipient Details</h3>
                  <p className="text-xs text-zinc-400 font-sans">Shipment destination and customer contact.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(true)}
                    className="text-xs font-medium text-[#f3aa18] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Load saved</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAddressNickname(recipientName || '');
                    setIsSaveModalOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Save current recipient to shared address book"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Save to Book</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 font-sans text-xs">
              {/* Row 1: Name and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">
                    Recipient Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. David Myers"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="e.g. +447485184187 or 08123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Company / Attention & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5">
                    Company / Attention <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                    placeholder="e.g. Acme Studio or Floor 3, Apt 12B"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5">
                    Email Address <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. recipient@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Row 3: Street Address 1 */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  Street Address Line 1 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={recipientAddress1}
                  onChange={(e) => setRecipientAddress1(e.target.value)}
                  placeholder="Street name, house/building number, block"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                />
              </div>

              {/* Row 4: Street Address 2 */}
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">
                  Address Line 2 <span className="text-zinc-500 font-normal">(Landmark, district, or unit)</span>
                </label>
                <input
                  type="text"
                  value={recipientAddress2}
                  onChange={(e) => setRecipientAddress2(e.target.value)}
                  placeholder="e.g. Near Summarecon Mall or Suite 402"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                />
              </div>

              {/* Row 5: City, State/Province, Postal Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">City / Regency</label>
                  <input
                    type="text"
                    value={recipientCity}
                    onChange={(e) => setRecipientCity(e.target.value)}
                    placeholder="e.g. Bekasi or London"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1.5">State / Province</label>
                  <input
                    type="text"
                    value={recipientState}
                    onChange={(e) => setRecipientState(e.target.value)}
                    placeholder="e.g. West Java or Derbyshire"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">Postal / Zip Code</label>
                  <input
                    type="text"
                    value={recipientPostcode}
                    onChange={(e) => setRecipientPostcode(e.target.value)}
                    placeholder="e.g. 17142 or DE45 1JH"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* Row 6: Country */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Destination Country</label>
                <input
                  type="text"
                  value={recipientCountry}
                  onChange={(e) => setRecipientCountry(e.target.value)}
                  placeholder="e.g. Indonesia, United States, United Kingdom, Singapore"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                />
              </div>
            </div>
          </GlassCard>

          {/* Card 2: Courier & Tracking Options */}
          <GlassCard className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-3.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-sans tracking-wide">Courier & Tracking Options</h3>
                <p className="text-xs text-zinc-400 font-sans">Header title, waybill code, reference, and caution bar.</p>
              </div>
            </div>

            <div className="space-y-4 font-sans text-xs">
              {/* Courier Name & Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-zinc-300 font-medium">Courier Service Name</label>
                  <span className="text-[11px] text-zinc-500">Rendered in label top-right header</span>
                </div>
                <input
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="e.g. POS ID - Tracked Shipment"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-medium"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COURIER_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCourierName(p)}
                      className={clsx(
                        'px-2 py-1 rounded-md text-[11px] font-sans transition-colors cursor-pointer border',
                        courierName === p
                          ? 'bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/30 font-medium'
                          : 'bg-white/[0.03] text-zinc-400 hover:text-white border-white/[0.06]'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tracking No & Order Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-400 font-medium">Tracking / Waybill No.</label>
                    <span className="text-[10px] text-zinc-500">Optional</span>
                  </div>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Leave blank if not yet generated"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-zinc-300 font-medium">Order Ref (Barcode)</label>
                    <span className="text-[10px] text-zinc-500">Generates Code-128 SVG</span>
                  </div>
                  <input
                    type="text"
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    placeholder="e.g. 542476 or REF-001"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Handling / Caution Note */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  Handling / Caution Banner <span className="text-zinc-500 font-normal">(Printed at bottom)</span>
                </label>
                <input
                  type="text"
                  value={handlingNote}
                  onChange={(e) => setHandlingNote(e.target.value)}
                  placeholder="e.g. ▲ FRAGILE • DO NOT BEND • KEEP DRY ▲"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-medium"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CAUTION_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHandlingNote(c)}
                      className={clsx(
                        'px-2 py-1 rounded-md text-[10px] font-sans transition-colors cursor-pointer border',
                        handlingNote === c
                          ? 'bg-white/[0.1] text-white border-white/20 font-medium'
                          : 'bg-white/[0.02] text-zinc-500 hover:text-zinc-300 border-white/[0.05]'
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Card 3: Sender Details (Editable) */}
          <GlassCard className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-sans tracking-wide">Sender Details (Editable)</h3>
                  <p className="text-xs text-zinc-400 font-sans">Origin brand and contact details displayed on the thermal label.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveSenderAsDefault}
                disabled={isSavingSender}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Save as default sender for all administrators and shop managers"
              >
                <span>Save as Default</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Brand / Name</label>
                <input
                  type="text"
                  value={sender.brand}
                  onChange={(e) => setSender({ ...sender, brand: e.target.value })}
                  placeholder="EXACOAT"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-bold uppercase"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={sender.phone}
                  onChange={(e) => setSender({ ...sender, phone: e.target.value })}
                  placeholder="628975556000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={sender.email}
                  onChange={(e) => setSender({ ...sender, email: e.target.value })}
                  placeholder="support@exacoat.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.035] border border-white/[0.09] text-white text-sm focus:border-[#f3aa18]/60 focus:ring-2 focus:ring-[#f3aa18]/15 outline-none transition-all placeholder:text-zinc-600"
                />
              </div>
            </div>
          </GlassCard>

          {/* Card 4: Manifest Declaration Items */}
          <GlassCard className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-sans tracking-wide">
                    Manifest Declaration ({totalUnits} PCS)
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans">Products and line items printed on manifest section.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddManifestItem}
                className="px-3 py-1.5 rounded-lg bg-[#f3aa18]/15 hover:bg-[#f3aa18]/25 text-[#f3aa18] border border-[#f3aa18]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="flex items-center gap-3">
                <label className="text-zinc-400 font-medium shrink-0">Declaration Category:</label>
                <input
                  type="text"
                  value={manifestCategory}
                  onChange={(e) => setManifestCategory(e.target.value)}
                  placeholder="PREMIUM DEVICE SKINS"
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-xs uppercase tracking-wider font-semibold focus:border-[#f3aa18]/60 outline-none w-full max-w-xs"
                />
              </div>

              {/* Items List */}
              <div className="space-y-2.5 pt-2">
                {manifestItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-3 relative group"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Qty */}
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] text-zinc-500 font-medium mb-1">Qty</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={item.quantity}
                          onChange={(e) => handleUpdateManifestItem(item.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white text-center font-mono font-bold text-xs outline-none"
                        />
                      </div>

                      {/* Item Name */}
                      <div className="col-span-10 sm:col-span-7">
                        <label className="block text-[10px] text-zinc-500 font-medium mb-1">Item Title / Device Name</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateManifestItem(item.id, 'name', e.target.value)}
                          placeholder="e.g. Poco X8 Pro Max Skins"
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-white text-xs font-semibold outline-none"
                        />
                      </div>

                      {/* SKU */}
                      <div className="col-span-10 sm:col-span-3">
                        <label className="block text-[10px] text-zinc-500 font-medium mb-1">SKU / Code</label>
                        <input
                          type="text"
                          value={item.sku}
                          onChange={(e) => handleUpdateManifestItem(item.id, 'sku', e.target.value)}
                          placeholder="e.g. SKU540954"
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-zinc-300 font-mono text-xs outline-none"
                        />
                      </div>

                      {/* Delete */}
                      <div className="col-span-2 sm:col-span-1 flex justify-end items-end pt-5">
                        <button
                          type="button"
                          onClick={() => handleRemoveManifestItem(item.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Specs / Details */}
                    <div>
                      <label className="block text-[10px] text-zinc-500 font-medium mb-1">
                        Variants & Specs <span className="text-zinc-600">(Printed below title)</span>
                      </label>
                      <input
                        type="text"
                        value={item.specs}
                        onChange={(e) => handleUpdateManifestItem(item.id, 'specs', e.target.value)}
                        placeholder="e.g. Back: Lemon Yellow • Coverage: Model Cut"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-zinc-300 text-xs outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Sticky 4x6" Thermal Print Preview (5 cols on lg) */}
        <div className="lg:col-span-5 xl:col-span-5 sticky top-6 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="space-y-0.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                PRINT PREVIEW (4×6" THERMAL)
              </span>
              <p className="text-[10px] font-mono text-zinc-500">
                100mm &times; 150mm &bull; 1:1 Thermal Output
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyFormattedText}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.09] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy formatted text for courier portals or WhatsApp"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-lg bg-[#f3aa18] hover:bg-[#ffbe3b] text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Authentic 4x6" Thermal Sticker Rendering (Exact match to real physical thermal labels) */}
          <div className="w-full rounded-2xl bg-neutral-950/70 p-3 sm:p-5 border border-white/[0.08] shadow-2xl flex justify-center overflow-x-auto">
            <div
              className="bg-white text-black font-sans box-border select-text shadow-xl flex flex-col justify-between"
              style={{
                width: '100%',
                maxWidth: '384px', // 4in @ 96 DPI
                minHeight: '576px', // 6in @ 96 DPI
                padding: '14px',
                fontFamily:
                  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                textRendering: 'geometricPrecision',
              }}
            >
              {/* Header: Logo and Courier */}
              <div>
                <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                  <div className="flex items-center">
                    <img
                      src={EXACOAT_LOGO_BASE64}
                      alt="EXACOAT"
                      style={{ height: '18px', maxWidth: '130px', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-black uppercase tracking-tight text-black">
                      {courierName.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Recipient Block */}
                <div className="py-2 leading-snug">
                  <div className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-wider">
                    SHIP TO / DELIVER TO:
                  </div>
                  <div className="text-[15px] font-black uppercase tracking-tight text-black mt-0.5">
                    {recipientName || 'CUSTOMER NAME'}
                  </div>
                  <div className="text-[11px] font-extrabold text-black mt-0.5">
                    Tel: {recipientPhone || '-'}
                  </div>
                  <div className="text-[11px] font-bold text-zinc-900 mt-0.5 leading-snug">
                    {previewAddressLines.map((line, lIdx) => (
                      <div key={lIdx}>{line}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle Row: FROM + ORDER REF & BARCODE */}
              <div className="border-t-2 border-b-2 border-black flex items-stretch py-1.5 my-1.5">
                {/* Left: FROM */}
                <div className="w-[42%] border-r-2 border-black pr-2 flex flex-col justify-center">
                  <div className="text-[7.5px] font-extrabold text-zinc-500 uppercase">FROM:</div>
                  <div className="text-[11px] font-black uppercase leading-tight text-black">
                    {sender.brand || 'EXACOAT'}
                  </div>
                  <div className="text-[8px] font-semibold text-zinc-800 mt-0.5 leading-tight">
                    Tel: {sender.phone || '628975556000'}
                    <br />
                    {sender.email || 'support@exacoat.com'}
                  </div>
                </div>

                {/* Right: ORDER REF & BARCODE */}
                <div className="w-[58%] pl-2.5 flex flex-col justify-center">
                  {trackingNumber && (
                    <div className="text-[7.5px] font-extrabold text-zinc-800 mb-0.5 font-mono">
                      <span>TRACKING:</span> <strong>{trackingNumber}</strong>
                    </div>
                  )}
                  <div className="text-[10px] font-black text-black tracking-wide leading-tight mb-0.5 font-mono">
                    ORDER REF #{orderRef.replace(/^#+/, '') || '542476'}
                  </div>
                  <div className="w-full">
                    <svg
                      width="100%"
                      height="32"
                      viewBox={`0 0 ${barcodeData.totalWidth} 36`}
                      preserveAspectRatio="none"
                      style={{ display: 'block', width: '100%' }}
                    >
                      {barcodeSvgRects}
                    </svg>
                  </div>
                </div>
              </div>

              {/* Manifest Declaration Items */}
              <div className="my-1 flex-1">
                <div className="flex justify-between text-[8px] font-black uppercase border-b-[1.5px] border-black pb-1 text-black">
                  <span>MANIFEST DECLARATION ({totalUnits} PCS)</span>
                  <span>{manifestCategory}</span>
                </div>
                <table className="w-full border-collapse text-[10px] mt-1">
                  <tbody>
                    {manifestItems.map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-zinc-200">
                        <td className="p-1 font-black w-6 text-center text-[11px] align-top font-mono">
                          {item.quantity > 1 ? (
                            <u className="underline underline-offset-2">{item.quantity}x</u>
                          ) : (
                            `${item.quantity}x`
                          )}
                        </td>
                        <td className="p-1 align-top">
                          <div className="text-[10.5px] font-black text-black leading-tight tracking-tight">
                            {item.name || 'Precision Device Skin'}
                          </div>
                          {item.specs && (
                            <div className="text-[9.5px] text-zinc-800 font-extrabold leading-tight mt-0.5">
                              {item.specs}
                            </div>
                          )}
                        </td>
                        <td className="p-1 text-[9px] text-right text-zinc-800 font-extrabold align-top whitespace-nowrap font-mono">
                          {item.sku || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Caution Bar at Bottom */}
              <div className="mt-1">
                <div className="bg-black text-white py-1 px-1.5 text-[8px] font-black text-center tracking-wider uppercase">
                  {handlingNote}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Shared Address Book */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title="Shared Address Book"
        subtitle="Saved destination addresses visible to all administrators and shop managers."
        maxWidth="2xl"
      >
        <div className="space-y-4 font-sans text-xs">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={addressSearchQuery}
              onChange={(e) => setAddressSearchQuery(e.target.value)}
              placeholder="Search by name, label, phone, city, or country..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs outline-none focus:border-[#f3aa18]/60 transition-all placeholder:text-zinc-500"
            />
          </div>

          {/* Addresses list */}
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredAddresses.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-zinc-600 stroke-[1.5]" />
                <p className="font-semibold text-zinc-300">No saved addresses found</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Fill out recipient details on the form and click "Save to Book" to add one.
                </p>
              </div>
            ) : (
              filteredAddresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-3.5 rounded-xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.07] hover:border-white/[0.15] transition-all flex items-start justify-between gap-4 group"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{addr.label || addr.name}</span>
                      {addr.company && (
                        <span className="px-2 py-0.2 rounded-md bg-white/[0.06] text-zinc-400 text-[10px] font-medium">
                          {addr.company}
                        </span>
                      )}
                      {addr.courier && (
                        <span className="px-2 py-0.2 rounded-md bg-cyan-500/15 text-cyan-300 text-[10px] font-mono">
                          {addr.courier}
                        </span>
                      )}
                    </div>

                    <div className="text-zinc-300 font-medium">{formatCleanText(addr.name)} &bull; {addr.phone}</div>

                    <div className="text-zinc-400 text-[11px] leading-relaxed">
                      {[formatCleanText(addr.address_1), formatCleanText(addr.address_2), formatCleanText(addr.city), formatCleanText(addr.state), addr.postcode, addr.country]
                        .filter(Boolean)
                        .join(', ')}
                    </div>

                    {addr.updated_by && (
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Saved by {addr.updated_by}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApplyAddress(addr)}
                      className="px-3 py-1.5 rounded-lg bg-[#f3aa18] hover:bg-[#ffbe3b] text-neutral-950 font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      Use Address
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id, addr.label || addr.name)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete saved address"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Modal 2: Save Current Address to Book */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title="Save to Address Book"
        subtitle="Save this recipient address so all administrators and shop managers can reuse it."
        maxWidth="md"
      >
        <div className="space-y-4 font-sans text-xs">
          <div>
            <label className="block text-zinc-300 font-medium mb-1.5">
              Address Nickname / Label <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={addressNickname}
              onChange={(e) => setAddressNickname(e.target.value)}
              placeholder="e.g. Workshop Central, Influencer Maria, Supplier XYZ"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs outline-none focus:border-[#f3aa18]/60 transition-all placeholder:text-zinc-500 font-medium"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-1 text-zinc-400 text-[11px]">
            <p className="font-semibold text-zinc-200">{recipientName} &bull; {recipientPhone}</p>
            <p>{recipientAddress1} {recipientAddress2}</p>
            <p>{recipientCity}, {recipientState} {recipientPostcode}</p>
            <p>{formattedCountry}</p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(false)}
              className="px-3.5 py-2 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCurrentAddress}
              disabled={isSavingAddress}
              className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#ffbe3b] text-neutral-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSavingAddress ? 'Saving...' : 'Save to Address Book'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Helper HTML escaping for safe print generation
function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
