import JsBarcode from 'jsbarcode';
import { TikTokOrder } from './wordpressBridge';

/**
 * Generate standard Code-128 SVG barcode using JsBarcode
 */
export function generateBarcodeSvg(value: string, height = 48, width = 2): string {
  if (typeof document === 'undefined') return '';
  try {
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgNode, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      height,
      width,
    });
    svgNode.setAttribute('width', '100%');
    svgNode.style.display = 'block';
    svgNode.style.maxHeight = `${height}px`;
    return svgNode.outerHTML;
  } catch (err) {
    console.error('Failed to generate Code128 barcode:', err);
    return '';
  }
}

/**
 * Resolve courier logo SVG / markup based on carrier name
 */
function getCourierBadgeHtml(carrier = ''): string {
  const c = carrier.toLowerCase();

  if (c.includes('ninja')) {
    return `
      <div style="display:flex;align-items:center;padding:2px 6px;">
        <span style="font-family:Impact, Arial Black, sans-serif;font-size:18px;color:#C41230;letter-spacing:0.5px;">NINJA</span>
        <span style="font-family:Arial, sans-serif;font-size:10px;font-weight:bold;color:#222;margin-left:4px;">VAN</span>
      </div>
    `;
  }

  if (c.includes('j&t')) {
    return `
      <div style="display:flex;align-items:center;padding:2px 6px;">
        <span style="font-family:Impact, Arial Black, sans-serif;font-size:20px;color:#E60012;letter-spacing:0.5px;">J&T</span>
        <span style="font-family:Arial, sans-serif;font-size:10px;font-weight:900;color:#E60012;margin-left:4px;border:1px solid #E60012;padding:1px 3px;border-radius:2px;">EXPRESS</span>
      </div>
    `;
  }

  if (c.includes('sicepat')) {
    return `
      <div style="display:flex;align-items:center;padding:2px 6px;">
        <span style="font-family:Impact, Arial Black, sans-serif;font-size:19px;color:#CC0000;letter-spacing:0.5px;">SiCepat</span>
        <span style="font-family:Arial, sans-serif;font-size:9px;font-weight:bold;color:#333;margin-left:4px;">EKSPRES</span>
      </div>
    `;
  }

  if (c.includes('jne')) {
    return `
      <div style="display:flex;align-items:center;padding:2px 6px;">
        <span style="font-family:Impact, Arial Black, sans-serif;font-size:20px;color:#003399;letter-spacing:1px;">JNE</span>
        <span style="font-family:Arial, sans-serif;font-size:10px;font-weight:bold;color:#CC0000;margin-left:4px;">Express</span>
      </div>
    `;
  }

  return `
    <div style="font-family:Arial, sans-serif;font-size:14px;font-weight:bold;text-transform:uppercase;border:1px solid #000;padding:2px 8px;border-radius:4px;">
      ${carrier || 'TIKTOK LOGISTICS'}
    </div>
  `;
}

/**
 * Generate complete 100mm x 150mm HTML AWB for TikTok Shop thermal printing
 */
export function generateTikTokAwbHtml(order: TikTokOrder): string {
  const trackingNumber = order.tracking_number || order.order_id || 'PENDING';
  const orderId = order.order_id || order.order_sn || '';
  const carrier = order.shipping_carrier || 'J&T Express';

  const trackingBarcodeSvg = generateBarcodeSvg(trackingNumber, 52, 2.2);
  const orderBarcodeSvg = generateBarcodeSvg(orderId, 32, 1.6);
  const courierBadge = getCourierBadgeHtml(carrier);

  const cityUppercase = (order.recipient_city || 'INDONESIA').toUpperCase();
  const postcode = order.recipient_postcode || '';

  const itemsRows = (order.items || [])
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 4px 6px; font-family: monospace; font-size: 11px; text-align: center; vertical-align: top; width: 24px;">
          ${idx + 1}
        </td>
        <td style="padding: 4px 6px; vertical-align: top;">
          <div style="font-weight: bold; font-size: 11px; color: #111; line-height: 1.2;">
            ${item.item_name}
          </div>
          ${
            item.sku_name
              ? `<div style="font-size: 10px; color: #444; font-family: monospace; margin-top: 1px;">
                  Variant: ${item.sku_name}
                </div>`
              : ''
          }
        </td>
        <td style="padding: 4px 6px; font-family: monospace; font-size: 12px; font-weight: bold; text-align: center; vertical-align: top; width: 36px;">
          x${item.quantity}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>TikTok Shop AWB - ${orderId}</title>
      <style>
        @page {
          size: 100mm 150mm;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          background: #fff;
          color: #000;
          font-size: 11px;
          line-height: 1.3;
          padding: 4mm;
          width: 100mm;
          min-height: 150mm;
          max-height: 150mm;
          overflow: hidden;
          margin: 0 auto;
        }
        .awb-container {
          border: 2px solid #000;
          display: flex;
          flex-direction: column;
          height: 142mm;
          background: #fff;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding: 4px 8px;
          background: #fafafa;
        }
        .logo-box {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tt-badge {
          background: #000;
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }
        .routing-row {
          display: flex;
          border-bottom: 2px solid #000;
        }
        .routing-city {
          flex: 1;
          padding: 6px 8px;
          border-right: 2px solid #000;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .city-label {
          font-size: 9px;
          font-weight: bold;
          text-transform: uppercase;
          color: #555;
        }
        .city-value {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.5px;
          line-height: 1.1;
        }
        .routing-postcode {
          width: 80px;
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: #f4f4f5;
        }
        .postcode-value {
          font-size: 16px;
          font-weight: 900;
          font-family: monospace;
        }
        .barcode-section {
          padding: 6px 8px;
          border-bottom: 2px solid #000;
          text-align: center;
          background: #fff;
        }
        .barcode-svg-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 2px;
        }
        .tracking-number-text {
          font-family: monospace;
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 2px;
        }
        .parties-row {
          display: flex;
          border-bottom: 2px solid #000;
          flex: 1;
          min-height: 0;
        }
        .recipient-box {
          flex: 6;
          padding: 6px 8px;
          border-right: 1px solid #000;
          display: flex;
          flex-direction: column;
          font-size: 10.5px;
        }
        .sender-box {
          flex: 4;
          padding: 6px 8px;
          display: flex;
          flex-direction: column;
          font-size: 10px;
          background: #fafafa;
        }
        .box-title {
          font-size: 8.5px;
          font-weight: 900;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 3px;
        }
        .person-name {
          font-weight: bold;
          font-size: 11px;
          color: #000;
          margin-bottom: 2px;
        }
        .person-phone {
          font-family: monospace;
          font-weight: 600;
          margin-bottom: 3px;
        }
        .person-address {
          line-height: 1.25;
          color: #222;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
        }
        .manifest-section {
          border-bottom: 2px solid #000;
          max-height: 38mm;
          overflow: hidden;
          background: #fff;
        }
        .manifest-table {
          width: 100%;
          border-collapse: collapse;
        }
        .footer-row {
          padding: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f9fafb;
          font-size: 9px;
        }
        .order-meta-box {
          display: flex;
          flex-direction: column;
        }
      </style>
    </head>
    <body>
      <div class="awb-container">
        <!-- Header: Platform & Courier -->
        <div class="header-row">
          <div class="logo-box">
            <span class="tt-badge">TikTok Shop</span>
            <span style="font-weight:bold; font-size:11px; letter-spacing:0.5px;">EXACOAT</span>
          </div>
          <div>
            ${courierBadge}
          </div>
        </div>

        <!-- Destination Routing -->
        <div class="routing-row">
          <div class="routing-city">
            <span class="city-label">Destination</span>
            <span class="city-value">${cityUppercase}</span>
          </div>
          <div class="routing-postcode">
            <span class="city-label">Zip Code</span>
            <span class="postcode-value">${postcode || '------'}</span>
          </div>
        </div>

        <!-- Main Tracking Barcode -->
        <div class="barcode-section">
          <div class="barcode-svg-wrap">
            ${trackingBarcodeSvg}
          </div>
          <div class="tracking-number-text">${trackingNumber}</div>
        </div>

        <!-- Addresses (Recipient vs Sender) -->
        <div class="parties-row">
          <div class="recipient-box">
            <div class="box-title">Penerima (To):</div>
            <div class="person-name">${order.recipient_name || order.buyer_username}</div>
            <div class="person-phone">${order.recipient_phone || '-'}</div>
            <div class="person-address">${order.recipient_address || '-'}</div>
          </div>
          <div class="sender-box">
            <div class="box-title">Pengirim (From):</div>
            <div class="person-name">Exacoat Indonesia</div>
            <div class="person-phone">0812-1000-8800</div>
            <div class="person-address">Exacoat HQ, Bekasi, Jawa Barat</div>
          </div>
        </div>

        <!-- Package Manifest / Items Table -->
        <div class="manifest-section">
          <div style="font-size: 8.5px; font-weight: bold; background: #e5e7eb; padding: 2px 6px; text-transform: uppercase;">
            Isi Paket (${order.items?.length || 0} Item)
          </div>
          <table class="manifest-table">
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <!-- Footer / Order ID Barcode -->
        <div class="footer-row">
          <div class="order-meta-box">
            <span style="font-weight: bold; font-size: 9.5px;">Order ID: #${orderId}</span>
            <span style="color: #666; font-size: 8.5px;">${order.create_time} | Non-COD</span>
          </div>
          <div style="width: 100px;">
            ${orderBarcodeSvg}
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
}
