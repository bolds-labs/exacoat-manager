import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Order } from '../../types';
import { formatDate } from '../../lib/formatters';
import { 
  Printer, 
  Truck, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Layers
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../../context/ToastContext';

interface ShippingLabelA6ModalProps {
  order?: Order | null;
  orders?: Order[];
  isOpen: boolean;
  onClose: () => void;
}

// Generate realistic Code-128 SVG barcode pattern from numeric/alphanumeric code with dynamic totalWidth for 100% full width edge-to-edge stretching
function generateBarcodeSvgData(code: string, height: number = 44) {
  const clean = (code || '10001').toUpperCase().replace(/[^A-Z0-9]/g, '');
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
  const elements = bars.map((bar, idx) => {
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
  }).filter(Boolean) as { key: number; x: number; width: number; height: number }[];

  return {
    totalWidth: currentX,
    elements,
  };
}

export const ShippingLabelA6Modal: React.FC<ShippingLabelA6ModalProps> = ({
  order,
  orders,
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const labelRef = useRef<HTMLDivElement>(null);

  const activeOrdersList = (orders && orders.length > 0) ? orders : (order ? [order] : []);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Active current order
  const activeOrder = activeOrdersList[currentIndex] || activeOrdersList[0] || null;

  // Reset index when orders list changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [orders, order]);

  // Editable label fields
  const [courierName, setCourierName] = useState<string>('JNE Express');
  const [trackingNo, setTrackingNo] = useState<string>('');
  const [handlingNote, setHandlingNote] = useState<string>('FRAGILE • DO NOT BEND • KEEP DRY');

  // Sync state whenever active order changes
  useEffect(() => {
    if (activeOrder) {
      setCourierName(activeOrder.tracking?.courier || 'JNE Express');
      const rawTrack = String(activeOrder.tracking?.tracking_number || '').trim();
      setTrackingNo(rawTrack && !rawTrack.startsWith('field_') ? rawTrack : '');
    }
  }, [activeOrder]);

  if (!isOpen || activeOrdersList.length === 0 || !activeOrder) return null;

  const cleanOrderNum = String(activeOrder.order_number || activeOrder.id || '').replace(/^#+/, '');

  // Format recipient full address
  const shipping = activeOrder.shipping || {};
  const recipientName = activeOrder.customer_name || `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Collector';
  const recipientPhone = activeOrder.customer_phone || shipping.phone || '-';
  const addressLine1 = shipping.address_1 || 'Address on file';
  const addressLine2 = shipping.address_2 || shipping.address_2_extra || '';
  const city = shipping.city || '';
  const state = shipping.state || '';
  const postcode = shipping.postcode || '';
  const country = shipping.country || 'ID';

  const fullAddressLines = [
    addressLine1,
    addressLine2,
    [city, state, postcode].filter(Boolean).join(', '),
    country,
  ].filter(Boolean);

  // Barcode ALWAYS encodes the clean order reference
  const orderBarcodeVal = cleanOrderNum;
  const barcodeData = generateBarcodeSvgData(orderBarcodeVal, 44);

  // Generate single label HTML for print document
  const renderSingleLabelHtml = (ord: Order, index: number) => {
    const cOrderNum = String(ord.order_number || ord.id || '').replace(/^#+/, '');
    const shp = ord.shipping || {};
    const rName = ord.customer_name || `${shp.first_name || ''} ${shp.last_name || ''}`.trim() || 'Collector';
    const rPhone = ord.customer_phone || shp.phone || '-';
    const rAddrLines = [
      shp.address_1 || 'Address on file',
      shp.address_2 || shp.address_2_extra || '',
      [shp.city || '', shp.state || '', shp.postcode || ''].filter(Boolean).join(', '),
      shp.country || 'ID',
    ].filter(Boolean);

    const cCourier = (index === currentIndex ? courierName : (ord.tracking?.courier || courierName)) || 'JNE Express';
    const rawTrk = (index === currentIndex ? trackingNo : (ord.tracking?.tracking_number || ''));
    const validTrk = rawTrk && !rawTrk.startsWith('field_') ? rawTrk : '';

    const bData = generateBarcodeSvgData(cOrderNum, 44);
    const bSvgRects = bData.elements
      .map(el => `<rect x="${el.x}" y="0" width="${el.width}" height="44" fill="#000" />`)
      .join('');

    const itmsHtml = (ord.items || []).map((item) => {
      const itemSku = item.sku 
        ? item.sku 
        : (item.product_id ? `SKU${item.product_id}` : `SKU${item.id || '72572'}`);

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 4px 6px; font-weight: 800; width: 32px; text-align: center; font-size: 11px;">${item.quantity}x</td>
          <td style="padding: 4px 6px; font-size: 11px; font-weight: 700; color: #111;">${item.name || 'Precision Device Skin'}</td>
          <td style="padding: 4px 6px; font-size: 10.5px; text-align: right; color: #333; font-family: monospace; font-weight: 800;">${itemSku}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="label-container ${index < activeOrdersList.length - 1 ? 'page-break' : ''}">
        
        <!-- Top Section: Minimalist Logo Header + VERY TOP SHIP TO -->
        <div>
          <!-- Header Row: Logo & Date -->
          <div class="header-row">
            <div>
              <div style="font-size: 14px; font-weight: 900; font-family: monospace; letter-spacing: 1px;">EXACOAT</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 13px; font-weight: 900; font-family: monospace;">#${cOrderNum}</div>
              <div style="font-size: 9px; color: #444; font-weight: 700;">${formatDate(ord.created_at)}</div>
            </div>
          </div>

          <!-- VERY TOP: Recipient Section (Large Address Text) -->
          <div class="recipient-box">
            <div style="font-size: 8.5px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">SHIP TO / DELIVER TO:</div>
            <div class="recipient-name">${rName}</div>
            <div class="recipient-phone">Tel: ${rPhone}</div>
            <div class="recipient-address">
              ${rAddrLines.join('<br />')}
            </div>
          </div>
        </div>

        <!-- Mid Section: FROM on Left, CARRIER on Right -->
        <div class="mid-row">
          <div class="mid-from">
            <div class="tag-label">FROM:</div>
            <div class="from-brand">EXACOAT</div>
            <div class="from-contact">support@exacoat.com &bull; exacoat.com</div>
          </div>

          <div class="mid-carrier">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="tag-label">CARRIER:</span>
              <span class="carrier-badge">${cCourier.toUpperCase()}</span>
            </div>
            <div class="carrier-meta">
              <span>STD AIR / ROAD</span>
              <span>DEST: <strong>${shp.country || 'ID'}</strong></span>
            </div>
          </div>
        </div>

        <!-- Order Ref Barcode (ALWAYS Order Reference, with optional Tracking Header) -->
        <div class="barcode-section">
          ${validTrk ? `
            <div style="font-size: 8.5px; font-weight: 800; font-family: monospace; color: #222; text-transform: uppercase; margin-bottom: 2px; border-bottom: 1px dashed #ccc; padding-bottom: 2px; display: flex; justify-content: space-between;">
              <span>TRACKING NUMBER:</span>
              <strong>${validTrk}</strong>
            </div>
          ` : ''}
          <div class="barcode-header">ORDER REF #${cOrderNum}</div>
          <div class="barcode-wrapper">
            <svg width="100%" height="42" viewBox="0 0 ${bData.totalWidth} 44" preserveAspectRatio="none" style="display: block; width: 100%;">
              ${bSvgRects}
            </svg>
          </div>
        </div>

        <!-- Manifest / Contents Declaration (Item Name + Quantity + SKU) -->
        <div style="margin: 2px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 8.5px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px;">
            <span>MANIFEST DECLARATION (${ord.item_count || ord.items?.length || 1} PCS)</span>
            <span>PREMIUM DEVICE SKINS</span>
          </div>
          <table class="manifest-table">
            <tbody>
              ${itmsHtml}
            </tbody>
          </table>
        </div>

        <!-- Bottom Caution Strip & Footer -->
        <div>
          <div class="caution-bar">
            &#9650; ${handlingNote} &#9650;
          </div>
          <div class="footer-box">
            <span>EXACOAT VERIFIED</span>
            <span>ORDER #${cOrderNum}</span>
            <span>HANDLE WITH CARE</span>
          </div>
        </div>

      </div>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=950');
    if (!printWindow) {
      showToast('error', 'Popup Blocked', 'Please allow popups to print shipping labels.');
      return;
    }

    const allLabelsHtml = activeOrdersList.map((ord, idx) => renderSingleLabelHtml(ord, idx)).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Shipping Labels (${activeOrdersList.length} Order${activeOrdersList.length > 1 ? 's' : ''})</title>
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
          body {
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
            padding: 4.5mm;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          .header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
          }
          .recipient-box {
            padding: 7px 0 6px;
            line-height: 1.35;
          }
          .recipient-name {
            font-size: 17px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            margin-top: 2px;
          }
          .recipient-phone {
            font-size: 12.5px;
            font-weight: 800;
            margin: 2px 0;
          }
          .recipient-address {
            font-size: 12.5px;
            font-weight: 700;
            margin-top: 2px;
            color: #111;
            line-height: 1.35;
          }
          .mid-row {
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            display: flex;
            min-height: 56px;
          }
          .mid-from {
            width: 50%;
            border-right: 2px solid #000;
            padding: 5px 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .mid-carrier {
            width: 50%;
            padding: 5px 8px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #fbfbfb;
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
            margin: 1px 0;
          }
          .from-contact {
            font-size: 9.5px;
            color: #222;
          }
          .carrier-badge {
            background: #000;
            color: #fff;
            font-size: 9.5px;
            font-weight: 900;
            padding: 2px 6px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
          }
          .carrier-meta {
            display: flex;
            justify-content: space-between;
            font-size: 7.5px;
            font-weight: 700;
            color: #333;
            margin-top: 2px;
          }
          .barcode-section {
            border-bottom: 2px solid #000;
            padding: 2px 0 5px;
          }
          .barcode-header {
            font-size: 11px;
            font-family: monospace;
            font-weight: 900;
            color: #000;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
          }
          .barcode-wrapper {
            width: 100%;
          }
          .manifest-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
            margin-top: 3px;
          }
          .caution-bar {
            background: #000;
            color: #fff;
            padding: 7px 8px;
            font-size: 10px;
            font-weight: 900;
            text-align: center;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            margin-bottom: 4px;
            border-radius: 2px;
          }
          .footer-box {
            border-top: 1.5px solid #000;
            padding-top: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        ${allLabelsHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2.5">
          <Truck className="w-5 h-5 text-[#f3aa18]" />
          <span className="text-base font-bold text-white font-sans">
            {activeOrdersList.length > 1
              ? `Bulk Shipping Labels (${activeOrdersList.length} Orders)`
              : `Shipping Label &bull; Order #${cleanOrderNum}`}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
            4&times;6" Thermal
          </span>
        </div>
      }
      subtitle={
        activeOrdersList.length > 1
          ? `Batch printing ${activeOrdersList.length} shipping labels formatted for 4×6" thermal printers.`
          : 'Courier dispatch label formatted for 4×6 inch thermal printers or A6 sheet printers.'
      }
      footer={
        <div className="flex items-center justify-between w-full font-sans">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Barcode strictly encodes internal Order Ref #{cleanOrderNum}.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs font-semibold border border-white/[0.08] transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-[#0a0a0a] text-xs font-bold font-sans flex items-center gap-2 shadow-lg shadow-[#f3aa18]/10 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>
                {activeOrdersList.length > 1 ? `Print All (${activeOrdersList.length}) Labels` : 'Print 4×6 Label'}
              </span>
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Label Configuration & Multi-Order Navigation */}
        <div className="md:col-span-5 space-y-4 font-sans text-xs">
          
          {/* Multi-Order Carousel Selector if bulk printing */}
          {activeOrdersList.length > 1 && (
            <div className="p-3.5 rounded-xl bg-[#141414] border border-[#f3aa18]/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f3aa18] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Order {currentIndex + 1} of {activeOrdersList.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                    className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white transition-all"
                    title="Previous Order"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex === activeOrdersList.length - 1}
                    onClick={() => setCurrentIndex(i => Math.min(activeOrdersList.length - 1, i + 1))}
                    className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white transition-all"
                    title="Next Order"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-white">#{cleanOrderNum}</span>
                <span className="text-neutral-400 truncate max-w-[150px]">{recipientName}</span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-3.5">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#f3aa18]" />
              Courier & Tracking Options
            </h4>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Courier Name
              </label>
              <input
                type="text"
                value={courierName}
                onChange={e => setCourierName(e.target.value)}
                placeholder="e.g. JNE Express, DHL, FedEx, SiCepat"
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#f3aa18] transition-colors font-sans font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Tracking / Waybill No.
                </label>
                <span className="text-[9px] text-neutral-500 font-mono">Optional</span>
              </div>
              <input
                type="text"
                value={trackingNo}
                onChange={e => setTrackingNo(e.target.value)}
                placeholder="Leave blank if not yet generated"
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#f3aa18] transition-colors font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Handling / Caution Note
              </label>
              <input
                type="text"
                value={handlingNote}
                onChange={e => setHandlingNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#f3aa18] transition-colors font-sans"
              />
            </div>
          </div>

          {/* Sender Overview Card */}
          <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
              Sender Details (Fixed)
            </span>
            <div className="text-xs text-neutral-300 font-sans leading-relaxed">
              <p className="font-bold text-white uppercase">Exacoat</p>
              <p className="font-mono text-[#f3aa18] font-bold">support@exacoat.com</p>
            </div>
          </div>
        </div>

        {/* Right Column: Live 4x6 Label Preview Identical to Print Output */}
        <div className="md:col-span-7 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-sans">
              Print Preview {activeOrdersList.length > 1 ? `(${currentIndex + 1} of ${activeOrdersList.length})` : '(4×6" Format)'}
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              100mm &times; 150mm &bull; Border-Free Thermal
            </span>
          </div>

          {/* Clean 4x6 White Canvas Label Card (NO Outer Border, Identical Layout) */}
          <div 
            ref={labelRef}
            className="w-full max-w-[340px] bg-white text-black p-4 rounded-md shadow-2xl flex flex-col justify-between select-none"
            style={{ 
              aspectRatio: '4/6', 
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            }}
          >
            {/* Top Section: Minimalist Logo + VERY TOP SHIP TO */}
            <div>
              {/* Header: Minimalist Logo + Order Ref */}
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div>
                  <span className="font-mono font-black text-sm tracking-wider uppercase">EXACOAT</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xs block leading-tight">#{cleanOrderNum}</span>
                  <span className="text-[8.5px] text-neutral-600 font-bold">{formatDate(activeOrder.created_at)}</span>
                </div>
              </div>

              {/* VERY TOP: Recipient Section (Large Address Text) */}
              <div className="py-2.5 leading-snug">
                <span className="font-extrabold text-[8px] text-neutral-500 uppercase tracking-wide block">
                  SHIP TO / DELIVER TO:
                </span>
                <p className="font-black text-[15px] uppercase tracking-tight text-black mt-0.5">
                  {recipientName}
                </p>
                <p className="font-extrabold text-[11px] text-black">Tel: {recipientPhone}</p>
                <div className="text-[11px] text-neutral-900 font-bold mt-1 leading-tight">
                  {fullAddressLines.map((line, idx) => (
                    <span key={idx} className="block">{line}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Mid Section: FROM on Left, CARRIER on Right */}
            <div className="my-1 border-y-2 border-black flex min-h-[56px]">
              {/* Left: FROM */}
              <div className="w-[50%] border-r-2 border-black p-1.5 flex flex-col justify-center">
                <span className="text-[7px] font-bold text-neutral-500 uppercase block">FROM:</span>
                <span className="font-black text-[10px] uppercase block">EXACOAT</span>
                <span className="text-[8.5px] text-neutral-800 font-mono block">Tel: <strong>+62-813-800-9060</strong></span>
              </div>

              {/* Right: CARRIER */}
              <div className="w-[50%] p-1.5 bg-neutral-50/60 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[7px] font-bold text-neutral-500 uppercase">CARRIER:</span>
                  <span className="px-1.5 py-0.5 rounded bg-black text-white text-[8px] font-black uppercase tracking-wider">
                    {courierName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[7px] font-bold text-neutral-700 mt-1">
                  <span>STD AIR / ROAD</span>
                  <span>DEST: {country}</span>
                </div>
              </div>
            </div>

            {/* Order Ref Barcode (ALWAYS Order Reference, with optional Tracking Header) */}
            <div className="border-b-2 border-black pb-1.5 mb-1 pt-0.5">
              {trackingNo ? (
                <div className="text-[8px] font-mono font-bold text-neutral-800 uppercase tracking-tight mb-0.5 border-b border-dashed border-neutral-300 pb-0.5 flex items-center justify-between">
                  <span>TRACKING NUMBER:</span>
                  <span className="font-black text-black">{trackingNo}</span>
                </div>
              ) : null}
              <div className="font-mono font-black text-[10px] text-black tracking-tight mb-0.5">
                ORDER REF #{cleanOrderNum}
              </div>
              <div className="w-full">
                <svg width="100%" height="36" viewBox={`0 0 ${barcodeData.totalWidth} 44`} preserveAspectRatio="none" className="w-full block">
                  {barcodeData.elements.map(el => (
                    <rect key={el.key} x={el.x} y={0} width={el.width} height={44} fill="#000000" />
                  ))}
                </svg>
              </div>
            </div>

            {/* Package Contents Declaration (Product Name + Quantity + SKU) */}
            <div className="my-1">
              <div className="flex items-center justify-between border-b border-black pb-0.5 text-[7.5px] font-black uppercase">
                <span>MANIFEST DECLARATION ({activeOrder.item_count || activeOrder.items?.length || 1} PCS)</span>
                <span>ORIGINAL EXACOAT PRODUCTS</span>
              </div>
              <div className="space-y-1 mt-1 max-h-24 overflow-hidden text-[8.5px]">
                {(activeOrder.items || []).slice(0, 3).map((item, idx) => {
                  const itemSku = item.sku 
                    ? item.sku 
                    : (item.product_id ? `SKU${item.product_id}` : `SKU${item.id || '72572'}`);

                  return (
                    <div key={idx} className="flex items-center justify-between font-medium">
                      <span className="font-bold truncate max-w-[200px] text-black">
                        {item.quantity}x {item.name || 'Precision Device Skin'}
                      </span>
                      <span className="text-[7.5px] text-neutral-700 font-mono font-bold">{itemSku}</span>
                    </div>
                  );
                })}
                {(activeOrder.items || []).length > 3 && (
                  <div className="text-[7.5px] text-neutral-500 italic">
                    + {(activeOrder.items || []).length - 3} more items...
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Caution Strip (Taller & Bigger) & Non-Bendable Art Footer */}
            <div>
              <div className="bg-black text-white text-[9px] font-black text-center py-2 tracking-wider uppercase rounded-xs">
                ▲ {handlingNote} ▲
              </div>
              <div className="flex items-center justify-between pt-1 text-[7.5px] font-black text-neutral-600">
                <span>EXACOAT VERIFIED</span>
                <span>ORDER #{cleanOrderNum}</span>
                <span>PREMIUM SKINS & COATINGS</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </Modal>
  );
};
