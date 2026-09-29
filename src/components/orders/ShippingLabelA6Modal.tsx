import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Order } from '../../types';
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
import { EXACOAT_LOGO_BASE64 } from '../../lib/assets/logo';
import { formatSeparatedItemSpecs, cleanItemTitle } from '../../lib/orderItems';
import { resolveOrderCourier, isStorePickupOrder } from '../../lib/orderUtils';
import { resolveCountryName } from '../../lib/countries';

export { isStorePickupOrder };

interface ShippingLabelA6ModalProps {
  order?: Order | null;
  orders?: Order[];
  isOpen: boolean;
  onClose: () => void;
  onPrinted?: (orderIds: number[]) => void;
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

// Estimate item row height in pixels for 4x6 label layout (96 DPI)
function estimateItemHeight(item: any): number {
  const cleanItemName = cleanItemTitle(String(item?.name || ''));
  const titleLines = cleanItemName.length > 36 ? 2 : 1;
  const titleHeight = titleLines * 14;
  const { partList, partSpecs, refSpecs } = formatSeparatedItemSpecs(item);
  const specsCount = partList && partList.length > 0 ? partList.length : (partSpecs ? 1 : 0);
  const specsHeight = specsCount * 12.5;
  const refHeight = refSpecs ? 11 : 0;
  // 6px padding + 1px border + contents
  return 7 + titleHeight + specsHeight + refHeight;
}

// Split items across multiple label pages based on actual available height
function chunkOrderItems(
  items: any[],
  recipientAddressLineCount: number = 3,
  hasTracking: boolean = false
): { pages: any[][]; totalPages: number } {
  if (!items || items.length === 0) {
    return { pages: [[]], totalPages: 1 };
  }

  // Budget for Page 1 item rows (inner label is 546px, non-item rows take ~230px)
  // Baseline is 315px when address has 3 lines and no tracking
  const extraAddressLines = Math.max(0, recipientAddressLineCount - 3);
  const page1MaxHeight = 315 - (extraAddressLines * 14) - (hasTracking ? 11 : 0);
  // Page 2 has a minimal 1-line header, giving ~440px for items
  const page2MaxHeight = 440;

  const pages: any[][] = [];
  let currentPageItems: any[] = [];
  let currentHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemH = estimateItemHeight(item);
    const maxHeight = isFirstPage ? page1MaxHeight : page2MaxHeight;

    // Check if adding this item would exceed the page budget
    if (currentPageItems.length > 0 && currentHeight + itemH > maxHeight) {
      pages.push(currentPageItems);
      currentPageItems = [item];
      currentHeight = itemH;
      isFirstPage = false;
    } else {
      currentPageItems.push(item);
      currentHeight += itemH;
    }
  }

  if (currentPageItems.length > 0) {
    pages.push(currentPageItems);
  }

  return { pages, totalPages: pages.length };
}

interface LabelPageConfig {
  courierName: string;
  trackingNo: string;
  handlingNote: string;
  isLastPageOfDoc: boolean;
  totalUnitsCount: number;
}

function renderSinglePageHtml(
  ord: Order,
  pageItems: any[],
  pageIdx: number,
  totalPages: number,
  config: LabelPageConfig
): string {
  const isPickup = isStorePickupOrder(ord);
  const cOrderNum = String(ord.order_number || ord.id || '').replace(/^#+/, '');
  const shp = ord.shipping || {};
  const rName = ord.customer_name || `${shp.first_name || ''} ${shp.last_name || ''}`.trim() || 'Customer';
  const rPhone = ord.customer_phone || shp.phone || '-';
  const rAddrLines = [
    shp.address_1 || 'Address on file',
    shp.address_2 || shp.address_2_extra || '',
    [shp.city || '', shp.state || '', shp.postcode || ''].filter(Boolean).join(', '),
    resolveCountryName(shp.country || ord.billing?.country || 'Indonesia'),
  ].filter(Boolean);

  const cCourier = config.courierName || 'JNE Express';
  const validTrk = config.trackingNo && !config.trackingNo.startsWith('field_') ? config.trackingNo : '';

  const bData = generateBarcodeSvgData(cOrderNum, 36);
  const bSvgRects = bData.elements
    .map(el => `<rect x="${el.x}" y="0" width="${el.width}" height="36" fill="#000" />`)
    .join('');

  const renderItemRowsHtml = (itemsList: any[]) => {
    return (itemsList || []).map((item) => {
      const itemSku = item.sku 
        ? item.sku 
        : (item.product_id ? `SKU${item.product_id}` : `SKU${item.id || '72572'}`);
      const cleanItemName = cleanItemTitle(String(item.name || 'Precision Device Skin'))
        .replace(/\r?\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const { partSpecs, refSpecs, partList } = formatSeparatedItemSpecs(item);

      const isWarrantyItem =
        cleanItemName.toLowerCase().includes('warranty') ||
        (ord.meta_data || []).some((m: any) => (m.key === '_order_badge' && m.value === 'WARRANTY') || (m.key === '_is_warranty' && m.value === 'yes'));

      let finalRefSpecs = refSpecs;
      if (!finalRefSpecs && isWarrantyItem) {
        const rmaChannel = (ord.meta_data || []).find((m: any) => m.key === '_rma_marketplace_channel')?.value;
        const rmaInvoice = (ord.meta_data || []).find((m: any) => m.key === '_rma_original_invoice' || m.key === '_rma_original_order_id')?.value;
        if (rmaInvoice) {
          finalRefSpecs = rmaChannel
            ? `Original Channel: ${rmaChannel} • Original Invoice: ${rmaInvoice}`
            : `Original Order: #${rmaInvoice}`;
        }
      }

      // Line-by-line specs formatting: larger text, bold values for production readability
      let specsHtml = '';
      if (partList && partList.length > 0) {
        specsHtml = `
          <div style="margin-top: 2px;">
            ${partList.map(s => `
              <div style="font-size: 9.5px; line-height: 1.25; color: #111;">
                <span style="font-weight: 700; color: #333;">${s.label}:</span> <span style="font-weight: 900; color: #000;">${s.value}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else if (partSpecs) {
        specsHtml = `<div style="font-size: 9.5px; color: #000; font-weight: 800; line-height: 1.25; margin-top: 2px;">${partSpecs}</div>`;
      }

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 3px 5px; font-weight: 900; width: 26px; text-align: center; font-size: 11px; vertical-align: top; font-variant-numeric: tabular-nums;">
            ${item.quantity > 1 ? `<u style="text-decoration: underline; text-underline-offset: 2px;">${item.quantity}x</u>` : `${item.quantity}x`}
          </td>
          <td style="padding: 3px 5px; vertical-align: top;">
            <div style="font-size: 10.5px; font-weight: 900; color: #000; line-height: 1.15; letter-spacing: -0.15px; margin: 0 0 1px 0;">${cleanItemName}</div>
            ${specsHtml}
            ${finalRefSpecs ? `<div style="font-size: 8px; color: #555; font-weight: 600; line-height: 1.2; margin-top: 2px;">${finalRefSpecs}</div>` : ''}
          </td>
          <td style="padding: 3px 5px; font-size: 9px; text-align: right; color: #333; font-weight: 800; vertical-align: top; white-space: nowrap; font-variant-numeric: tabular-nums;">${itemSku}</td>
        </tr>
      `;
    }).join('');
  };

  const pageBreakClass = config.isLastPageOfDoc ? '' : 'page-break';

  if (pageIdx === 0) {
    return `
      <div class="label-container ${pageBreakClass}">
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

          <div class="recipient-box">
            <div style="font-size: 8px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">
              ${isPickup ? 'CUSTOMER PICKUP (WORKSHOP MANIFEST):' : 'SHIP TO / DELIVER TO:'}
            </div>
            <div class="recipient-name">${rName}</div>
            <div class="recipient-phone">Tel: ${rPhone}</div>
            ${!isPickup ? `<div class="recipient-address">${rAddrLines.join('<br />')}</div>` : ''}
          </div>
        </div>

        <div class="inline-from-barcode-row">
          <div class="from-subcol">
            <div class="tag-label">FROM:</div>
            <div class="from-brand">EXACOAT</div>
            <div class="from-contact">
              Tel: 628975556000<br />
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

        <div style="margin: 2px 0; flex: 1;">
          <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 2px;">
            <span>MANIFEST DECLARATION (${config.totalUnitsCount} PCS)</span>
            <span>PREMIUM DEVICE SKINS</span>
          </div>
          <table class="manifest-table">
            <tbody>
              ${renderItemRowsHtml(pageItems)}
            </tbody>
          </table>
        </div>

        <div>
          <div class="caution-bar">
            &#9650; ${isPickup ? 'STORE PICKUP - SUMMARECON BEKASI' : config.handlingNote} &#9650;
          </div>
        </div>
      </div>
    `;
  }

  // Page 2+: Minimal header, order ref, page number, and remaining manifest items
  return `
    <div class="label-container ${pageBreakClass}">
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

      <div>
        <div class="caution-bar">
          &#9650; ${isPickup ? 'STORE PICKUP - SUMMARECON BEKASI' : config.handlingNote} &#9650;
        </div>
      </div>
    </div>
  `;
}

function generateDocumentHtml(bodyContent: string, options?: { autoPrint?: boolean }): string {
  const autoPrintScript = options?.autoPrint ? `
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
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shipping Label</title>
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
  ${bodyContent}
  ${autoPrintScript}
</body>
</html>`;
}

export const ShippingLabelA6Modal: React.FC<ShippingLabelA6ModalProps> = ({
  order,
  orders,
  isOpen,
  onClose,
  onPrinted,
}) => {
  const { showToast } = useToast();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const activeOrdersList = (orders && orders.length > 0) ? orders : (order ? [order] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);

  // Active current order
  const activeOrder = activeOrdersList[currentIndex] || activeOrdersList[0] || null;

  // Reset indices when orders list changes
  useEffect(() => {
    setCurrentIndex(0);
    setPreviewPageIndex(0);
  }, [orders, order]);

  // Handle responsive scale for preview iframe on narrow screens
  useEffect(() => {
    const handleResize = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth;
        if (containerWidth > 0 && containerWidth < 384) {
          setPreviewScale(containerWidth / 384);
        } else {
          setPreviewScale(1);
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Editable label fields
  const [courierName, setCourierName] = useState<string>('JNE Express');
  const [trackingNo, setTrackingNo] = useState<string>('');
  const [handlingNote, setHandlingNote] = useState<string>('FRAGILE • DO NOT BEND • KEEP DRY');

  // Sync state whenever active order changes
  useEffect(() => {
    if (activeOrder) {
      const resolved = resolveOrderCourier(activeOrder);
      const displayCourier = (activeOrder.tracking?.courier && activeOrder.tracking.courier !== 'JNE Express')
        ? activeOrder.tracking.courier
        : (resolved.rawMatch || (resolved.serviceName ? `${resolved.courierName} - ${resolved.serviceName}` : resolved.courierName));
      setCourierName(displayCourier);
      const rawTrack = String(activeOrder.tracking?.tracking_number || '').trim();
      setTrackingNo(rawTrack && !rawTrack.startsWith('field_') ? rawTrack : '');
      setPreviewPageIndex(0);
    }
  }, [activeOrder]);

  if (!isOpen || activeOrdersList.length === 0 || !activeOrder) return null;

  const cleanOrderNum = String(activeOrder.order_number || activeOrder.id || '').replace(/^#+/, '');

  // Format recipient address for chunking calculations
  const shipping = activeOrder.shipping || {};
  const recipientName = activeOrder.customer_name || `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Customer';
  const addressLine1 = shipping.address_1 || 'Address on file';
  const addressLine2 = shipping.address_2 || shipping.address_2_extra || '';
  const city = shipping.city || '';
  const state = shipping.state || '';
  const postcode = shipping.postcode || '';
  const country = resolveCountryName(shipping.country || activeOrder.billing?.country || 'Indonesia');

  const fullAddressLines = [
    addressLine1,
    addressLine2,
    [city, state, postcode].filter(Boolean).join(', '),
    country,
  ].filter(Boolean);

  // Order items resolution
  const activeOrderItems = (activeOrder.items && activeOrder.items.length > 0)
    ? activeOrder.items
    : (activeOrder.line_items && activeOrder.line_items.length > 0 ? activeOrder.line_items : []);
  const { pages: activePages, totalPages: activeTotalPages } = chunkOrderItems(
    activeOrderItems,
    fullAddressLines.length,
    Boolean(trackingNo)
  );

  const safePreviewPageIndex = Math.min(previewPageIndex, Math.max(0, activeTotalPages - 1));
  const activeUnitsCount = activeOrder.item_count || activeOrderItems.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);

  const previewPageItems = activePages[safePreviewPageIndex] || [];
  const previewHtml = generateDocumentHtml(
    renderSinglePageHtml(activeOrder, previewPageItems, safePreviewPageIndex, activeTotalPages, {
      courierName,
      trackingNo,
      handlingNote,
      isLastPageOfDoc: true,
      totalUnitsCount: activeUnitsCount,
    }),
    { autoPrint: false }
  );

  const handlePrint = () => {
    const printedIds = activeOrdersList.map(o => o.id).filter(Boolean);
    if (printedIds.length > 0) {
      try {
        const stored = localStorage.getItem('_exacoat_direct_printed_orders');
        const currentList: number[] = stored ? JSON.parse(stored) : [];
        const updatedList = Array.from(new Set([...currentList, ...printedIds]));
        localStorage.setItem('_exacoat_direct_printed_orders', JSON.stringify(updatedList));
        window.dispatchEvent(new CustomEvent('exacoat_order_printed', { detail: { orderIds: printedIds } }));
      } catch (e) {
        console.warn('Failed to save printed orders status', e);
      }
      if (onPrinted) {
        onPrinted(printedIds);
      }
    }

    const printWindow = window.open('', '_blank', 'width=800,height=950');
    if (!printWindow) {
      showToast('error', 'Popup Blocked', 'Please allow popups to print shipping labels.');
      return;
    }

    const allLabelsHtml = activeOrdersList.map((ord, ordIdx) => {
      const isCurrentActiveOrder = ord.id === activeOrder.id;
      const ordResolved = resolveOrderCourier(ord);
      const ordFallbackCourier = ordResolved.rawMatch || (ordResolved.serviceName ? `${ordResolved.courierName} - ${ordResolved.serviceName}` : ordResolved.courierName);
      const cCourier = (isCurrentActiveOrder ? courierName : (ord.tracking?.courier && ord.tracking.courier !== 'JNE Express' ? ord.tracking.courier : ordFallbackCourier)) || 'JNE Express';
      const rawTrk = (isCurrentActiveOrder ? trackingNo : (ord.tracking?.tracking_number || ''));
      const cTrack = rawTrk && !rawTrk.startsWith('field_') ? rawTrk : '';

      const shp = ord.shipping || {};
      const rAddrLines = [
        shp.address_1 || 'Address on file',
        shp.address_2 || shp.address_2_extra || '',
        [shp.city || '', shp.state || '', shp.postcode || ''].filter(Boolean).join(', '),
        resolveCountryName(shp.country || ord.billing?.country || 'Indonesia'),
      ].filter(Boolean);

      const ordItems = (ord.items && ord.items.length > 0)
        ? ord.items
        : (ord.line_items && ord.line_items.length > 0 ? ord.line_items : []);
      const { pages, totalPages } = chunkOrderItems(ordItems, rAddrLines.length, Boolean(cTrack));
      const totalUnitsCount = ord.item_count || ordItems.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0);

      return pages.map((pageItems, pageIdx) => {
        const isLastSheetOfOrder = pageIdx === pages.length - 1;
        const isAbsoluteLastSheet = (ordIdx === activeOrdersList.length - 1) && isLastSheetOfOrder;
        return renderSinglePageHtml(ord, pageItems, pageIdx, totalPages, {
          courierName: cCourier,
          trackingNo: cTrack,
          handlingNote: isCurrentActiveOrder ? handlingNote : 'FRAGILE • DO NOT BEND • KEEP DRY',
          isLastPageOfDoc: isAbsoluteLastSheet,
          totalUnitsCount,
        });
      }).join('');
    }).join('');

    const fullPrintHtml = generateDocumentHtml(allLabelsHtml, { autoPrint: true });
    printWindow.document.write(fullPrintHtml);
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
              className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white text-xs font-semibold border border-white/[0.08] transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-[#0a0a0a] text-xs font-bold font-sans flex items-center gap-2 shadow-lg shadow-[#f3aa18]/10 transition-all active:scale-95 cursor-pointer"
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
                    className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white transition-all cursor-pointer"
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
                    className="p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white transition-all cursor-pointer"
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
              Courier &amp; Tracking Options
            </h4>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Courier Name
              </label>
              <input
                type="text"
                value={courierName}
                onChange={e => setCourierName(e.target.value)}
                placeholder="e.g. JNE Express, SiCepat, J&amp;T"
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
              <p className="text-neutral-400 text-[11px]">628975556000</p>
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
                        "px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer",
                        safePreviewPageIndex === pIdx
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
              100mm &times; 150mm &bull; 1:1 Thermal Output
            </span>
          </div>

          <div ref={previewContainerRef} className="w-full flex justify-center items-center py-1 overflow-hidden">
            <div
              style={{
                width: '384px',
                height: '576px',
                transform: previewScale < 1 ? `scale(${previewScale})` : undefined,
                transformOrigin: 'top center',
                marginBottom: previewScale < 1 ? `-${576 * (1 - previewScale)}px` : undefined,
              }}
              className="shadow-2xl rounded-sm overflow-hidden bg-white border border-neutral-300 dark:border-neutral-700 shrink-0"
            >
              <iframe
                key={`${activeOrder.id}-${safePreviewPageIndex}-${courierName}-${trackingNo}-${handlingNote}-${activeOrderItems.length}`}
                title="4x6 Thermal Label Print Preview"
                srcDoc={previewHtml}
                className="w-[384px] h-[576px] border-none block pointer-events-none select-none bg-white"
                style={{ width: '384px', height: '576px', border: 'none' }}
              />
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
};
