import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order } from '../../types';
import { Button } from '../ui/Button';
import { FileText, Download, X } from 'lucide-react';
import { formatCurrency, formatDate, stripEmDashes } from '../../lib/formatters';

interface CustomerInvoiceModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerInvoiceModal: React.FC<CustomerInvoiceModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const generateInvoice = (action: 'download' | 'preview') => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const customer = order.billing || order.shipping;
      const customerName = stripEmDashes((customer.first_name + ' ' + customer.last_name).trim() || 'Valued Customer');

      // Top Header
      doc.setFillColor(15, 15, 18);
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(243, 170, 24);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('EXACOAT', 15, 18);

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Precision Device Skin Engineering', 15, 25);

      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('PACKING SLIP', 195, 18, { align: 'right' });

      doc.setFontSize(9);
      doc.setTextColor(180, 180, 180);
      doc.text('Order #' + order.number + ' | ' + formatDate(order.date_created), 195, 25, { align: 'right' });

      // Customer Details
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('BILL TO / SHIP TO:', 15, 42);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(customerName, 15, 48);
      doc.text(customer.email || 'No email', 15, 53);
      doc.text(order.formatted_phone || customer.phone || 'No phone', 15, 58);

      const addressLines = [
        customer.address_1,
        customer.address_2,
        order.shipping_district,
        customer.city,
        customer.state,
        customer.postcode,
        customer.country,
      ].filter(Boolean).join(', ');

      const splitAddr = doc.splitTextToSize(addressLines, 85);
      doc.text(splitAddr, 15, 63);

      // Order Info Box
      doc.setFont('helvetica', 'bold');
      doc.text('ORDER SUMMARY:', 125, 42);
      doc.setFont('helvetica', 'normal');
      doc.text('Status: ' + order.status.toUpperCase(), 125, 48);
      doc.text('Payment: ' + (order.payment_method_title || 'Direct Online'), 125, 53);
      doc.text('Tracking Number: ' + (order.tracking_number || 'N/A'), 125, 58);

      // Table of Items
      const tableData = order.line_items.map((item) => {
        let details = '';
        if (item.parsed_configurator && item.parsed_configurator.length > 0) {
          details = item.parsed_configurator.map(c => c.layer_name + ': ' + c.name).join(', ');
        }
        return [
          item.name + (details ? '\n  Custom Finish: ' + details : ''),
          String(item.quantity),
          formatCurrency(item.price || item.total, order.currency),
          formatCurrency(item.total, order.currency),
        ];
      });

      autoTable(doc, {
        startY: 82,
        head: [['Item & Configuration', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [243, 170, 24],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
        },
      });

      // Totals
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Shipping Total: ' + formatCurrency(order.shipping_total || 0, order.currency), 195, finalY, { align: 'right' });
      doc.setFontSize(11);
      doc.setTextColor(243, 170, 24);
      doc.text('Order Total: ' + formatCurrency(order.total, order.currency), 195, finalY + 6, { align: 'right' });

      // Footer
      doc.setTextColor(140, 140, 140);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Thank you for ordering with Exacoat. Precision engineered in Indonesia.', 105, 280, { align: 'center' });

      if (action === 'download') {
        doc.save('exacoat-packing-slip-' + order.number + '.pdf');
      } else {
        window.open(doc.output('bloburl'), '_blank');
      }
    } catch (e) {
      console.error('Failed generating invoice', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0d0d11] border border-white/[0.1] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#f3aa18]" />
            <h2 className="text-lg font-bold text-white font-chakra">
              Customer Packing Slip & Invoice
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3 text-sm text-zinc-300">
          <p>
            Generate a branded PDF packing slip and invoice for order <strong className="text-white font-mono">#{order.number}</strong>.
          </p>
          <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-400">Recipient:</span>
              <span className="text-zinc-100 font-medium">
                {order.shipping?.first_name} {order.shipping?.last_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Items:</span>
              <span className="text-zinc-100 font-medium">{order.line_items.length} items</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Amount:</span>
              <span className="text-[#f3aa18] font-bold">{formatCurrency(order.total, order.currency)}</span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/[0.08] flex items-center justify-end gap-3 bg-[#08080a]">
          <Button variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => generateInvoice('download')}
            isLoading={isGenerating}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => generateInvoice('preview')}
            isLoading={isGenerating}
            className="gap-2 font-bold"
          >
            <FileText className="w-4 h-4" />
            <span>Open PDF Preview</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
