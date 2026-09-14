import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Order } from '../../types';
import { Button } from '../ui/Button';
import { Printer, Download, X, Package } from 'lucide-react';
import { stripEmDashes } from '../../lib/formatters';

interface ShippingLabelA6ModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const ShippingLabelA6Modal: React.FC<ShippingLabelA6ModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const courier = order.shipping_lines?.[0]?.method_title || 'Standard Courier';
  const trackingNumber = order.tracking_number || 'PENDING-AWB';
  const recipient = order.shipping || order.billing;
  const recipientName = stripEmDashes((recipient.first_name + ' ' + recipient.last_name).trim() || 'Valued Customer');
  const recipientPhone = order.formatted_phone || recipient.phone || 'No phone provided';

  const fullAddress = [
    recipient.address_1,
    recipient.address_2,
    order.shipping_subdistrict ? 'Kel. ' + order.shipping_subdistrict : '',
    order.shipping_district ? 'Kec. ' + order.shipping_district : '',
    recipient.city,
    recipient.state,
    recipient.postcode,
    recipient.country,
  ].filter(Boolean).join(', ');

  const generateA6Pdf = (action: 'download' | 'print') => {
    setIsGenerating(true);
    try {
      // 105 x 148 mm A6 format
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [105, 148],
      });

      // Outer border
      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.5);
      doc.rect(4, 4, 97, 140);

      // Header Banner
      doc.setFillColor(20, 20, 20);
      doc.rect(4, 4, 97, 14, 'F');
      doc.setTextColor(243, 170, 24); // Exacoat Amber
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('EXACOAT PRECISION SKINS', 7, 10);
      doc.setFontSize(7);
      doc.setTextColor(200, 200, 200);
      doc.text('Official Headless Fulfillment Hub', 7, 15);

      // Courier & Tracking Box
      doc.setFillColor(245, 245, 245);
      doc.rect(4, 18, 97, 18, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.line(4, 36, 101, 36);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('COURIER: ' + courier.toUpperCase(), 7, 24);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('AWB / RESI: ' + trackingNumber, 7, 32);

      // Recipient Section
      doc.setDrawColor(40, 40, 40);
      doc.line(4, 36, 101, 36);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('RECIPIENT / PENERIMA:', 7, 41);

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text(recipientName, 7, 46);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Tel: ' + recipientPhone, 7, 51);

      const splitAddress = doc.splitTextToSize(fullAddress, 90);
      doc.text(splitAddress, 7, 56);

      const addressHeight = splitAddress.length * 4;
      const senderY = Math.max(72, 56 + addressHeight + 4);

      // Sender Section
      doc.setDrawColor(200, 200, 200);
      doc.line(4, senderY, 101, senderY);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('SENDER / PENGIRIM:', 7, senderY + 5);

      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text('Exacoat Indonesia (Operations HQ)', 7, senderY + 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Jakarta Barat, DKI Jakarta, Indonesia - Contact: info@exacoat.com', 7, senderY + 14);

      // Items Checklist Section
      const itemsY = senderY + 18;
      doc.setDrawColor(40, 40, 40);
      doc.line(4, itemsY, 101, itemsY);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('CONTENTS / ORDER ITEMS #' + order.number + ':', 7, itemsY + 5);

      let currentItemY = itemsY + 10;
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);

      order.line_items.forEach((item, idx) => {
        if (currentItemY > 136) return;
        const itemName = item.quantity + 'x ' + item.name;
        doc.setFont('helvetica', 'bold');
        doc.text(itemName.substring(0, 45), 7, currentItemY);
        currentItemY += 4;

        if (item.parsed_configurator && item.parsed_configurator.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 80, 80);
          const configSummary = item.parsed_configurator
            .map(c => c.layer_name + ': ' + c.name)
            .join(' | ');
          const splitConfig = doc.splitTextToSize(configSummary, 88);
          doc.text(splitConfig, 9, currentItemY);
          currentItemY += splitConfig.length * 3.5;
          doc.setTextColor(0, 0, 0);
        }
      });

      // Bottom Barcode simulation text
      doc.setFontSize(6.5);
      doc.setTextColor(120, 120, 120);
      doc.text('* EXACOAT-A6-' + order.id + '-' + Date.now() + ' *', 52, 142, { align: 'center' });

      if (action === 'download') {
        doc.save('exacoat-shipping-label-order-' + order.number + '.pdf');
      } else {
        window.open(doc.output('bloburl'), '_blank');
      }
    } catch (e) {
      console.error('Failed generating PDF label', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0d0d11] border border-white/[0.1] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-[#f3aa18]" />
            <h2 className="text-lg font-bold text-white font-chakra">
              A6 Thermal Shipping Label
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="p-6 space-y-4">
          <div className="bg-white text-black p-4 rounded-xl border border-zinc-200 text-xs font-mono space-y-2">
            <div className="border-b border-zinc-300 pb-2 flex justify-between font-bold">
              <span>EXACOAT PRECISION SKINS</span>
              <span>ORDER #{order.number}</span>
            </div>
            <div className="py-1">
              <span className="font-bold">COURIER:</span> {courier}
              <br />
              <span className="font-bold text-sm">AWB: {trackingNumber}</span>
            </div>
            <div className="border-t border-zinc-300 pt-2">
              <span className="font-bold text-zinc-600 block">SHIP TO:</span>
              <span className="font-bold text-sm">{recipientName}</span>
              <p className="text-zinc-700">{recipientPhone}</p>
              <p className="text-zinc-600 leading-tight mt-1">{fullAddress}</p>
            </div>
            <div className="border-t border-zinc-300 pt-2">
              <span className="font-bold text-zinc-600 block">ITEMS ({order.line_items.length}):</span>
              {order.line_items.map((item, i) => (
                <div key={i} className="text-[11px] truncate">
                  {item.quantity}x {item.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 border-t border-white/[0.08] flex items-center justify-end gap-3 bg-[#08080a]">
          <Button variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => generateA6Pdf('download')}
            isLoading={isGenerating}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => generateA6Pdf('print')}
            isLoading={isGenerating}
            className="gap-2 font-bold"
          >
            <Printer className="w-4 h-4" />
            <span>Open Thermal Print View</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
