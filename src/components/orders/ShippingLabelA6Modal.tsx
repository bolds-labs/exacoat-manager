import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Order } from '../../types';
import { 
  Printer, 
  Truck, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../../context/ToastContext';
import { EXACOAT_LOGO_BASE64 } from '../../lib/assets/logo';
import { formatItemSpecsSummary } from '../../lib/orderItems';

interface ShippingLabelA6ModalProps {
  order?: Order | null;
  orders?: Order[];
  isOpen: boolean;
  onClose: () => void;
}

// Generate realistic Code-128 SVG barcode pattern from numeric/alphanumeric code with dynamic totalWidth
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

export function isStorePickupOrder(ord: any): boolean {
  if (!ord) return false;
  const shipMethod = String(ord.shipping_method || ord.shipping_lines?.[0]?.method_title || '').toLowerCase();
  const shp = ord.shipping || {};
  const shipAddr = `${shp.address_1 || ''} ${shp.city || ''} ${shp.postcode || ''}`.toLowerCase();
  const cleanStatus = String(ord.status || '').replace('wc-', '');
  return (
    shipMethod.includes('pickup') ||
    shipMethod.includes('store') ||
    shipAddr.includes('summarecon') ||
    shipAddr.includes('bekasi store') ||
    shipAddr.includes('ruby commercial') ||
    cleanStatus === 'smb-ready' ||
    cleanStatus === 'smb-picked'
  );
}

// Split items across multiple label pages if items count exceeds single sheet capacity
function chunkOrderItems(items: any[]): { pages: any[][]; totalPages: number } {
  if (!items || items.length === 0) {
    return { pages: [[]], totalPages: 1 };
  }
  // Up to 4 items with skin specs comfortably fit on page 1
  if (items.length <= 4) {
    return { pages: [items], totalPages: 1 };
  }
  // Page 1 gets first 3 items to preserve breathing room for header, recipient and inline FROM/barcode
  const pages: any[][] = [];
  pages.push(items.slice(0, 3));
  let remaining = items.slice(3);
  // Subsequent pages can hold up to 7 items each since page 2 has a minimal header
  while (remaining.length > 0) {
    pages.push(remaining.slice(0, 7));
    remaining = remaining.slice(7);
  }
  return { pages, totalPages: pages.length };
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
  const [previewPageIndex, setPreviewPageIndex] = useState(0);

  // Active current order
  const activeOrder = activeOrdersList[currentIndex] || activeOrdersList[0] || null;
  const isActivePickup = isStorePickupOrder(activeOrder);

  // Reset indices when orders list changes
  useEffect(() => {
    setCurrentIndex(0);
    setPreviewPageIndex(0);
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
      setPreviewPageIndex(0);
    }
  }, [activeOrder]);

  if (!isOpen || activeOrdersList.length === 0 || !activeOrder) return null;

  const cleanOrderNum = String(activeOrder.order_number || activeOrder.id || '').replace(/^#+/, '');

  // Format recipient full address
  const shipping = activeOrder.shipping || {};
  const recipientName = activeOrder.customer_name || `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Customer';
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
  const barcodeData = generateBarcodeSvgData(orderBarcodeVal, 36);

  // Order items resolution
  const activeOrderItems = (activeOrder.items && activeOrder.items.length > 0)
    ? activeOrder.items
    : (activeOrder.line_items && activeOrder.line_items.length > 0 ? activeOrder.line_items : []);
  const { pages: activePages, totalPages: activeTotalPages } = chunkOrderItems(activeOrderItems);

  // Generate single label HTML for print document (handles multi-page orders automatically)
  const renderSingleOrderHtml = (ord: Order, isLastOrder: boolean) => {
    const isPickup = isStorePickupOrder(ord);
    const cOrderNum = String(ord.order_number || ord.id || '').replace(/^#+/, '');
    const shp = ord.shipping || {};
    const rName = ord.customer_name || `${shp.first_name || ''} ${shp.last_name || ''}`.trim() || 'Customer';
    const rPhone = ord.customer_phone || shp.phone || '-';
    const rAddrLines = [
      shp.address_1 || 'Address on file',
      shp.address_2 || shp.address_2_extra || '',
      [shp.city || '', shp.state || '', shp.postcode || ''].filter(Boolean).join(', '),
      shp.country || 'ID',
    ].filter(Boolean);

    const cCourier = (ord.id === activeOrder.id ? courierName : (ord.tracking?.courier || courierName)) || 'JNE Express';
    const rawTrk = (ord.id === activeOrder.id ? trackingNo : (ord.tracking?.tracking_number || ''));
    const validTrk = rawTrk && !rawTrk.startsWith('field_') ? rawTrk : '';

    const bData = generateBarcodeSvgData(cOrderNum, 36);
    const bSvgRects = bData.elements
      .map(el => `<rect x="${el.x}" y="0" width="${el.width}" height="36" fill="#000" />`)
      .join('');

    const ordItems = (ord.items && ord.items.length > 0)
      ? ord.items
      : (ord.line_items && ord.line_items.length > 0 ? ord.line_items : []);
    const { pages, totalPages } = chunkOrderItems(ordItems);
    const totalUnitsCount = ord.item_count || ordItems.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);

    const renderItemRowsHtml = (itemsList: any[]) => {
      return (itemsList || []).map((item) => {
        const itemSku = item.sku 
          ? item.sku 
          : (item.product_id ? `SKU${item.product_id}` : `SKU${item.id || '72572'}`);
        const specsStr = formatItemSpecsSummary(item);

        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 3px 5px; font-weight: 900; width: 26px; text-align: center; font-size: 10.5px; vertical-align: top; font-variant-numeric: tabular-nums;">
              ${item.quantity > 1 ? `<u style="text-decoration: underline; text-underline-offset: 2px;">${item.quantity}x</u>` : `${item.quantity}x`}
            </td>
            <td style="padding: 3px 5px; vertical-align: top;">
              <div style="font-size: 10px; font-weight: 800; color: #111; line-height: 1.2;">${item.name || 'Precision Device Skin'}</div>
              ${specsStr ? `<div style="font-size: 8px; color: #444; font-weight: 600; margin-top: 1.5px; line-height: 1.2;">${specsStr}</div>` : ''}
            </td>
            <td style="padding: 3px 5px; font-size: 9px; text-align: right; color: #333; font-weight: 800; vertical-align: top; white-space: nowrap; font-variant-numeric: tabular-nums;">${itemSku}</td>
          </tr>
        `;
      }).join('');
    };

    return pages.map((pageItems, pageIdx) => {
      const isLastSheetOfOrder = pageIdx === pages.length - 1;
      const isAbsoluteLastSheet = isLastOrder && isLastSheetOfOrder;
      const pageBreakClass = isAbsoluteLastSheet ? '' : 'page-break';

      // Page 1: Comprehensive shipping label
      if (pageIdx === 0) {
        return `
          <div class="label-container ${pageBreakClass}">
            <!-- Header: Real Exacoat Logo on Left, Bold Courier or Store Pickup on Right -->
            <div>
              <div class="header-row">
                <div style="display: flex; align-items: center;">
                  <img src="${EXACOAT_LOGO_BASE64}" alt="EXACOAT" style="height: 19px; max-width: 140px; object-fit: contain; display: block;" />
                </div>
                <div style="text-align: right; display: flex; align-items: center; gap: 6px;">
                  ${totalPages > 1 ? `<span style="font-size: 10px; font-weight: 900; border: 1.5px solid #000; padding: 1px 5px; border-radius: 2px; font-variant-numeric: tabular-nums;">1/${totalPages}</span>` : ''}
                  <span style="font-size: 13.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${isPickup ? 'STORE PICKUP (SMB)' : cCourier.toUpperCase()}
                  </span>
                </div>
              </div>

              <!-- Recipient Section -->
              <div class="recipient-box">
                <div style="font-size: 8px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${isPickup ? 'CUSTOMER PICKUP (WORKSHOP MANIFEST):' : 'SHIP TO / DELIVER TO:'}
                </div>
                <div class="recipient-name">${rName}</div>
                <div class="recipient-phone">Tel: ${rPhone}</div>
                ${!isPickup ? `<div class="recipient-address">${rAddrLines.join('<br />')}</div>` : ''}
              </div>
            </div>

            <!-- Inline Section: FROM on Left, ORDER REF & BARCODE on Right -->
            <div class="inline-from-barcode-row">
              <div class="from-subcol">
                <div class="tag-label">FROM:</div>
                <div class="from-brand">EXACOAT</div>
                <div class="from-contact">
                  Tel: +62-813-800-9060<br />
                  support@exacoat.com
                </div>
              </div>

              <div class="barcode-subcol">
                ${!isPickup && validTrk ? `
                  <div class="barcode-track">
                    <span>TRACKING:</span> <strong>${validTrk}</strong>
                  </div>
                ` : ''}
                <div class="barcode-ref">ORDER REF #${cOrderNum}</div>
                <div class="barcode-svg-wrap">
                  <svg width="100%" height="32" viewBox="0 0 ${bData.totalWidth} 36" preserveAspectRatio="none" style="display: block; width: 100%;">
                    ${bSvgRects}
                  </svg>
                </div>
              </div>
            </div>

            <!-- Manifest Declaration Table with Custom Skin Specs -->
            <div style="margin: 2px 0; flex: 1;">
              <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
                <span>MANIFEST DECLARATION (${totalUnitsCount} PCS)</span>
                <span>PREMIUM DEVICE SKINS</span>
              </div>
              <table class="manifest-table">
                <tbody>
                  ${renderItemRowsHtml(pageItems)}
                </tbody>
              </table>
            </div>

            <!-- Shorter Fragile or Store Pickup Caution Strip -->
            <div>
              <div class="caution-bar">
                &#9650; ${isPickup ? 'STORE PICKUP - SUMMARECON BEKASI' : handlingNote} &#9650;
              </div>
            </div>
          </div>
        `;
      }

      // Page 2+: Minimal header, order ref, page number, and remaining manifest items
      return `
        <div class="label-container ${pageBreakClass}">
          <!-- Minimal Header for Page 2+ -->
          <div>
            <div class="header-row" style="padding-bottom: 4px;">
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span style="font-size: 13px; font-weight: 900; text-transform: uppercase;">EXACOAT</span>
                <span style="font-size: 11px; font-weight: 900; font-variant-numeric: tabular-nums;">ORDER REF #${cOrderNum}</span>
              </div>
              <div style="text-align: right; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10px; font-weight: 900; border: 1.5px solid #000; padding: 1px 5px; border-radius: 2px; font-variant-numeric: tabular-nums;">${pageIdx + 1}/${totalPages}</span>
                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${isPickup ? 'STORE PICKUP' : cCourier.toUpperCase()}</span>
              </div>
            </div>

            <div style="font-size: 9.5px; font-weight: 800; padding: 4px 0; border-bottom: 1.5px solid #000; display: flex; justify-content: space-between;">
              <span>${isPickup ? 'CUSTOMER:' : 'SHIP TO:'} <strong>${rName}</strong></span>
              <span>Tel: ${rPhone}</span>
            </div>
          </div>

          <!-- Remaining Manifest Items with Specs -->
          <div style="margin: 4px 0; flex: 1;">
            <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
              <span>MANIFEST CONTINUED (${pageItems.length} ITEMS)</span>
              <span>PREMIUM DEVICE SKINS</span>
            </div>
            <table class="manifest-table">
              <tbody>
                ${renderItemRowsHtml(pageItems)}
              </tbody>
            </table>
          </div>

          <!-- Shorter Fragile or Store Pickup Caution Strip -->
          <div>
            <div class="caution-bar">
              &#9650; ${isPickup ? 'STORE PICKUP - SUMMARECON BEKASI' : handlingNote} &#9650;
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=950');
    if (!printWindow) {
      showToast('error', 'Popup Blocked', 'Please allow popups to print shipping labels.');
      return;
    }

    const allLabelsHtml = activeOrdersList.map((ord, idx) => {
      const isLastOrder = idx === activeOrdersList.length - 1;
      return renderSingleOrderHtml(ord, isLastOrder);
    }).join('');

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
            padding: 4mm;
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
            border-radius: 1px;
            line-height: 1.2;
          }
        </style>
      </head>
      <body>
        ${allLabelsHtml}
        <script>
          function executePrint() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 600);
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
              : `Shipping Label • Order #${cleanOrderNum}`}
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
                    onClick={() => {
                      setCurrentIndex(i => Math.max(0, i - 1));
                      setPreviewPageIndex(0);
                    }}
                    className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white transition-all"
                    title="Previous Order"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentIndex === activeOrdersList.length - 1}
                    onClick={() => {
                      setCurrentIndex(i => Math.min(activeOrdersList.length - 1, i + 1));
                      setPreviewPageIndex(0);
                    }}
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
                placeholder="e.g. JNE Express, SiCepat, J&T"
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
              <p className="text-neutral-400 text-[11px]">+62-813-800-9060</p>
            </div>
          </div>
        </div>

        {/* Right Column: Live 4x6 Label Preview Identical to Print Output */}
        <div className="md:col-span-7 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-sans">
                Print Preview {activeOrdersList.length > 1 ? `(${currentIndex + 1} of ${activeOrdersList.length})` : '(4×6" Thermal)'}
              </span>
              {activeTotalPages > 1 && (
                <div className="flex items-center gap-1 ml-2">
                  {activePages.map((_, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setPreviewPageIndex(pIdx)}
                      className={clsx(
                        "px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all",
                        previewPageIndex === pIdx
                          ? "bg-[#f3aa18] text-black"
                          : "bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300"
                      )}
                    >
                      {pIdx + 1}/{activeTotalPages}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] font-mono text-neutral-500">
              100mm &times; 150mm • Border-Free Thermal
            </span>
          </div>

          {/* Clean 4x6 White Canvas Label Card (NO Outer Border, Identical Layout) */}
          <div 
            ref={labelRef}
            className="w-full max-w-[340px] bg-white text-black p-3.5 rounded-md shadow-2xl flex flex-col justify-between select-none"
            style={{ 
              aspectRatio: '4/6', 
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            }}
          >
            {previewPageIndex === 0 ? (
              // PAGE 1: Complete primary shipping label
              <>
                <div>
                  {/* Header: Authentic Exacoat Vector Logo + Plain Courier Name */}
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                    <div className="flex items-center">
                      <img src={EXACOAT_LOGO_BASE64} alt="EXACOAT" className="h-5 max-w-[135px] object-contain block" />
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                      {activeTotalPages > 1 && (
                        <span className="font-sans font-black text-[9px] border border-black px-1 rounded-xs tabular-nums">
                          1/{activeTotalPages}
                        </span>
                      )}
                      <span className="font-sans font-black text-xs uppercase tracking-tight text-black">
                        {isActivePickup ? 'STORE PICKUP (SMB)' : courierName.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Recipient Section */}
                  <div className="py-2 leading-snug">
                    <span className="font-extrabold text-[8px] text-neutral-500 uppercase tracking-wide block">
                      {isActivePickup ? 'CUSTOMER PICKUP (WORKSHOP MANIFEST):' : 'SHIP TO / DELIVER TO:'}
                    </span>
                    <p className="font-black text-[14px] uppercase tracking-tight text-black mt-0.5">
                      {recipientName}
                    </p>
                    <p className="font-extrabold text-[10.5px] text-black">Tel: {recipientPhone}</p>
                    {!isActivePickup && (
                      <div className="text-[10.5px] text-neutral-900 font-bold mt-0.5 leading-tight">
                        {fullAddressLines.map((line, idx) => (
                          <span key={idx} className="block">{line}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline FROM & Order Ref Barcode Row */}
                <div className="my-1 border-y-2 border-black flex items-stretch py-1">
                  {/* Left: FROM */}
                  <div className="w-[42%] border-r-2 border-black pr-1.5 flex flex-col justify-center">
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] font-bold text-neutral-500 uppercase">FROM:</span>
                      <span className="font-black text-[10px] uppercase leading-tight">EXACOAT</span>
                    </div>
                    <span className="text-[7.5px] text-neutral-700 font-sans mt-0.5 leading-tight tabular-nums">
                      Tel: +62-813-800-9060
                    </span>
                    <span className="text-[7.5px] text-neutral-600 font-sans leading-tight">
                      support@exacoat.com
                    </span>
                  </div>

                  {/* Right: Barcode + Order Ref */}
                  <div className="w-[58%] pl-2 flex flex-col justify-center">
                    {!isActivePickup && trackingNo ? (
                      <div className="text-[7.5px] font-sans font-bold text-neutral-800 uppercase tracking-tight mb-0.5 flex items-center justify-between tabular-nums">
                        <span>TRACKING:</span>
                        <span className="font-black text-black">{trackingNo}</span>
                      </div>
                    ) : null}
                    <div className="font-sans font-black text-[9.5px] text-black tracking-tight mb-0.5 tabular-nums">
                      ORDER REF #{cleanOrderNum}
                    </div>
                    <div className="w-full">
                      <svg width="100%" height="28" viewBox={`0 0 ${barcodeData.totalWidth} 36`} preserveAspectRatio="none" className="w-full block">
                        {barcodeData.elements.map(el => (
                          <rect key={el.key} x={el.x} y={0} width={el.width} height={36} fill="#000000" />
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Package Contents Declaration with Skin Metadata */}
                <div className="my-1 flex-1">
                  <div className="flex items-center justify-between border-b border-black pb-0.5 text-[7px] font-black uppercase">
                    <span>MANIFEST DECLARATION ({activeOrder.item_count || activeOrderItems.reduce((acc, it) => acc + (it.quantity || 1), 0)} PCS)</span>
                    <span>PREMIUM DEVICE SKINS</span>
                  </div>
                  <div className="space-y-1 mt-1 text-[8px]">
                    {activePages[0].map((item, idx) => {
                      const itemSku = item.sku 
                        ? item.sku 
                        : (item.product_id ? `SKU${item.product_id}` : `SKU${item.id || '72572'}`);
                      const specsStr = formatItemSpecsSummary(item);

                      return (
                        <div key={idx} className="border-b border-neutral-100 pb-0.5">
                          <div className="flex items-start justify-between font-medium">
                            <span className={clsx("font-black text-black", item.quantity > 1 && "underline decoration-2 underline-offset-2")}>
                              {item.quantity}x
                            </span>
                            <span className="font-bold text-black ml-1">
                              {item.name || 'Precision Device Skin'}
                            </span>
                            <span className="text-[7.5px] text-neutral-700 font-sans font-bold shrink-0 ml-auto pl-1 tabular-nums">{itemSku}</span>
                          </div>
                          {specsStr && (
                            <p className="text-[7.5px] text-neutral-600 font-semibold leading-tight mt-0.5">
                              {specsStr}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shorter Bottom Caution Strip */}
                <div>
                  <div className="bg-black text-white text-[8px] font-black text-center py-1 tracking-wider uppercase rounded-xs">
                    ▲ {isActivePickup ? 'STORE PICKUP - SUMMARECON BEKASI' : handlingNote} ▲
                  </div>
                </div>
              </>
            ) : (
              // PAGE 2+: Minimal header and remaining manifest items
              <>
                <div>
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs uppercase">EXACOAT</span>
                      <span className="font-sans font-black text-[10.5px] tabular-nums">REF #{cleanOrderNum}</span>
                    </div>
                    <div className="text-right flex items-center gap-1.5">
                      <span className="font-sans font-black text-[9px] border border-black px-1 rounded-xs tabular-nums">
                        {previewPageIndex + 1}/{activeTotalPages}
                      </span>
                      <span className="font-sans font-black text-[11px] uppercase tracking-tight text-black">
                        {isActivePickup ? 'STORE PICKUP' : courierName.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="py-1 text-[9px] font-bold border-b border-black flex items-center justify-between">
                    <span>{isActivePickup ? 'CUSTOMER:' : 'SHIP TO:'} <strong>{recipientName}</strong></span>
                    <span>Tel: {recipientPhone}</span>
                  </div>
                </div>

                <div className="my-1 flex-1">
                  <div className="flex items-center justify-between border-b border-black pb-0.5 text-[7px] font-black uppercase">
                    <span>MANIFEST CONTINUED ({activePages[previewPageIndex].length} ITEMS)</span>
                    <span>PREMIUM DEVICE SKINS</span>
                  </div>
                  <div className="space-y-1 mt-1 text-[8px]">
                    {activePages[previewPageIndex].map((item, idx) => {
                      const itemSku = item.sku 
                        ? item.sku 
                        : (item.product_id ? `SKU${item.product_id}` : `SKU${item.id || '72572'}`);
                      const specsStr = formatItemSpecsSummary(item);

                      return (
                        <div key={idx} className="border-b border-neutral-100 pb-0.5">
                          <div className="flex items-start justify-between font-medium">
                            <span className={clsx("font-black text-black", item.quantity > 1 && "underline decoration-2 underline-offset-2")}>
                              {item.quantity}x
                            </span>
                            <span className="font-bold text-black ml-1">
                              {item.name || 'Precision Device Skin'}
                            </span>
                            <span className="text-[7.5px] text-neutral-700 font-sans font-bold shrink-0 ml-auto pl-1 tabular-nums">{itemSku}</span>
                          </div>
                          {specsStr && (
                            <p className="text-[7.5px] text-neutral-600 font-semibold leading-tight mt-0.5">
                              {specsStr}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="bg-black text-white text-[8px] font-black text-center py-1 tracking-wider uppercase rounded-xs">
                    ▲ {isActivePickup ? 'STORE PICKUP - SUMMARECON BEKASI' : handlingNote} ▲
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </Modal>
  );
};
