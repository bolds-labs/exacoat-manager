import JsBarcode from 'jsbarcode';
import { ShopeeOrder } from './wordpressBridge';

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
function getCourierBadgeHtml(carrier: string = ''): string {
  const c = carrier.toLowerCase();

  if (c.includes('anteraja')) {
    return `
      <div style="display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 100 40" width="80" height="32">
          <path d="M15 25 C10 25 5 20 5 15 C5 10 10 5 15 5 C25 5 35 25 45 25 C50 25 55 20 55 15" fill="none" stroke="#E6007E" stroke-width="5" stroke-linecap="round"/>
          <circle cx="55" cy="15" r="4" fill="#F7941D"/>
          <text x="62" y="24" font-family="'Segoe UI', Arial, sans-serif" font-weight="900" font-size="14" fill="#E6007E">anteraja</text>
        </svg>
      </div>
    `;
  }

  if (c.includes('spx') || c.includes('shopee xpress')) {
    return `
      <div style="display:flex;align-items:center;gap:6px;border:2px solid #EE4D2D;padding:3px 8px;border-radius:6px;background:#FFF5F1;">
        <span style="font-family:Impact, Arial Black, sans-serif;font-size:18px;color:#EE4D2D;letter-spacing:0.5px;">SPX</span>
        <span style="font-family:Arial, sans-serif;font-size:11px;font-weight:bold;color:#222;text-transform:uppercase;">Express</span>
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
      ${carrier || 'STANDARD'}
    </div>
  `;
}

/**
 * Determine shipping service code (REG, HEMAT, INSTANT, CARGO)
 */
function getServiceCode(carrier: string = ''): string {
  const c = carrier.toUpperCase();
  if (c.includes('INSTANT')) return 'INSTANT';
  if (c.includes('SAMEDAY')) return 'SAMEDAY';
  if (c.includes('HEMAT') || c.includes('ECONOMY')) return 'HEMAT';
  if (c.includes('CARGO') || c.includes('KARGO')) return 'CARGO';
  if (c.includes('NEXT DAY')) return 'NEXT DAY';
  return 'REG';
}

/**
 * Extract clean Kota/Kabupaten and Kecamatan for the destination routing boxes
 */
function extractRoutingZones(order: ShopeeOrder): { city: string; district: string } {
  let city = order.recipient_city || 'KOTA JAKARTA SELATAN';
  let district = order.recipient_district || '';

  // If district empty, attempt parse from recipient_address
  if (!district && order.recipient_address) {
    const parts = order.recipient_address.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (
        part.toLowerCase().includes('kecamatan') ||
        part.toLowerCase().includes('kec.') ||
        part.toLowerCase().includes('setia budi') ||
        part.toLowerCase().includes('kebon') ||
        part.toLowerCase().includes('menteng')
      ) {
        district = part.replace(/kecamatan|kec\./gi, '').trim();
        break;
      }
    }
  }

  if (!district) {
    district = 'SETIA BUDI';
  }

  city = city.toUpperCase();
  district = district.toUpperCase();

  return { city, district };
}

/**
 * Format timestamp into Indonesian DD-MM-YYYY
 */
function formatDateDDMMYYYY(timestampSeconds?: number): string {
  const d = timestampSeconds ? new Date(timestampSeconds * 1000) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Generate official Shopee 100x150mm Thermal Air Waybill HTML
 */
export function generateShopeeAwbHtml(order: ShopeeOrder): string {
  const trackingNumber = order.tracking_number || `SPXID${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const orderSn = order.order_sn;
  const resiBarcodeSvg = generateBarcodeSvg(trackingNumber, 52, 2);
  const orderBarcodeSvg = generateBarcodeSvg(orderSn, 34, 1.6);
  const serviceCode = getServiceCode(order.shipping_carrier);
  const courierBadge = getCourierBadgeHtml(order.shipping_carrier);
  const routing = extractRoutingZones(order);

  // Delivery cutoff date (order create time + 2 days)
  const rawTime =
    order.create_timestamp ||
    (order.create_time ? Date.parse(order.create_time) / 1000 : 0) ||
    Math.floor(Date.now() / 1000);
  const cutoffTime = rawTime + 2 * 86400;
  const cutoffDateStr = formatDateDDMMYYYY(cutoffTime);

  // Recipient info
  const recipientName = order.recipient_name || order.buyer_username || 'Pelanggan Shopee';
  const recipientPhone = order.recipient_phone || '081298765432';
  const recipientAddress =
    order.recipient_address ||
    'Jalan Pal Batu Raya No. 4, RT.1/RW.4, Setia Budi, KOTA JAKARTA SELATAN, DKI JAKARTA';
  const recipientPostcode = order.recipient_postcode ? `(${order.recipient_postcode})` : '';

  // Items rows
  const items =
    order.items && order.items.length > 0
      ? order.items
      : [
          {
            item_id: 1,
            item_name: 'Exacoat Skin Precision Wrap',
            item_sku: 'EXA-SKN-01',
            model_id: 0,
            model_name: 'Full Body - Matte Black',
            quantity: 1,
            price: order.total_amount,
            image_url: '',
          },
        ];

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Shopee Air Waybill - ${orderSn}</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 3mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      width: 100mm;
      min-height: 145mm;
      box-sizing: border-box;
    }
    .awb-card {
      border: 1.5px solid #000;
      width: 100%;
      height: 100%;
      padding: 2mm;
      background: #fff;
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid #000;
      padding-bottom: 2mm;
      margin-bottom: 1.5mm;
    }
    .shopee-brand {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .service-type {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-align: center;
      flex: 1;
    }
    .resi-box {
      border: 1.2px solid #000;
      border-radius: 2px;
      padding: 2mm;
      text-align: center;
      margin-bottom: 2mm;
    }
    .resi-number-title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
    }
    .barcode-svg-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      margin-bottom: 1mm;
    }
    .barcode-svg-container svg {
      width: 100% !important;
      height: 48px !important;
    }
    .dotted-divider {
      border-top: 1.2px dotted #000;
      margin: 1.5mm 0;
    }
    .columns-row {
      display: flex;
      gap: 3mm;
      margin-bottom: 2mm;
    }
    .col-left {
      flex: 1.3;
      padding-right: 2mm;
      border-right: 1px dashed #444;
    }
    .col-right {
      flex: 1;
    }
    .badge-pill {
      display: inline-block;
      border: 1px solid #000;
      font-size: 8px;
      font-weight: 900;
      padding: 0.5px 3px;
      border-radius: 2px;
      margin-left: 3px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .address-text {
      font-size: 9.5px;
      line-height: 1.3;
      margin-top: 1mm;
      word-break: break-word;
    }
    .routing-boxes-row {
      display: flex;
      gap: 2mm;
      margin-bottom: 1.5mm;
    }
    .routing-box {
      flex: 1;
      border: 1.2px solid #000;
      padding: 1.5mm 2mm;
      text-align: center;
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .cashless-row {
      display: flex;
      border: 1.2px solid #000;
      margin-bottom: 1.5mm;
    }
    .cashless-badge {
      width: 32%;
      padding: 1.5mm 2mm;
      border-right: 1.2px solid #000;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-align: center;
    }
    .cashless-note {
      flex: 1;
      padding: 1.5mm 2mm;
      font-size: 9px;
      font-style: italic;
      display: flex;
      align-items: center;
    }
    .meta-barcode-row {
      display: flex;
      align-items: center;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 1.5mm 0;
      margin-bottom: 1.5mm;
    }
    .meta-details {
      flex: 1.1;
      font-size: 9px;
      line-height: 1.4;
    }
    .meta-barcode {
      flex: 0.9;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      overflow: hidden;
    }
    .meta-barcode svg {
      width: 100% !important;
      height: 32px !important;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8px;
    }
    .items-table th {
      border: 0.8px solid #000;
      padding: 1mm;
      text-align: left;
      font-weight: 900;
      background: #f0f0f0;
      text-transform: uppercase;
    }
    .items-table td {
      border: 0.8px solid #000;
      padding: 1mm;
      vertical-align: top;
    }
    .print-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #1e1e1e;
      color: #fff;
      margin-bottom: 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .btn-print {
      background: #EE4D2D;
      color: #fff;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-print:hover {
      background: #d63c1e;
    }
    .paper-hint {
      color: #aaa;
      font-size: 11px;
    }
    @media print {
      .print-toolbar {
        display: none !important;
      }
      body {
        padding: 0;
        margin: 0;
      }
      .awb-card {
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button type="button" onclick="window.print()" class="btn-print">Print Air Waybill</button>
    <span class="paper-hint">Ukuran: 100 x 150 mm Thermal Sticker</span>
  </div>

  <div class="awb-card">
    <!-- Header -->
    <div class="header-row">
      <div class="shopee-brand">
        <svg viewBox="0 0 120 40" width="95" height="32">
          <!-- Shopee Shopping Bag -->
          <path d="M12 12 C12 8 16 5 21 5 C26 5 30 8 30 12 L33 12 C34.5 12 35.5 13.5 35 15 L32 34 C31.5 36 30 37 28 37 L14 37 C12 37 10.5 36 10 34 L7 15 C6.5 13.5 7.5 12 9 12 Z" fill="#EE4D2D"/>
          <path d="M15 12 C15 9 17.5 7.5 21 7.5 C24.5 7.5 27 9 27 12" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M22.5 18 C20 18 18.5 19 18.5 20.5 C18.5 23.5 24 23 24 26 C24 27.5 22.5 28.5 20.5 28.5 C18.5 28.5 17 27.5 16.5 26" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
          <!-- Shopee Wordmark -->
          <text x="42" y="27" font-family="-apple-system, BlinkMacSystemFont, Arial, sans-serif" font-weight="900" font-size="20" fill="#EE4D2D" letter-spacing="-0.5px">Shopee</text>
        </svg>
      </div>
      <div class="service-type">${serviceCode}</div>
      <div class="courier-badge">${courierBadge}</div>
    </div>

    <!-- Tracking Resi Box -->
    <div class="resi-box">
      <div class="resi-number-title">No. Resi: ${trackingNumber}</div>
      <div class="barcode-svg-container">
        ${resiBarcodeSvg}
      </div>
    </div>

    <div class="dotted-divider"></div>

    <!-- Sender & Receiver Columns -->
    <div class="columns-row">
      <div class="col-left">
        <div>
          <strong>Penerima:</strong> ${recipientName}
          <span class="badge-pill">HOME</span>
        </div>
        <div class="address-text">
          ${recipientAddress} ${recipientPostcode}
        </div>
      </div>

      <div class="col-right">
        <div><strong>Pengirim:</strong> EXACOAT OFFICIAL</div>
        <div style="font-size: 9px; margin-top: 1mm;">081222968375</div>
        <div style="font-size: 9px; font-weight: bold; margin-top: 1mm;">KOTA JAKARTA PUSAT</div>
      </div>
    </div>

    <!-- Routing Sub-boxes -->
    <div class="routing-boxes-row">
      <div class="routing-box">${routing.city}</div>
      <div class="routing-box">${routing.district}</div>
    </div>

    <!-- Cashless Banner -->
    <div class="cashless-row">
      <div class="cashless-badge">CASHLESS</div>
      <div class="cashless-note">Penjual tidak perlu bayar ongkir ke Kurir</div>
    </div>

    <!-- Weight, COD, Batas Kirim & Secondary Barcode -->
    <div class="meta-barcode-row">
      <div class="meta-details">
        <div><strong>Berat:</strong> 150 gr &nbsp;&nbsp;&nbsp; <strong>COD:</strong> Rp0</div>
        <div><strong>Batas Kirim:</strong> ${cutoffDateStr}</div>
        <div style="margin-top: 1px;"><strong>No. Pesanan:</strong> ${orderSn}</div>
      </div>
      <div class="meta-barcode">
        ${orderBarcodeSvg}
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 20px;">#</th>
          <th>Nama Produk</th>
          <th style="width: 55px;">SKU</th>
          <th style="width: 40px;">Lokasi</th>
          <th style="width: 80px;">Variasi</th>
          <th style="width: 25px; text-align: center;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (it, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>
              <strong>${it.item_name}</strong>
              <div style="font-size: 7.5px; color: #333; margin-top: 1px;">Pesan: (${orderSn})</div>
            </td>
            <td>${it.item_sku || it.model_sku || '-'}</td>
            <td>-</td>
            <td>${it.model_name || 'Standard'}</td>
            <td style="text-align: center; font-weight: bold;">${it.quantity || 1}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
