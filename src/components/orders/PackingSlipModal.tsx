import React, { useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Order } from '../../types';
import { formatDate, formatDateTime } from '../../lib/formatters';
import { Printer, CheckCircle2, ClipboardCheck, Package } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { EXACOAT_LOGO_BASE64 } from '../../lib/assets/logo';
import { extractItemSpecs, formatSeparatedItemSpecs, cleanItemTitle } from '../../lib/orderItems';
import { isStorePickupOrder } from '../../lib/orderUtils';

interface PackingSlipModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onPrinted?: (orderId: number) => void;
}

export const PackingSlipModal: React.FC<PackingSlipModalProps> = ({
  order,
  isOpen,
  onClose,
  onPrinted,
}) => {
  const { showToast } = useToast();
  const slipRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const cleanOrderNum = String(order.order_number || order.id || '').replace(/^#+/, '');
  const packingSlipNum = `PS-${cleanOrderNum}`;
  const shipping = order.shipping || {};
  const billing = order.billing || {};

  const customerName =
    order.customer_name ||
    `${shipping.first_name || billing.first_name || ''} ${shipping.last_name || billing.last_name || ''}`.trim() ||
    'Customer';
  const customerPhone = order.customer_phone || shipping.phone || billing.phone || '-';

  const isPickup = isStorePickupOrder(order);

  const shippingAddress = isPickup
    ? [
        'Exacoat Store Summarecon Bekasi (Self Pickup)',
        'Ruko Ruby Commercial TB12, Jl. Bulevar Selatan',
        'Summarecon Bekasi, Kota Bekasi 17142',
      ]
    : [
        shipping.address_1 || billing.address_1 || 'Address on file',
        shipping.address_2 || billing.address_2,
        [shipping.city || billing.city, shipping.state || billing.state, shipping.postcode || billing.postcode]
          .filter(Boolean)
          .join(', '),
        shipping.country || billing.country || 'Indonesia',
      ].filter(Boolean);

  const courierName = isPickup
    ? 'Store Pickup (Summarecon Bekasi)'
    : order.tracking?.courier ||
      (order as any).shipping_lines?.[0]?.method_title ||
      order.shipping_method_name ||
      'Standard Courier';
  const trackingNumber = isPickup
    ? 'STORE-PICKUP'
    : order.tracking?.tracking_number && !order.tracking.tracking_number.startsWith('field_')
    ? order.tracking.tracking_number
    : null;

  const totalItemsCount = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const metaList = Array.isArray(order.meta_data) ? order.meta_data : [];
  const isWarrantyOrder =
    metaList.some((m: any) => (m.key === '_order_badge' && m.value === 'WARRANTY') || (m.key === '_rma_order_type' && m.value === 'Warranty') || (m.key === '_is_warranty' && m.value === 'yes'));
  const isRedeemOrder =
    metaList.some((m: any) => (m.key === '_order_badge' && m.value === 'REDEEM') || (m.key === '_rma_order_type' && m.value === 'Redeem'));
  const rmaMarketplace = metaList.find((m: any) => m.key === '_rma_marketplace_channel')?.value;
  const rmaOrigInvoice = metaList.find((m: any) => m.key === '_rma_original_invoice' || m.key === '_rma_original_order_id' || m.key === '_rma_original_order_number')?.value;

  const channelBadgeHtml = isWarrantyOrder
    ? `<span class="badge-channel" style="background: #e0f2fe; color: #0369a1; border-color: #7dd3fc; font-weight: 800;">${rmaMarketplace ? `${rmaMarketplace} Warranty` : 'Installation Warranty'}</span>`
    : isRedeemOrder
    ? `<span class="badge-channel" style="background: #fef3c7; color: #b45309; border-color: #fcd34d; font-weight: 800;">Redeem Replacement</span>`
    : `<span class="badge-channel">Direct Web Order</span>`;

  const handlePrint = () => {
    if (onPrinted && order.id) {
      onPrinted(order.id);
    }

    const printWindow = window.open('', '_blank', 'width=850,height=1000');
    if (!printWindow) {
      showToast('error', 'Popup Blocked', 'Please allow popups to print packing slips.');
      return;
    }

    const itemsRowsHtml = (order.items || [])
      .map((item, idx) => {
        const itemSku = item.sku || (item.product_id ? `SKU-${item.product_id}` : `SKU-${item.id || idx + 1}`);
        const cleanItemName = cleanItemTitle(String(item.name || 'Precision Device Skin'))
          .replace(/\r?\n+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        const { partSpecs, refSpecs } = formatSeparatedItemSpecs(item);

        return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; text-align: center; width: 40px; vertical-align: top;">
            <div style="width: 18px; height: 18px; border: 1.5px solid #9ca3af; border-radius: 4px; margin: 2px auto;"></div>
          </td>
          <td style="padding: 10px 12px; font-weight: 700; font-size: 13px; color: #111827; vertical-align: top;">
            <div style="line-height: 1.15; margin-bottom: 2px;">${cleanItemName}</div>
            ${partSpecs ? `<div style="font-size: 11px; color: #1e3a8a; font-weight: 700; margin-top: 2px; line-height: 1.2;">${partSpecs}</div>` : ''}
            ${refSpecs ? `<div style="font-size: 10px; color: #6b7280; font-weight: 600; margin-top: 1.5px; line-height: 1.2;">${refSpecs}</div>` : ''}
            <div style="font-size: 10.5px; color: #6b7280; font-family: monospace; margin-top: 2px;">SKU: ${itemSku}</div>
          </td>
          <td style="padding: 10px 12px; text-align: center; font-weight: 800; font-size: 14px; color: #111827; font-family: monospace; vertical-align: top; width: 70px;">
            ${item.quantity || 1}x
          </td>
        </tr>
      `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Packing Slip - ${packingSlipNum}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            margin: 0;
            padding: 20px;
            background: #ffffff;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #111827;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: antialiased;
          }
          .slip-box {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #111827;
            padding-bottom: 18px;
            margin-bottom: 20px;
          }
          .brand-logo {
            height: 22px;
            display: block;
            margin-bottom: 6px;
          }
          .brand-sub {
            font-size: 11px;
            color: #4b5563;
            font-weight: 500;
          }
          .slip-title {
            font-size: 20px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #111827;
            text-align: right;
          }
          .slip-meta {
            font-size: 11.5px;
            color: #4b5563;
            margin-top: 4px;
            text-align: right;
            line-height: 1.4;
          }
          .grid-2 {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
          }
          .grid-col {
            flex: 1;
            background: #f9fafb;
            padding: 14px 16px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
          }
          .col-label {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
            margin-bottom: 6px;
          }
          .col-name {
            font-size: 14px;
            font-weight: 800;
            color: #111827;
            margin-bottom: 3px;
          }
          .col-text {
            font-size: 12px;
            color: #374151;
            line-height: 1.4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #f3f4f6;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #374151;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e5e7eb;
          }
          .footer-note {
            border-top: 1px solid #e5e7eb;
            padding-top: 14px;
            font-size: 11px;
            color: #6b7280;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .badge-channel {
            display: inline-block;
            background: #f3f4f6;
            color: #1f2937;
            border: 1px solid #d1d5db;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="slip-box">
          <!-- Header -->
          <div class="header-row">
            <div>
              <img src="${EXACOAT_LOGO_BASE64}" alt="EXACOAT" class="brand-logo" />
              <div class="brand-sub">Exacoat Fulfillment Hub &bull; Ruby Commercial TB12</div>
              <div class="brand-sub">Fulfillment Workstation &bull; support@exacoat.com</div>
            </div>
            <div>
              <div class="slip-title">PACKING SLIP</div>
              <div class="slip-meta">
                <div><strong>Slip Ref:</strong> ${packingSlipNum}</div>
                <div><strong>Order #:</strong> #${cleanOrderNum}</div>
                ${rmaOrigInvoice ? `<div style="color: #0369a1; font-weight: 700; font-size: 11px;"><strong>Orig. Ref:</strong> #${rmaOrigInvoice}</div>` : ''}
                <div><strong>Date:</strong> ${formatDate(order.created_at)}</div>
                <div style="margin-top: 4px;">${channelBadgeHtml}</div>
              </div>
            </div>
          </div>

          <!-- Shipping & Order Specification Grid -->
          <div class="grid-2">
            <div class="grid-col">
              <div class="col-label">SHIP TO / RECIPIENT</div>
              <div class="col-name">${customerName}</div>
              <div class="col-text">Phone: ${customerPhone}</div>
              <div class="col-text" style="margin-top: 4px;">${shippingAddress.join('<br />')}</div>
            </div>
            <div class="grid-col">
              <div class="col-label">DISPATCH SPECIFICATION</div>
              <div class="col-text"><strong>Courier:</strong> ${courierName}</div>
              <div class="col-text"><strong>Tracking Resi:</strong> ${trackingNumber || 'Pending Pickup Allocation'}</div>
              <div class="col-text"><strong>Total Line Items:</strong> ${(order.items || []).length} (${totalItemsCount} units)</div>
              ${order.customer_note ? `<div class="col-text" style="margin-top: 6px; padding: 8px; background: #fff; border: 1.5px solid #d1d5db; border-radius: 6px; font-size: 11px; line-height: 1.45; color: #111827; white-space: pre-line;"><strong>Production Note:</strong>\n${order.customer_note}</div>` : ''}
            </div>
          </div>

          <!-- Line Items Checklist -->
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">Pick</th>
                <th style="text-align: left;">Item Description &amp; Specifications</th>
                <th style="text-align: center; width: 70px;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>

          <!-- Customer Instructions Footer -->
          <div class="footer-note">
            <div>
              <span>Installation guide &amp; video tutorials available at <strong>exacoat.com/guide</strong></span>
            </div>
            <div>
              <span>Official Exacoat Dispatch Manifest</span>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
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
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#f3aa18]" />
          <span>Packing Slip &bull; Order #{cleanOrderNum}</span>
        </div>
      }
      subtitle="Warehouse picking checklist and customer dispatch manifest."
      footer={
        <div className="flex items-center justify-between w-full font-sans">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-[#f3aa18]" />
            <span>Official Exacoat Dispatch Manifest</span>
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
              <span>Print Packing Slip</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Printable Canvas Card Preview */}
        <div
          ref={slipRef}
          className="bg-white text-black p-6 rounded-xl shadow-2xl border border-neutral-200"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-4">
            <div>
              <img
                src={EXACOAT_LOGO_BASE64}
                alt="EXACOAT"
                className="h-6 max-w-[140px] object-contain block mb-1"
              />
              <p className="text-[11px] text-neutral-600 font-medium">
                Exacoat Fulfillment Hub &bull; Ruby Commercial TB12
              </p>
              <p className="text-[10px] text-neutral-500 font-mono">support@exacoat.com &bull; https://exacoat.com</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black tracking-tight text-black block">PACKING SLIP</span>
              <span className="text-[11px] font-mono font-bold text-neutral-700 block">{packingSlipNum}</span>
              {rmaOrigInvoice && (
                <span className="text-[11px] font-mono font-bold text-sky-700 block">Orig: #{rmaOrigInvoice}</span>
              )}
              <span className="text-[10px] text-neutral-500 block">{formatDate(order.created_at)}</span>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-extrabold font-mono uppercase">
                  {courierName}
                </span>
                {isWarrantyOrder && (
                  <span className="inline-block px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-[9px] font-extrabold font-mono uppercase">
                    {rmaMarketplace ? `${rmaMarketplace} Warranty` : 'Warranty'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block mb-1">
                SHIP TO / RECIPIENT
              </span>
              <p className="font-extrabold text-xs text-black">{customerName}</p>
              <p className="text-[11px] text-neutral-700 font-mono">{customerPhone}</p>
              <div className="text-[10.5px] text-neutral-600 mt-1 leading-snug">
                {shippingAddress.map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block mb-1">
                DISPATCH DETAILS
              </span>
              <p className="text-[11px] text-neutral-800">
                <strong>Courier:</strong> {courierName}
              </p>
              <p className="text-[11px] text-neutral-800 font-mono">
                <strong>Tracking:</strong> {trackingNumber || 'Pending Pickup'}
              </p>
              <p className="text-[11px] text-neutral-800">
                <strong>Total Items:</strong> {(order.items || []).length} lines ({totalItemsCount} units)
              </p>
              {order.customer_note && (
                <div className="text-[10px] text-neutral-700 mt-2 border-t border-neutral-200 pt-1.5 whitespace-pre-line bg-amber-50/70 p-2 rounded border border-amber-200/60 leading-relaxed font-sans">
                  <strong className="text-neutral-900 block font-bold mb-0.5">Production Note:</strong>
                  {order.customer_note}
                </div>
              )}
            </div>
          </div>

          {/* Items Checklist Table */}
          <table className="w-full text-left border-collapse text-xs mb-4">
            <thead>
              <tr className="bg-neutral-100 border-b-2 border-neutral-300 text-neutral-700 font-extrabold text-[10px] uppercase">
                <th className="py-2 px-3 text-center w-10">Pick</th>
                <th className="py-2 px-3">Item Description &amp; Model</th>
                <th className="py-2 px-3 text-center w-16">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(order.items || []).map((item, idx) => {
                const itemSku = item.sku || (item.product_id ? `SKU-${item.product_id}` : `SKU-${item.id || idx + 1}`);
                const cleanItemName = cleanItemTitle(String(item.name || 'Precision Device Skin'))
                  .replace(/\r?\n+/g, ' ')
                  .replace(/\s{2,}/g, ' ')
                  .trim();
                const { partSpecs, refSpecs } = formatSeparatedItemSpecs(item);

                return (
                  <tr key={item.id || idx} className="hover:bg-neutral-50">
                    <td className="py-2.5 px-3 text-center align-top">
                      <div className="w-4 h-4 rounded border-2 border-neutral-400 mx-auto" />
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <span className="font-bold text-xs text-neutral-900 block leading-[1.15]">{cleanItemName}</span>
                      {partSpecs && (
                        <span className="text-[10.5px] text-sky-900 font-bold block mt-0.5 leading-tight">{partSpecs}</span>
                      )}
                      {refSpecs && (
                        <span className="text-[10px] text-neutral-500 font-semibold block mt-0.5 leading-tight">{refSpecs}</span>
                      )}
                      <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">SKU: {itemSku}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-xs text-neutral-900 align-top">
                      {item.quantity || 1}x
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer Note */}
          <div className="border-t border-neutral-200 pt-3 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Step-by-step video installation guides available at exacoat.com/guide</span>
            <span>Exacoat Fulfillment Hub &bull; Authorized Dispatch</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
