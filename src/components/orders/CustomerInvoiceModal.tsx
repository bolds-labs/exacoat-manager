import React, { useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Order } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/formatters';
import { Printer, Download, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { EXACOAT_LOGO_BASE64 } from '../../lib/assets/logo';

interface CustomerInvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onPrinted?: (orderId: number) => void;
}

export const CustomerInvoiceModal: React.FC<CustomerInvoiceModalProps> = ({
  order,
  isOpen,
  onClose,
  onPrinted,
}) => {
  const { showToast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const cleanOrderNum = String(order.order_number || order.id || '').replace(/^#+/, '');
  const invoiceNum = `INV-${cleanOrderNum}`;
  const shipping = order.shipping || {};
  const billing = order.billing || {};

  const customerName = order.customer_name || `${billing.first_name || shipping.first_name || ''} ${billing.last_name || shipping.last_name || ''}`.trim() || 'Customer';
  const customerEmail = order.customer_email || billing.email || '-';
  const customerPhone = order.customer_phone || billing.phone || shipping.phone || '-';

  const billingAddress = [
    billing.address_1 || shipping.address_1,
    billing.address_2 || shipping.address_2,
    [billing.city || shipping.city, billing.state || shipping.state, billing.postcode || shipping.postcode].filter(Boolean).join(', '),
    billing.country || shipping.country || 'ID',
  ].filter(Boolean);

  const shippingAddress = [
    shipping.address_1 || 'Address on file',
    shipping.address_2,
    [shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(', '),
    shipping.country || 'ID',
  ].filter(Boolean);

  const handlePrint = () => {
    if (onPrinted && order.id) {
      onPrinted(order.id);
    }

    const printWindow = window.open('', '_blank', 'width=850,height=1000');
    if (!printWindow) {
      showToast('error', 'Popup Blocked', 'Please allow popups to print customer invoices.');
      return;
    }

    const itemsRowsHtml = (order.items || []).map((item, idx) => {
      const itemSku = item.sku || (item.product_id ? `SKU-${item.product_id}` : `SKU-${item.id || idx + 1}`);
      const unitPrice = Number(item.price || (Number(item.total) / (item.quantity || 1)) || 0);
      const lineTotal = Number(item.total || (unitPrice * (item.quantity || 1)) || 0);

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 14px; color: #111827; font-weight: 700; font-size: 13px;">
            <div>${item.name || 'Device Skin'}</div>
            <div style="font-size: 11px; color: #6b7280; font-weight: 500; margin-top: 2px;">
              SKU: <span style="font-family: monospace;">${itemSku}</span>
            </div>
          </td>
          <td style="padding: 12px 14px; text-align: center; color: #374151; font-weight: 600; font-size: 13px;">
            ${item.quantity}x
          </td>
          <td style="padding: 12px 14px; text-align: right; color: #374151; font-weight: 600; font-size: 13px; font-family: monospace;">
            ${formatCurrency(unitPrice, order.currency)}
          </td>
          <td style="padding: 12px 14px; text-align: right; color: #111827; font-weight: 800; font-size: 13px; font-family: monospace;">
            ${formatCurrency(lineTotal, order.currency)}
          </td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Customer Invoice - ${invoiceNum}</title>
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
          .invoice-box {
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
            height: 24px;
            display: block;
            margin-bottom: 6px;
          }
          .brand-sub {
            font-size: 11px;
            color: #4b5563;
            font-weight: 500;
          }
          .inv-title {
            font-size: 20px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #111827;
          }
          .inv-meta {
            font-size: 11.5px;
            color: #4b5563;
            margin-top: 4px;
            text-align: right;
            line-height: 1.4;
          }
          .grid-2 {
            display: flex;
            gap: 24px;
            margin-bottom: 24px;
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
            padding: 10px 14px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #374151;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e5e7eb;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          .totals-table {
            width: 320px;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 6px 12px;
            font-size: 12.5px;
          }
          .total-grand {
            border-top: 2px solid #111827;
            font-size: 15px !important;
            font-weight: 900 !important;
            color: #111827 !important;
            padding-top: 10px !important;
          }
          .footer-note {
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
            font-size: 11px;
            color: #6b7280;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .badge-paid {
            display: inline-block;
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <!-- Header -->
          <div class="header-row">
            <div>
              <img src="${EXACOAT_LOGO_BASE64}" alt="EXACOAT" style="height: 22px; max-width: 140px; object-fit: contain; display: block; margin-bottom: 6px;" />
              <div class="brand-sub">support@exacoat.com &bull; https://exacoat.com</div>
            </div>
            <div>
              <div class="inv-title">TAX INVOICE</div>
              <div class="inv-meta">
                <div><strong>Invoice:</strong> ${invoiceNum}</div>
                <div><strong>Order Ref:</strong> #${cleanOrderNum}</div>
                <div><strong>Date:</strong> ${formatDate(order.created_at)}</div>
                <div style="margin-top: 6px;"><span class="badge-paid">&#10003; PAYMENT COMPLETED</span></div>
              </div>
            </div>
          </div>

          <!-- Customer & Delivery Details -->
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
            <div class="col-label">CUSTOMER &amp; DELIVERY DETAILS</div>
            <div class="col-name">${customerName}</div>
            <div class="col-text">Email: ${customerEmail} &bull; Tel: ${customerPhone}</div>
            <div class="col-text" style="margin-top: 4px;">${(shippingAddress.length > 0 ? shippingAddress : billingAddress).join('<br />')}</div>
            ${order.tracking?.courier ? `<div class="col-text" style="margin-top: 4px; font-weight: 700;">Carrier: ${order.tracking.courier}</div>` : ''}
          </div>

          <!-- Line Items Table -->
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item Description</th>
                <th style="text-align: center; width: 60px;">Qty</th>
                <th style="text-align: right; width: 110px;">Unit Price</th>
                <th style="text-align: right; width: 110px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>

          <!-- Totals Summary -->
          <div class="totals-wrap">
            <table class="totals-table">
              <tbody>
                <tr>
                  <td style="color: #6b7280; font-weight: 600;">Items Subtotal</td>
                  <td style="text-align: right; font-weight: 700; font-family: monospace;">
                    ${formatCurrency(Number(order.total) - Number(order.shipping_total || 0) - Number(order.total_tax || 0), order.currency)}
                  </td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-weight: 600;">Shipping & Handling</td>
                  <td style="text-align: right; font-weight: 700; font-family: monospace;">
                    ${Number(order.shipping_total) > 0 ? formatCurrency(order.shipping_total, order.currency) : 'Free Shipping'}
                  </td>
                </tr>
                ${Number(order.total_tax) > 0 ? `
                  <tr>
                    <td style="color: #6b7280; font-weight: 600;">Estimated Tax</td>
                    <td style="text-align: right; font-weight: 700; font-family: monospace;">
                      ${formatCurrency(order.total_tax, order.currency)}
                    </td>
                  </tr>
                ` : ''}
                <tr class="total-grand">
                  <td>Total Paid</td>
                  <td style="text-align: right; font-family: monospace;">
                    ${formatCurrency(order.total, order.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer & Support -->
          <div class="footer-note">
            <div>
              <span>Thank you for your order.</span>
            </div>
            <div>
              <span>Authorized Official Electronic Receipt</span>
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
          <FileText className="w-5 h-5 text-[#f3aa18]" />
          <span>Customer Tax Invoice #{order.order_number || order.id}</span>
        </div>
      }
      subtitle="Official customer tax receipt and itemized order invoice."
      footer={
        <div className="flex items-center justify-between w-full font-sans">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-[#f3aa18]" />
            <span>Official Exacoat Electronic Receipt</span>
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
              className="px-5 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-[#0a0a0a] text-xs font-bold font-sans flex items-center gap-2 shadow-lg shadow-[#f3aa18]/10 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 font-sans text-xs">
        
        {/* Printable Canvas Card Preview */}
        <div 
          ref={invoiceRef}
          className="bg-white text-black p-6 rounded-xl shadow-2xl border border-neutral-200"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-4">
            <div>
              <img src={EXACOAT_LOGO_BASE64} alt="EXACOAT" className="h-6 max-w-[140px] object-contain block mb-1" />
              <p className="text-[10px] text-neutral-500 font-mono">support@exacoat.com &bull; https://exacoat.com</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black tracking-tight text-black block">TAX INVOICE</span>
              <span className="text-[11px] font-mono font-bold text-neutral-700 block">{invoiceNum}</span>
              <span className="text-[10px] text-neutral-500 block">{formatDate(order.created_at)}</span>
              <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold font-mono">
                PAID IN FULL
              </span>
            </div>
          </div>

          {/* Customer & Delivery Details */}
          <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200 mb-4">
            <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block mb-1">
              CUSTOMER &amp; DELIVERY DETAILS
            </span>
            <p className="font-extrabold text-xs text-black">{customerName}</p>
            <p className="text-[11px] text-neutral-700 font-mono mt-0.5">
              Email: {customerEmail} &bull; Tel: {customerPhone}
            </p>
            <div className="text-[10.5px] text-neutral-600 mt-1 leading-snug">
              {(shippingAddress.length > 0 ? shippingAddress : billingAddress).map((line, i) => (
                <span key={i} className="block">{line}</span>
              ))}
            </div>
            {order.tracking?.courier && (
              <p className="text-[10.5px] font-bold text-neutral-900 mt-1.5">
                Courier: {order.tracking.courier}
              </p>
            )}
          </div>

          {/* Line Items Table */}
          <table className="w-full text-left border-collapse text-xs mb-4">
            <thead>
              <tr className="bg-neutral-100 border-b-2 border-neutral-300 text-neutral-700 font-extrabold text-[10px] uppercase">
                <th className="py-2 px-3">Item Description</th>
                <th className="py-2 px-3 text-center w-12">Qty</th>
                <th className="py-2 px-3 text-right w-24">Unit Price</th>
                <th className="py-2 px-3 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(order.items || []).map((item, idx) => {
                const itemSku = item.sku || (item.product_id ? `SKU-${item.product_id}` : `SKU-${item.id || idx + 1}`);
                const unitPrice = Number(item.price || (Number(item.total) / (item.quantity || 1)) || 0);
                const lineTotal = Number(item.total || (unitPrice * (item.quantity || 1)) || 0);

                return (
                  <tr key={item.id || idx}>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-black">{item.name || 'Device Skin'}</p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        SKU: {itemSku}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-neutral-800">
                      {item.quantity}x
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-neutral-700">
                      {formatCurrency(unitPrice, order.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-black">
                      {formatCurrency(lineTotal, order.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals Breakdown */}
          <div className="flex justify-end mb-4">
            <div className="w-64 space-y-1 text-xs">
              <div className="flex justify-between text-neutral-600 font-medium">
                <span>Subtotal:</span>
                <span className="font-mono text-neutral-900 font-bold">
                  {formatCurrency(Number(order.total) - Number(order.shipping_total || 0) - Number(order.total_tax || 0), order.currency)}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600 font-medium">
                <span>Shipping:</span>
                <span className="font-mono text-neutral-900 font-bold">
                  {Number(order.shipping_total) > 0 ? formatCurrency(order.shipping_total, order.currency) : 'Free'}
                </span>
              </div>
              {Number(order.total_tax) > 0 && (
                <div className="flex justify-between text-neutral-600 font-medium">
                  <span>Tax:</span>
                  <span className="font-mono text-neutral-900 font-bold">
                    {formatCurrency(order.total_tax, order.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-black font-black text-sm pt-2 border-t-2 border-black">
                <span>Total Paid:</span>
                <span className="font-mono">
                  {formatCurrency(order.total, order.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-neutral-200 pt-3 flex items-center justify-between text-[9.5px] text-neutral-500">
            <span>Thank you for your order.</span>
            <span>Electronic Tax Receipt</span>
          </div>

        </div>

      </div>
    </Modal>
  );
};
