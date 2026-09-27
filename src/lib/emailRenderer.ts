/**
 * Exacoat Standalone Email Template Renderer
 * High-fidelity client-side email renderer for immediate, 100% accurate previews in Manager ERP.
 * Matches WooCommerce transactional customer emails and Exacoat brand guidelines.
 * Strict Antislop compliant: No em dashes in copy or notifications.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  isLightMode: boolean;
}

export function renderEmailHtmlLocally(event: string, customData: Record<string, any> = {}): RenderedEmail {
  if (event === 'customer_reset_password' || event === 'customer_new_account') {
    return renderCustomerAccountEmail(event, customData);
  } else if (event === 'customer_order_review_invitation') {
    return renderReviewInvitationEmail(customData);
  } else if (event === 'customer_order_review_reward') {
    return renderReviewRewardEmail(customData);
  } else if (event === 'customer_cashback_earned' || event === 'customer_store_credit_reminder' || event === 'customer_store_credit_pre_expiry') {
    return renderStoreCreditEmail(event, customData);
  } else if (event.startsWith('creator_') || event.startsWith('affiliate_')) {
    return renderCreatorEmail(event, customData);
  } else if (event.startsWith('customer_cart_abandoned_')) {
    return renderAbandonedCartEmail(event, customData);
  } else if (event.startsWith('customer_order_')) {
    return renderCustomerOrderEmail(event, customData);
  } else {
    return renderFallbackEmail(event, customData);
  }
}

function escapeHtml(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function cleanEmailPrice(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  let str = String(val);
  // Strip HTML tags
  str = str.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  str = str
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
  // Normalize whitespace and non-breaking spaces
  str = str.replace(/[\u00A0\s]+/g, ' ').trim();
  return str;
}

export function isPriceZero(val: any): boolean {
  if (val === null || val === undefined || val === '') return true;
  if (typeof val === 'number') return val === 0;
  const clean = cleanEmailPrice(val);
  if (!clean || clean === '0' || clean === '0.00' || clean.toLowerCase() === 'free' || clean === '-') return true;
  const digits = clean.replace(/[^\d]/g, '');
  if (digits.length === 0) return true;
  return parseInt(digits, 10) === 0;
}

export const BRAND_LOGO_HTML = `
  <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="136" height="24" viewBox="0 0 1368000 241000" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" style="display:block;border:0;outline:none;width:136px;height:24px;">
    <path fill="#000000" fill-rule="nonzero" d="M1281000 218000l0 -40000 22000 -23000 43000 0 22000 23000 0 40000 -22000 23000 -43000 0 -22000 -23000zm59000 10000l14000 -14000 0 -32000 -14000 -14000 -31000 0 -14000 14000 0 32000 14000 14000 31000 0zm-33000 -52000l28000 0 8000 8000 0 13000 -5000 5000 6000 6000 0 10000 -12000 0 0 -7000 -4000 -5000 -9000 0 0 12000 -12000 0 0 -42000zm22000 20000l3000 -2000 0 -5000 -3000 -3000 -10000 0 0 10000 10000 0z"/>
    <path fill="#000000" fill-rule="nonzero" d="M0 202000l0 -108000 36000 -36000 97000 0 37000 36000 0 67000 -129000 0 0 29000 13000 14000 62000 0 13000 -13000 0 -11000 40000 0 0 23000 -35000 35000 -99000 0 -35000 -36000zm129000 -70000l0 -25000 -14000 -15000 -60000 0 -14000 15000 0 25000 88000 0zm180000 106000l-43000 -60000 -44000 60000 -45000 0 66000 -91000 -65000 -89000 46000 0 42000 58000 41000 -58000 46000 0 -64000 89000 66000 91000 -46000 0zm51000 -32000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -74000 0 -11000 11000 0 22000 11000 11000 44000 0zm102000 -4000l0 -108000 35000 -36000 95000 0 35000 36000 0 30000 -40000 0 0 -17000 -15000 -14000 -55000 0 -15000 14000 0 82000 15000 14000 55000 0 15000 -14000 0 -17000 40000 0 0 30000 -35000 36000 -95000 0 -35000 -36000zm188000 0l0 -108000 36000 -36000 100000 0 36000 36000 0 108000 -36000 36000 -100000 0 -36000 -36000zm116000 2000l15000 -15000 0 -82000 -15000 -14000 -60000 0 -15000 14000 0 82000 15000 15000 60000 0zm84000 2000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -73000 0 -12000 11000 0 22000 11000 11000 44000 0zm118000 -4000l0 -109000 -33000 0 0 -35000 34000 0 0 -58000 40000 0 0 58000 55000 0 0 35000 -55000 0 0 96000 14000 14000 41000 0 0 35000 -60000 0 -36000 -36000z"/>
  </svg>
`;

export const BRAND_WORDMARK_HTML = BRAND_LOGO_HTML;

export const BRAND_LOGO_WHITE_HTML = `
  <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="136" height="24" viewBox="0 0 1368000 241000" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" style="display:block;border:0;outline:none;width:136px;height:24px;">
    <path fill="#ffffff" fill-rule="nonzero" d="M1281000 218000l0 -40000 22000 -23000 43000 0 22000 23000 0 40000 -22000 23000 -43000 0 -22000 -23000zm59000 10000l14000 -14000 0 -32000 -14000 -14000 -31000 0 -14000 14000 0 32000 14000 14000 31000 0zm-33000 -52000l28000 0 8000 8000 0 13000 -5000 5000 6000 6000 0 10000 -12000 0 0 -7000 -4000 -5000 -9000 0 0 12000 -12000 0 0 -42000zm22000 20000l3000 -2000 0 -5000 -3000 -3000 -10000 0 0 10000 10000 0z"/>
    <path fill="#ffffff" fill-rule="nonzero" d="M0 202000l0 -108000 36000 -36000 97000 0 37000 36000 0 67000 -129000 0 0 29000 13000 14000 62000 0 13000 -13000 0 -11000 40000 0 0 23000 -35000 35000 -99000 0 -35000 -36000zm129000 -70000l0 -25000 -14000 -15000 -60000 0 -14000 15000 0 25000 88000 0zm180000 106000l-43000 -60000 -44000 60000 -45000 0 66000 -91000 -65000 -89000 46000 0 42000 58000 41000 -58000 46000 0 -64000 89000 66000 91000 -46000 0zm51000 -32000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -74000 0 -11000 11000 0 22000 11000 11000 44000 0zm102000 -4000l0 -108000 35000 -36000 95000 0 35000 36000 0 30000 -40000 0 0 -17000 -15000 -14000 -55000 0 -15000 14000 0 82000 15000 14000 55000 0 15000 -14000 0 -17000 40000 0 0 30000 -35000 36000 -95000 0 -35000 -36000zm188000 0l0 -108000 36000 -36000 100000 0 36000 36000 0 108000 -36000 36000 -100000 0 -36000 -36000zm116000 2000l15000 -15000 0 -82000 -15000 -14000 -60000 0 -15000 14000 0 82000 15000 15000 60000 0zm84000 2000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -73000 0 -12000 11000 0 22000 11000 11000 44000 0zm118000 -4000l0 -109000 -33000 0 0 -35000 34000 0 0 -58000 40000 0 0 58000 55000 0 0 35000 -55000 0 0 96000 14000 14000 41000 0 0 35000 -60000 0 -36000 -36000z"/>
  </svg>
`;

function renderCustomerAccountEmail(event: string, data: Record<string, any>): RenderedEmail {
  const custName = escapeHtml(data.customer_first_name || data.display_name || 'Customer');

  if (event === 'customer_reset_password') {
    const resetUrl = escapeHtml(data.reset_url || 'https://exacoat.com/my-account/lost-password/?key=sample_security_token');
    const subject = 'Password reset for your Exacoat account';
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7" style="background-color:#f7f7f7;padding:44px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;" class="mobile-padding">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${BRAND_LOGO_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #e4e4e7;letter-spacing:0.3px;">Account security</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 32px;" class="mobile-padding">
                <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;">Reset your password</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#3f3f46;">
                  Someone has requested a password reset for your Exacoat account. If this was you, you can choose a new password using the link below.
                </p>
                <div style="margin:28px 0;">
                  <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;background:#111111;color:#ffffff;font-size:14px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    Reset Password &rarr;
                  </a>
                </div>
                <p style="margin:0 0 10px;font-size:13px;color:#71717a;line-height:1.6;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
                <p style="margin:0;font-size:12px;color:#a1a1aa;word-break:break-all;">
                  Button not working? Copy and paste this link: <br />
                  <a href="${resetUrl}" style="color:#71717a;text-decoration:underline;">${resetUrl}</a>
                </p>

                <!-- Dedicated Spacer above Support -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your account? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    return { subject, html, isLightMode: true };
  } else {
    const accountUrl = escapeHtml(data.account_url || 'https://exacoat.com/my-account');
    const subject = 'Welcome to Exacoat';
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7" style="background-color:#f7f7f7;padding:44px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;" class="mobile-padding">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${BRAND_LOGO_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #e4e4e7;letter-spacing:0.3px;">Account created</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 32px;" class="mobile-padding">
                <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;">Welcome to Exacoat</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#3f3f46;">
                  Your Exacoat account has been created. You can use your account to review orders, save delivery details, and track shipments.
                </p>
                <div style="margin:28px 0;">
                  <a href="${accountUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;background:#111111;color:#ffffff;font-size:14px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    Access Your Account &rarr;
                  </a>
                </div>

                <!-- Dedicated Spacer above Support -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your account? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    return { subject, html, isLightMode: true };
  }
}

function renderCustomerOrderEmail(event: string, data: Record<string, any>): RenderedEmail {
  const defaults = {
    order_number: '14589',
    order_date: 'September 14, 2026',
    customer_first_name: 'William',
    customer_email: 'customer@gmail.com',
    items: [
      {
        name: 'iPhone 16 Pro Skins',
        image_url: 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
        quantity: 1,
        price: 'Rp 149.000',
        total: 'Rp 149.000',
        meta: "Variant: Full Body\nTexture: Matrix Black",
      },
    ],
    subtotal: 'Rp 149.000',
    discount_total: '',
    shipping_total: 'Rp 15.000',
    shipping_method_name: 'JNE Reguler',
    total: 'Rp 164.000',
    payment_method_title: 'Midtrans / QRIS',
    shipping_address: 'William Vance\nJl. Sudirman No. 42\nJakarta Selatan 12190\nIndonesia',
    courier: 'JNE Express',
    tracking_number: 'JNE9842194829',
    tracking_url: 'https://www.jne.co.id',
  };

  const merged: Record<string, any> = { ...defaults, ...data };
  const orderNum = escapeHtml(merged.order_number);
  const custName = escapeHtml(merged.customer_first_name || 'William');

  const isStorePickup = Boolean(
    merged.is_store_pickup ||
    event === 'customer_order_store_pickup_ready' ||
    event === 'customer_order_store_pickup_completed'
  );

  let subject = `Your Exacoat order #${orderNum} is confirmed`;
  let badgeText = 'Order confirmed';
  let title = 'Order confirmed';
  let bodyPrimary = `Thank you for your order. We’ve received order #${orderNum} and our production team will begin preparing your order shortly.`;
  let bodySecondary = 'You can review your order and delivery details below.';
  let showShipment = false;
  let pickupActionHtml = '';

  if (event === 'customer_order_in_production') {
    subject = `Your Exacoat order #${orderNum} is in production`;
    badgeText = 'In production';
    title = 'In production';
    bodyPrimary = `Your custom skins for order #${orderNum} are now on our production line.`;
    bodySecondary = 'We will notify you as soon as your order is packaged and ready to ship.';
  } else if (event === 'customer_order_store_pickup_ready') {
    subject = `${custName}, your order (#${orderNum}) is ready for pick up`;
    badgeText = 'Ready for pick up';
    title = 'Your order is ready for pick up';
    bodyPrimary = `Your order <b>(#${orderNum})</b> is ready for pick up.<br>Bring your order number and get it installed for free on:`;
    bodySecondary = '';
  } else if (event === 'customer_order_store_pickup_completed') {
    subject = `${custName}, your order has been picked up`;
    badgeText = 'Picked up';
    title = 'Order picked up';
    bodyPrimary = `Your order <b>(#${orderNum})</b> has been picked up.<br>Leave a review and tell us about your experience!`;
    bodySecondary = '';
  } else if (event === 'customer_order_awaiting_pickup') {
    subject = `Your Exacoat order #${orderNum} is packaged and ready to ship`;
    badgeText = 'Ready to ship';
    title = 'Ready to ship';
    bodyPrimary = `Your order #${orderNum} has passed quality inspection and has been packaged for courier pickup.`;
    bodySecondary = 'Your tracking number will be activated once scanned at the logistics hub.';
  } else if (event === 'customer_order_shipped') {
    subject = `Your Exacoat order #${orderNum} is on its way`;
    badgeText = 'On its way';
    title = 'On its way to you';
    bodyPrimary = `Your order #${orderNum} has been dispatched and is on its way.`;
    bodySecondary = 'You can find your tracking details and order summary below.';
    showShipment = Boolean(merged.tracking_number);
  } else if (event === 'customer_order_completed') {
    subject = `Your Exacoat order #${orderNum} has arrived`;
    badgeText = 'Delivered';
    title = 'Delivered';
    bodyPrimary = `Your order #${orderNum} has been delivered by the courier.`;
    bodySecondary = 'We hope you enjoy your new skins. If you need any assistance, our support team is always here to help.';
  } else if (event === 'customer_order_refunded') {
    const refundAmt = escapeHtml(cleanEmailPrice(merged.refund_amount || 'Rp 149.000'));
    subject = `Refund confirmation for order #${orderNum}`;
    badgeText = 'Refund processed';
    title = 'Refund processed';
    bodyPrimary = `We have processed a refund of ${refundAmt} for order #${orderNum}.`;
    bodySecondary = 'Depending on your payment method or bank, the funds will reflect in your account within 3 to 5 business days.';
  } else if (event === 'customer_order_partially_refunded') {
    const refundAmt = escapeHtml(cleanEmailPrice(merged.refund_amount || 'Rp 50.000'));
    subject = `Partial refund for order #${orderNum}`;
    badgeText = 'Partial refund';
    title = 'Partial refund processed';
    bodyPrimary = `We have processed a partial refund of ${refundAmt} for order #${orderNum}.`;
    bodySecondary = 'Depending on your payment method or bank, the funds will reflect in your account within 3 to 5 business days.';
  } else if (event === 'customer_order_on_hold') {
    subject = `Your Exacoat order #${orderNum} is on hold`;
    badgeText = 'Payment pending';
    title = 'Order on hold';
    bodyPrimary = `We’ve received your order #${orderNum} and are awaiting payment confirmation.`;
    bodySecondary = 'Your order will enter production as soon as payment is confirmed.';
  } else if (event === 'customer_order_failed') {
    subject = `Payment incomplete for order #${orderNum}`;
    badgeText = 'Payment failed';
    title = 'Payment not completed';
    bodyPrimary = `We were unable to process payment for order #${orderNum}.`;
    bodySecondary = 'Your items remain saved in your cart. You can retry checkout with an alternative payment method.';
  } else if (event === 'customer_order_note') {
    const noteText = escapeHtml(merged.customer_note || 'Your order has been updated with new details.');
    subject = `Update regarding your Exacoat order #${orderNum}`;
    badgeText = 'Order update';
    title = 'Note regarding your order';
    bodyPrimary = `A note has been added to your order #${orderNum}:`;
    bodySecondary = `<div style="background:#fafafa;border:1px solid #e5e7eb;border-left:3px solid #f3aa18;padding:14px 18px;border-radius:0 12px 12px 0;margin:16px 0;font-size:14px;color:#18181b;line-height:1.6;">${noteText}</div>`;
  } else if (event === 'customer_order_invoice') {
    subject = `Order summary for order #${orderNum}`;
    badgeText = 'Order summary';
    title = 'Your order summary';
    bodyPrimary = `Here is a copy of your order details for order #${orderNum}.`;
    bodySecondary = 'You can review your complete order breakdown and delivery details below.';
    showShipment = Boolean(merged.tracking_number);
  }

  // Modern, Beautiful Shipment Card (Exacoat standard)
  let shipmentHtml = '';
  if (showShipment && merged.tracking_number) {
    const courier = escapeHtml(merged.courier || 'JNE Express');
    const trackingNum = escapeHtml(merged.tracking_number);
    const trackingUrl = escapeHtml(merged.tracking_url || `https://parcelsapp.com/en/tracking/${trackingNum}`);

    shipmentHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;margin:28px 0;">
      <tr>
        <td style="padding:22px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle">
                <span style="display:inline-block;padding:3px 9px;background:#e5e7eb;color:#374151;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;border-radius:6px;margin-bottom:8px;">Courier Dispatch</span>
                <p style="margin:0 0 5px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.2px;">${courier}</p>
                <p style="margin:0;font-size:12.5px;color:#6b7280;">Tracking: <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:700;color:#111827;background:#ffffff;padding:2px 8px;border-radius:6px;border:1px solid #e5e7eb;display:inline-block;font-size:13px;margin-left:4px;">${trackingNum}</span></p>
              </td>
              <td align="right" valign="middle" style="padding-left:16px;">
                <a href="${trackingUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 22px;background:#111111;color:#ffffff;font-size:13px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 6px rgba(0,0,0,0.08);white-space:nowrap;">
                  Track Package &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
  }

  // Store Pickup Action Card (Google Maps or Review CTA)
  if (event === 'customer_order_store_pickup_ready' || merged.pickup_ready) {
    pickupActionHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;margin:24px 0;">
      <tr>
        <td style="padding:22px 24px;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827;letter-spacing:-0.2px;">Exacoat Store Bekasi</p>
          <p style="margin:0 0 16px;font-size:13.5px;color:#4b5563;line-height:1.5;">Ruby Commercial TB-12, Summarecon Bekasi, Bekasi Utara</p>
          <a href="https://maps.app.goo.gl/B9Z2n98o5kM33k4q9" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;font-size:13px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;">Open in Google Maps &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#71717a;">Need help? <a href="https://exacoat.com/cs" target="_blank" rel="noopener noreferrer" style="color:#f3aa18;text-decoration:underline;font-weight:600;">Contact admin</a></p>`;
  } else if (event === 'customer_order_store_pickup_completed' || merged.pickup_review) {
    pickupActionHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;margin:24px 0;">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 16px;font-size:14.5px;color:#374151;font-weight:500;">Leave a review and tell us about your experience!</p>
          <a href="https://g.page/r/CZZ440l0WvPWEBM/review" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background:#111111;color:#ffffff;font-size:13.5px;font-weight:700;border-radius:100px;text-decoration:none;letter-spacing:0.2px;">Write a review &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#71717a;text-align:center;">Need help? <a href="https://exacoat.com/cs" target="_blank" rel="noopener noreferrer" style="color:#f3aa18;text-decoration:underline;font-weight:600;">Contact admin</a></p>`;
  }

  // Items rows with 80px thumbnail (supporting configured composite skin renders or regular products)
  const items = Array.isArray(merged.items) && merged.items.length > 0 ? merged.items : defaults.items;
  const itemsHtml = items.map((item: any) => {
    const rawName = String(item.name || 'Device Skin');
    const cleanName = escapeHtml(rawName.trim());
    
    // Parse specs/configuration (supports parsed_configurator array, meta string, or device_model)
    const specs: string[] = [];
    if (Array.isArray(item.parsed_configurator) && item.parsed_configurator.length > 0) {
      item.parsed_configurator.forEach((c: any) => {
        const layer = String(c.layer_name || c.name || '').trim();
        const choice = String(c.choice_name || c.choice_title || c.name || '').trim();
        if (layer && choice && layer.toLowerCase() !== choice.toLowerCase()) {
          specs.push(`${escapeHtml(layer)}: ${escapeHtml(choice)}`);
        } else if (choice) {
          specs.push(escapeHtml(choice));
        }
      });
    } else if (item.meta) {
      const metaStr = String(item.meta);
      const parts = metaStr.split(/\s*(?:&bull;|•|<br\s*\/?>|\r?\n|\|)\s*/i).filter(Boolean);
      parts.forEach((p) => {
        const clean = p.replace(/&bull;|•/g, '').trim();
        if (clean) specs.push(escapeHtml(clean));
      });
    } else if (item.device_model) {
      specs.push(escapeHtml(String(item.device_model).trim()));
    }
    const specsHtml = specs.length > 0
      ? `<p style="margin:0 0 6px;font-size:12px;color:#71717a;line-height:1.5;">${specs.join('<br>')}</p>`
      : '';

    const iImg = escapeHtml(item.image_url || item.image || 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg');
    const iQty = item.quantity || item.qty || 1;
    const rawItemPrice = item.subtotal || item.price || item.total || 'Rp 149.000';
    const iTot = escapeHtml(cleanEmailPrice(rawItemPrice));

    return `
    <tr>
      <td style="padding:18px 0;border-bottom:1px solid #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="80" valign="top" style="padding-right:18px;">
              <img src="${iImg}" width="80" height="80" alt="${cleanName}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:1px solid #e4e4e7;display:block;">
            </td>
            <td valign="top">
              <p style="margin:0 0 5px;font-size:15px;font-weight:600;color:#111111;line-height:1.4;">${cleanName}</p>
              ${specsHtml}
              <p style="margin:0;font-size:12.5px;color:#52525b;">Qty: <strong style="color:#111111;">${iQty}</strong></p>
            </td>
            <td align="right" valign="top" style="white-space:nowrap;padding-left:14px;">
              <span style="font-size:15px;font-weight:700;color:#111111;">${iTot}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  const subtotal = escapeHtml(cleanEmailPrice(merged.subtotal || 'Rp 149.000'));
  const discountTotal = escapeHtml(cleanEmailPrice(merged.discount_total || ''));
  const rawShipping = isStorePickup ? (merged.shipping_total || 'Rp 0') : (merged.shipping_total || 'Rp 15.000');
  const cleanShipping = cleanEmailPrice(rawShipping);
  const shippingTotal = escapeHtml(isPriceZero(cleanShipping) ? 'Free' : cleanShipping);
  const shippingName = escapeHtml(isStorePickup ? (merged.shipping_method_name || 'Store Pickup (Summarecon Bekasi)') : (merged.shipping_method_name || 'Standard'));
  const totalTax = escapeHtml(cleanEmailPrice(merged.total_tax || ''));
  const rawTotal = isStorePickup && !data.total ? (merged.subtotal || 'Rp 149.000') : (merged.total || (isStorePickup ? 'Rp 149.000' : 'Rp 164.000'));
  const total = escapeHtml(cleanEmailPrice(rawTotal) || 'Rp 164.000');
  const totalRefunded = escapeHtml(cleanEmailPrice(merged.total_refunded || ''));
  const paymentMeth = escapeHtml(merged.payment_method_title || 'Midtrans / QRIS');
  const shippingAddr = escapeHtml(merged.shipping_address || 'William Vance\nJl. Sudirman No. 42\nJakarta Selatan 12190\nIndonesia').replace(/\n/g, '<br>');

  let couponsRow = '';
  if (discountTotal && !isPriceZero(discountTotal)) {
    const couponList = Array.isArray(merged.coupon_codes) && merged.coupon_codes.length > 0
      ? ` (${merged.coupon_codes.map((c: any) => escapeHtml(String(c))).join(', ')})`
      : '';
    couponsRow = `
    <tr>
      <td style="padding:8px 0;font-size:13.5px;color:#52525b;">Discount${couponList}</td>
      <td align="right" style="padding:8px 0;font-size:13.5px;color:#059669;font-weight:600;">-${discountTotal}</td>
    </tr>`;
  }

  let taxRow = '';
  if (totalTax && !isPriceZero(totalTax)) {
    taxRow = `
    <tr>
      <td style="padding:8px 0;font-size:13.5px;color:#52525b;">Taxes / DDP</td>
      <td align="right" style="padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;">${totalTax}</td>
    </tr>`;
  }

  let refundRow = '';
  if (totalRefunded && !isPriceZero(totalRefunded)) {
    refundRow = `
    <tr>
      <td style="padding:8px 0;font-size:13.5px;color:#dc2626;font-weight:600;">Refunded Amount</td>
      <td align="right" style="padding:8px 0;font-size:13.5px;color:#dc2626;font-weight:700;">-${totalRefunded}</td>
    </tr>`;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .address-col { display: block !important; width: 100% !important; border-right: none !important; border-bottom: 1px solid #eeeeee !important; padding-bottom: 20px !important; margin-bottom: 20px !important; }
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7" style="background-color:#f7f7f7;padding:44px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <!-- Top Header (Logo + Badge) -->
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;" class="mobile-padding">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${BRAND_LOGO_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;background:#fff8eb;color:#d97706;font-size:11px;font-weight:700;border-radius:999px;border:1px solid #fef3c7;letter-spacing:0.3px;text-transform:uppercase;">${badgeText}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Message Headline & Body -->
            <tr>
              <td style="padding:36px 40px 32px;" class="mobile-padding">
                <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;">${title}</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 16px;font-size:14.5px;line-height:1.7;color:#3f3f46;">${bodyPrimary}</p>
                ${bodySecondary ? `<p style="margin:0 0 24px;font-size:14.5px;line-height:1.7;color:#52525b;">${bodySecondary}</p>` : ''}

                ${shipmentHtml}
                ${pickupActionHtml}

                <!-- Dedicated Spacer above Order Summary -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <!-- Order Summary Section -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;">
                  <tr>
                    <td style="padding-top:24px;padding-bottom:12px;">
                      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">Order Summary</p>
                    </td>
                  </tr>
                  ${itemsHtml}
                </table>

                <!-- Financial Breakdown -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;margin-bottom:32px;">
                  <tr>
                    <td style="padding:8px 0;font-size:13.5px;color:#52525b;">Subtotal</td>
                    <td align="right" style="padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;">${subtotal}</td>
                  </tr>
                  ${couponsRow}
                  <tr>
                    <td style="padding:8px 0;font-size:13.5px;color:#52525b;">Shipping (${shippingName})</td>
                    <td align="right" style="padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;">${shippingTotal}</td>
                  </tr>
                  ${taxRow}
                  ${refundRow}
                  <tr>
                    <td style="padding:16px 0 0;border-top:1px solid #e4e4e7;font-size:15px;font-weight:700;color:#111111;">Total</td>
                    <td align="right" style="padding:16px 0 0;border-top:1px solid #e4e4e7;font-size:17px;font-weight:800;color:#111111;">${total}</td>
                  </tr>
                </table>

                <!-- Delivery & Payment Information Card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eaeaea;border-radius:16px;margin-bottom:32px;">
                  <tr>
                    <td class="address-col" width="58%" valign="top" style="padding:22px 24px;border-right:1px solid #eaeaea;">
                      ${isStorePickup ? `
                        <p style="margin:0 0 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">Store Pickup Location</p>
                        <p style="margin:0;font-size:13px;line-height:1.65;color:#3f3f46;">Exacoat Store Bekasi<br>Ruby Commercial TB-12, Summarecon Bekasi, Bekasi Utara</p>
                      ` : `
                        <p style="margin:0 0 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">Shipping Address</p>
                        <p style="margin:0;font-size:13px;line-height:1.65;color:#3f3f46;">${shippingAddr}</p>
                      `}
                    </td>
                    <td class="address-col" width="42%" valign="top" style="padding:22px 24px;">
                      <p style="margin:0 0 8px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">Payment Method</p>
                      <p style="margin:0;font-size:14px;color:#111111;font-weight:600;line-height:1.4;">${paymentMeth}</p>
                    </td>
                  </tr>
                </table>

                <!-- Dedicated Spacer above Support -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <!-- Help & Support -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your order? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html, isLightMode: true };
}

function renderReviewInvitationEmail(data: Record<string, any>): RenderedEmail {
  const custName = escapeHtml(data.customer_first_name || 'Customer');
  const prodTitle = escapeHtml(data.product_title || 'iPhone 16 Pro Skin');
  const reviewUrl = escapeHtml(data.review_url || 'https://exacoat.com/review?order_id=14589');
  const subject = `How is your new Exacoat skin? Review ${prodTitle}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0; padding: 0; width: 100% !important; background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:44px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>${BRAND_LOGO_HTML}</td>
                    <td align="right">
                      <span style="display:inline-block;padding:5px 13px;background:#fff8eb;color:#d97706;font-size:11px;font-weight:700;border-radius:999px;border:1px solid #fef3c7;text-transform:uppercase;">Customer Review</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 32px;">
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#111111;letter-spacing:-0.5px;">How does your device look?</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#3f3f46;">
                  Your Exacoat skin was delivered recently. We'd love to know how your installation went and see your setup with <strong>${prodTitle}</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;">
                  Leave a review with photos of your device and we will send you an exclusive discount code for your next order.
                </p>
                <div style="margin:28px 0;">
                  <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;background:#f3aa18;color:#0a0a0a;font-size:14px;font-weight:800;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(243,170,24,0.35);">
                    Review Your Skin & Get Reward &rarr;
                  </a>
                </div>

                <!-- Dedicated Spacer above Support -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your order? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html, isLightMode: true };
}

function renderReviewRewardEmail(data: Record<string, any>): RenderedEmail {
  const custName = escapeHtml(data.customer_first_name || 'Customer');
  const couponCode = escapeHtml(data.coupon_code || 'EXAPERK-20-X8K9P');
  const discountPct = escapeHtml(data.discount_percent || '20');
  const shopUrl = escapeHtml(data.shop_url || 'https://exacoat.com/shop/');
  const subject = 'Your Exacoat perks promo code is here 🎁';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0; padding: 0; width: 100% !important; background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:44px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>${BRAND_LOGO_HTML}</td>
                    <td align="right">
                      <span style="display:inline-block;padding:5px 13px;background:#ecfdf5;color:#059669;font-size:11px;font-weight:700;border-radius:999px;border:1px solid #a7f3d0;text-transform:uppercase;">Perks Reward 🎁</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 32px;">
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#111111;letter-spacing:-0.5px;">Thank you for your review!</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#3f3f46;">
                  We loved seeing your review. As a token of our appreciation, here is your exclusive <strong>${discountPct}% discount code</strong> for your next Exacoat order.
                </p>
                
                <div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:16px;padding:24px;text-align:center;margin:28px 0;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Exclusive Promo Code (${discountPct}% Off)</div>
                  <div style="font-family:monospace;font-size:24px;font-weight:800;color:#111111;letter-spacing:2px;background:#ffffff;padding:10px 20px;border-radius:10px;display:inline-block;border:1px solid #fde68a;">
                    ${couponCode}
                  </div>
                </div>

                <div style="text-align:center;margin-top:24px;">
                  <a href="${shopUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;background:#111111;color:#ffffff;font-size:14px;font-weight:700;border-radius:100px;text-decoration:none;letter-spacing:0.2px;">
                    Shop Exacoat Catalog &rarr;
                  </a>
                </div>

                <!-- Dedicated Spacer above Support -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your order? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, html, isLightMode: true };
}

function renderStoreCreditEmail(event: string, data: Record<string, any>): RenderedEmail {
  const custName = escapeHtml(data.customer_first_name || data.customer_name || 'Customer');
  const balance = escapeHtml(cleanEmailPrice(data.store_credit_balance || 'Rp 50.000'));
  const cashbackAmount = escapeHtml(cleanEmailPrice(data.cashback_amount || 'Rp 25.000'));
  const expiryDate = escapeHtml(data.expiry_date || '');
  const orderNum = escapeHtml(data.order_number || '14589');
  const shopUrl = escapeHtml(data.shop_url || 'https://exacoat.com/shop/');

  const isCashback = event === 'customer_cashback_earned';
  const isPreExpiry = event === 'customer_store_credit_pre_expiry';
  const badgeText = isCashback ? 'Store Credit' : (isPreExpiry ? 'Expiring Soon' : 'Store Credit');
  const title = isCashback
    ? 'Your cashback is ready to use'
    : (isPreExpiry ? 'Your store credit is expiring soon' : 'Your store credit is waiting');
  const subject = isCashback
    ? `You received ${cashbackAmount} cashback on order #${orderNum}`
    : (isPreExpiry ? `Your ${balance} store credit expires in 30 days` : `You have ${balance} store credit waiting in your Exacoat account`);

  const bodyPrimary = isCashback
    ? `Your cashback of ${cashbackAmount} from order #${orderNum} has been credited to your Exacoat store credit balance.`
    : (isPreExpiry ? `A friendly reminder that your store credit balance of ${balance} is scheduled to expire in 30 days.` : `You still have ${balance} in store credit available in your Exacoat account.`);

  const bodySecondary = isCashback
    ? `Your available store credit balance is now ${balance}. You can apply it directly during checkout on your next order.`
    : (isPreExpiry ? 'Apply your balance during checkout on any precision device skin or accessories before it expires.' : 'Use it on your next precision skin, camera protection, or accessories. Simply log in and apply your balance at checkout.');

  const ctaText = isCashback
    ? 'Shop Device Skins'
    : (isPreExpiry ? 'Use Credit Before It Expires' : 'Use Your Credit');

  const cashbackPill = isCashback && cashbackAmount && !isPriceZero(cashbackAmount)
    ? `<div style="display:inline-block;padding:4px 12px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #a7f3d0;margin-top:10px;">
        +${cashbackAmount} Cashback from Order #${orderNum}
      </div>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0; padding: 0; width: 100% !important; background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .balance-text { font-size: 28px !important; }
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:44px 16px;">
    <tr>
      <td align="center">
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;" class="mobile-padding">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${BRAND_LOGO_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;background:#f4f4f5;color:#3f3f46;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #e4e4e7;letter-spacing:0.3px;">${badgeText}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 32px;" class="mobile-padding">
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#111111;letter-spacing:-0.5px;line-height:1.25;">${title}</h1>
                <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 14px;font-size:14.5px;line-height:1.7;color:#3f3f46;">${bodyPrimary}</p>
                <p style="margin:0 0 24px;font-size:14.5px;line-height:1.7;color:#52525b;">${bodySecondary}</p>

                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;margin-bottom:28px;">
                  <tr>
                    <td align="center" style="padding:26px 20px;">
                      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Available Store Credit</p>
                      <div style="margin:6px 0;">
                        <span class="balance-text" style="font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#111111;">${balance}</span>
                      </div>
                      ${cashbackPill}
                      <p style="margin:12px 0 0;font-size:12.5px;color:#71717a;">
                        ${expiryDate ? `Valid for 1 year &bull; Active through <strong style="color:#111111;">${expiryDate}</strong>` : 'Valid for 1 year &bull; Applied automatically at checkout'}
                      </p>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:6px 0 12px;">
                      <a href="${shopUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:600;color:#ffffff;background:#111111;border-radius:12px;text-decoration:none;letter-spacing:0.2px;">
                        ${ctaText} &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:8px;">
                      <span style="font-size:12px;color:#71717a;">Store credit is valid for 1 year from the date earned and applies automatically at checkout.</span>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your order or store credit? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, isLightMode: true };
}

function renderCreatorEmail(event: string, data: Record<string, any>): RenderedEmail {
  const creatorName = escapeHtml(data.creator_name || data.display_name || data.customer_first_name || 'Creator');
  const commissionAmount = escapeHtml(cleanEmailPrice(data.commission_amount || 'Rp 74.500'));
  const payoutAmount = escapeHtml(cleanEmailPrice(data.payout_amount || 'Rp 500.000'));
  const orderNumber = escapeHtml(data.order_number || '14890');
  const unpaidBalance = escapeHtml(cleanEmailPrice(data.unpaid_balance || 'Rp 324.500'));
  const bankName = escapeHtml(data.bank_name || 'BCA');
  const bankAcc = escapeHtml(data.bank_account_number || '8830192831');
  const bankAccName = escapeHtml(data.bank_account_name || '');
  const ref = escapeHtml(data.transfer_reference || '');
  const dashboardUrl = escapeHtml(data.dashboard_url || 'https://exacoat.com/?portal=affiliate');

  let subject = '';
  let badgeText = '';
  let title = '';
  let bodyPrimary = '';
  let bodySecondary = '';
  let cardContent = '';
  let ctaText = '';
  let footerNote = '';

  if (event === 'creator_payout_transferred') {
    subject = `Payout Transferred: ${payoutAmount} sent to your bank account`;
    badgeText = 'Payout Sent';
    title = 'Your payout is on the way';
    bodyPrimary = `We have processed your payout request of ${payoutAmount} and transferred the funds to your ${bankName} account.`;
    bodySecondary = `Account Number: ${bankAcc}`;
    ctaText = 'View Payout History';
    const refHtml = ref ? `<p style="margin:12px 0 0;font-size:12px;color:#71717a;">Reference: <strong style="color:#18181b;">${ref}</strong></p>` : '';
    cardContent = `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Transferred Payout</p>
      <div style="margin:6px 0;">
        <span class="balance-text" style="font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#111111;">${payoutAmount}</span>
      </div>
      <div style="display:inline-block;padding:4px 12px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #a7f3d0;margin-top:10px;">
        Transferred to ${bankName} &bull; ${bankAcc}
      </div>
      ${refHtml}
    `;
    footerNote = 'Bank transfers typically reflect within 1-2 business days depending on interbank clearing.';
  } else if (event === 'creator_payout_requested') {
    subject = `Payout Request Received: ${payoutAmount}`;
    badgeText = 'Payout Requested';
    title = 'Payout request received';
    bodyPrimary = `We received your payout request for ${payoutAmount} to your ${bankName} account (${bankAcc}). Our finance team processes payouts on a regular schedule and you will receive a confirmation once transferred.`;
    bodySecondary = bankAccName ? `Account Holder: ${bankAccName}` : '';
    ctaText = 'View Creator Workstation';
    cardContent = `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Requested Payout</p>
      <div style="margin:6px 0;">
        <span class="balance-text" style="font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#111111;">${payoutAmount}</span>
      </div>
      <div style="display:inline-block;padding:4px 12px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #fde68a;margin-top:10px;">
        Destination: ${bankName} &bull; ${bankAcc}
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#71717a;">
        Our finance team is reviewing your request.
      </p>
    `;
    footerNote = 'You will receive an email confirmation once the transfer is completed.';
  } else if (event === 'creator_commission_recorded') {
    subject = `New Referral Sale Recorded: Order #${orderNumber}`;
    badgeText = 'Referral Sale';
    title = 'New commission earned';
    bodyPrimary = `A customer just completed an order (#${orderNumber}) using your referral link or coupon.`;
    bodySecondary = `Your commission of ${commissionAmount} has been recorded and will mature into your withdrawable balance 7 days after the order is delivered.`;
    ctaText = 'View Creator Workstation';
    cardContent = `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Pending Commission</p>
      <div style="margin:6px 0;">
        <span class="balance-text" style="font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#f3aa18;">${commissionAmount}</span>
      </div>
      <div style="display:inline-block;padding:4px 12px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #fde68a;margin-top:10px;">
        Order #${orderNumber} &bull; Pending Grace Period
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#71717a;">
        Matures into withdrawable balance 7 days after delivery
      </p>
    `;
    footerNote = 'Track real-time visits, clicks, and conversion rates directly in your workstation.';
  } else {
    // creator_commission_available
    subject = `Commission Available: ${commissionAmount} from Order #${orderNumber}`;
    badgeText = 'Commission Available';
    title = 'Commission ready to withdraw';
    bodyPrimary = `Order #${orderNumber} has cleared the 7-day post-delivery grace period. Your commission of ${commissionAmount} is now unlocked and available in your withdrawable balance.`;
    bodySecondary = 'You can request a payout anytime to your configured BCA or Bank Mandiri account once your balance meets the minimum threshold of Rp 250.000.';
    ctaText = 'Go to Creator Workstation';
    const unpaidLine = unpaidBalance ? `<p style="margin:12px 0 0;font-size:12px;color:#71717a;">Current Withdrawable Balance: <strong style="color:#18181b;">${unpaidBalance}</strong></p>` : '';
    cardContent = `
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Withdrawable Commission</p>
      <div style="margin:6px 0;">
        <span class="balance-text" style="font-size:34px;font-weight:800;letter-spacing:-0.5px;color:#10b981;">${commissionAmount}</span>
      </div>
      <div style="display:inline-block;padding:4px 12px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;border-radius:9999px;border:1px solid #a7f3d0;margin-top:10px;">
        Order #${orderNumber} &bull; Cleared Grace Period
      </div>
      ${unpaidLine}
    `;
    footerNote = 'Payouts can be requested anytime once your balance reaches the minimum threshold of Rp 250.000.';
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0; padding: 0; width: 100% !important; background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .balance-text { font-size: 28px !important; }
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:44px 16px;">
    <tr>
      <td align="center">
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;border:1px solid #eaeaea;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.04);">
          <tbody>
            <tr>
              <td style="padding:32px 36px 20px;border-bottom:1px solid #f0f0f2;" class="mobile-padding">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${BRAND_LOGO_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 12px;background:#f4f4f5;color:#18181b;font-size:11px;font-weight:600;border-radius:9999px;border:1px solid #e4e4e7;">${badgeText}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 36px 28px;" class="mobile-padding">
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#111111;letter-spacing:-0.4px;line-height:1.3;">${title}</h1>
                <p style="margin:0 0 12px;font-size:15px;font-weight:500;color:#18181b;">Hi ${creatorName},</p>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3f3f46;">${bodyPrimary}</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;">${bodySecondary}</p>

                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;margin-bottom:28px;">
                  <tr>
                    <td align="center" style="padding:26px 20px;">
                      ${cardContent}
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:6px 0 12px;">
                      <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:15px 36px;font-size:14px;font-weight:600;color:#ffffff;background:#111111;border-radius:12px;text-decoration:none;letter-spacing:0.2px;">
                        ${ctaText} &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:8px;">
                      <span style="font-size:12px;color:#71717a;">${footerNote}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 36px 28px;background:#fcfcfd;border-top:1px solid #f0f0f2;text-align:center;" class="mobile-padding">
                <p style="margin:0 0 8px;font-size:12px;line-height:1.65;color:#71717a;">
                  Questions regarding your commissions or payout? Reach our partnership team at <a href="mailto:creators@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">creators@exacoat.com</a>
                </p>
                <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">
                  &copy; Exacoat Creator Program
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, isLightMode: true };
}

function renderAbandonedCartEmail(event: string, data: Record<string, any>): RenderedEmail {
  const isSecondEmail = event === 'customer_cart_abandoned_2' || String(data.sequence) === '2';
  const custName = escapeHtml(data.customer_first_name || data.display_name || 'there');
  const restoreUrl = escapeHtml(data.restore_url || 'https://exacoat.com/checkout/?restore_cart=mock_cart_token_98234');
  const unsubscribeUrl = escapeHtml(data.unsubscribe_url || 'https://exacoat.com/cart/?unsubscribe_cart=mock_cart_token_98234');

  const badgeText = escapeHtml(
    data.badge_text || (isSecondEmail ? 'Expiring Soon' : 'Cart Saved')
  );
  const badgeStyle = isSecondEmail
    ? 'background:#fff1f2;color:#e11d48;border:1px solid #ffe4e6;'
    : 'background:#fff8eb;color:#d97706;border:1px solid #fef3c7;';

  const subject = escapeHtml(
    data.subject || (isSecondEmail ? 'Before your cart clears...' : 'Something was left in your bag...')
  );
  const title = escapeHtml(
    data.title || (isSecondEmail ? 'Ready to complete your order?' : 'Still on your mind?')
  );
  const bodyPrimary = escapeHtml(
    data.body_primary ||
      (isSecondEmail
        ? 'Your selected items are still reserved, but your cart will clear soon. If you are still deciding, your setup is ready to go whenever you are.'
        : 'We noticed you left your items behind. We kept your selections and device configuration saved so you can pick up right where you left off.')
  );
  const bodySecondary = escapeHtml(
    data.body_secondary ||
      (isSecondEmail
        ? 'Once the timer expires, reserved items return to public inventory.'
        : 'Your items are reserved in your bag for a limited time.')
  );
  const ctaText = escapeHtml(
    data.cta_text || (isSecondEmail ? 'Complete Your Order' : 'Return to Bag')
  );

  const rawItems = Array.isArray(data.items) && data.items.length > 0 ? data.items : [
    {
      name: 'iPhone 16 Pro Skins',
      image_url: 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg',
      quantity: 1,
      price: 'Rp 149.000',
      meta: 'Coverage: Model Cut\nTexture: Black Camo',
    },
  ];

  const itemsRows = rawItems.map((item: any) => {
    const rawName = item.name || item.title || 'Device Protection';
    const cleanName = escapeHtml(rawName.replace(/\s*-\s*(Custom\s+)?(Skin|Wrap|Decal|Cover|Screen\s*Guard).*$/i, '').trim() || rawName);

    const specs: string[] = [];
    if (item.meta) {
      const metaStr = String(item.meta);
      const parts = metaStr.split(/\s*(?:&bull;|•|<br\s*\/?>|\r?\n|\|)\s*/i).filter(Boolean);
      parts.forEach((p) => {
        const clean = p.replace(/&bull;|•/g, '').trim();
        if (clean && !clean.toLowerCase().startsWith('image_url:')) {
          specs.push(escapeHtml(clean));
        }
      });
    }

    const specsHtml = specs.length > 0
      ? `<p style="margin:4px 0 0;font-size:12px;color:#71717a;line-height:1.4;">${specs.join('<br>')}</p>`
      : '';

    const iImg = escapeHtml(item.image_url || item.image || 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg');
    const iQty = item.quantity || item.qty || 1;
    const iPrice = escapeHtml(cleanEmailPrice(item.subtotal || item.price || item.total || 'Rp 149.000'));

    return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #f4f4f5;" valign="middle">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="72" valign="middle" style="width:72px;">
              <img src="${iImg}" alt="${cleanName}" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid #e4e4e7;display:block;">
            </td>
            <td valign="middle" style="padding-left:14px;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#18181b;letter-spacing:-0.2px;">${cleanName}</p>
              ${specsHtml}
              <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#a1a1aa;">Qty: ${iQty}</p>
            </td>
            <td align="right" valign="middle" style="white-space:nowrap;padding-left:12px;">
              <span style="font-size:14px;font-weight:700;color:#18181b;">${iPrice}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }).join('');

  const subtotal = escapeHtml(cleanEmailPrice(data.subtotal || data.total || 'Rp 149.000'));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f7f7f7;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 24px !important; padding-right: 24px !important; }
      .mobile-btn { width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body bgcolor="#f7f7f7" style="margin:0;padding:0;background-color:#f7f7f7;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f7f7" style="background-color:#f7f7f7;padding:44px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table class="container-table" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.04);">
          <tbody>
            <!-- Top Header (Logo + Badge) -->
            <tr>
              <td style="padding:28px 40px 22px;border-bottom:1px solid #f0f0f0;" class="mobile-padding">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      ${BRAND_LOGO_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;${badgeStyle}font-size:11px;font-weight:700;border-radius:999px;letter-spacing:0.3px;text-transform:uppercase;">${badgeText}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Message Headline & Body -->
            <tr>
              <td style="padding:36px 40px 32px;" class="mobile-padding">
                <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#111111;letter-spacing:-0.6px;line-height:1.25;">${title}</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 16px;font-size:14.5px;line-height:1.7;color:#3f3f46;">${bodyPrimary}</p>
                ${bodySecondary ? `<p style="margin:0 0 24px;font-size:14.5px;line-height:1.7;color:#52525b;">${bodySecondary}</p>` : ''}

                <!-- Primary Action Button -->
                <div style="margin:24px 0 32px;">
                  <a href="${restoreUrl}" target="_blank" rel="noopener noreferrer" class="mobile-btn" style="display:inline-block;padding:14px 32px;background:#111111;color:#ffffff;font-size:14px;font-weight:700;border-radius:12px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    ${ctaText} &rarr;
                  </a>
                </div>

                <!-- Items In Cart Section -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f2;padding-top:16px;">
                  <tr>
                    <td style="padding:12px 0 8px;">
                      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#71717a;">Items in Your Cart</p>
                    </td>
                  </tr>
                  ${itemsRows}
                </table>

                <!-- Subtotal Breakdown -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr>
                    <td style="padding:10px 0;font-size:14px;font-weight:600;color:#3f3f46;">Subtotal</td>
                    <td align="right" style="padding:10px 0;font-size:15px;font-weight:700;color:#111111;">${subtotal}</td>
                  </tr>
                </table>

                <!-- Secondary Link -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                  <tr>
                    <td align="center">
                      <a href="${restoreUrl}" target="_blank" rel="noopener noreferrer" style="font-size:13.5px;font-weight:600;color:#18181b;text-decoration:underline;">
                        Ready to proceed? Continue to checkout &rarr;
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Spacer -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <!-- Support & Help -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0 0 10px;font-size:12px;line-height:1.65;color:#71717a;">
                        Have questions about your order or device compatibility? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                      </p>
                      <p style="margin:0 0 10px;font-size:11.5px;color:#a1a1aa;">
                        <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#71717a;text-decoration:underline;">Unsubscribe from cart reminders</a>
                      </p>
                      <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, isLightMode: true };
}

function renderFallbackEmail(event: string, data: Record<string, any>): RenderedEmail {
  const subject = `Notice regarding your Exacoat account`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family:sans-serif;padding:32px;background:#f7f7f7;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:32px;border-radius:16px;">
    ${BRAND_LOGO_HTML}
    <h2 style="margin-top:20px;">Notification: ${escapeHtml(event)}</h2>
    <p>This is an automated notification from Exacoat.</p>
    <p style="margin-top:24px;font-size:11px;color:#a1a1aa;">&copy; Exacoat</p>
  </div>
</body>
</html>`;
  return { subject, html, isLightMode: true };
}

export interface TrustFeatureCard {
  title: string;
  desc: string;
  highlighted?: boolean;
}

export type BannerAspectRatio = '16:9' | '4:3' | '1:1' | '3:4' | 'auto';

export interface MarketingEmailOptions {
  theme?: 'dark' | 'light';
  subject: string;
  preheaderText?: string;
  showHeader?: boolean;
  showBadge?: boolean;
  logoPosition?: 'top' | 'bottom' | 'none';
  badgeText?: string;
  badgeVariant?: 'amber' | 'emerald' | 'blue' | 'purple' | 'zinc';
  headline: string;
  recipientGreeting?: string;
  bannerImageUrl?: string;
  bannerImageAlt?: string;
  bannerLinkUrl?: string;
  bannerAspectRatio?: BannerAspectRatio;
  subPillNotice?: string;
  bodyText: string;
  highlightTitle?: string;
  highlightText?: string;
  promoCode?: string;
  showTrustGrid?: boolean;
  trustCards?: TrustFeatureCard[];
  ctaText?: string;
  ctaUrl?: string;
  primaryCtaColor?: 'amber' | 'white' | 'emerald';
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  footerNote?: string;
  unsubscribeUrl?: string;
  viewInBrowserUrl?: string;
  recipientName?: string;
  contentAlign?: 'left' | 'center';
  showFooterLogo?: boolean;
  showSocialLinks?: boolean;
  instagramUrl?: string;
  xUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
}

/**
 * Replaces personalization tags like {name}, {name|fallback}, {{name|there}}, {first_name}, etc.
 */
export function replaceNamePlaceholders(text: string, name?: string | null): string {
  if (!text) return '';
  const trimmedName = (name || '').trim();
  return text.replace(/\{\{?\s*(?:name|first_name|creator_name|customer_name)(?:\|([^}]+))?\s*\}\}?/gi, (_match, fallback) => {
    if (trimmedName) {
      return trimmedName;
    }
    return fallback !== undefined ? fallback.trim() : 'there';
  });
}

const DEFAULT_TRUST_CARDS: TrustFeatureCard[] = [
  {
    title: 'Installation Warranty',
    desc: 'If installation fails within 2 days after receipt, we replace it with a new one.',
    highlighted: true,
  },
  {
    title: 'Scratch & Mold Resistant',
    desc: 'Shields surfaces from scratches and moisture buildup that degrade gadget finishes.',
    highlighted: false,
  },
  {
    title: 'Money Back Guarantee',
    desc: 'Not satisfied with your skin within 30 days? Enjoy a hassle-free refund.',
    highlighted: false,
  },
  {
    title: 'No Residue, Like New',
    desc: 'Engineered adhesive leaves zero residue, preserving your device in factory mint condition.',
    highlighted: false,
  },
  {
    title: 'Bubble Airways Tech',
    desc: 'Micro-channeled air release matrix guarantees a clean, 100% bubble-free fit.',
    highlighted: false,
  },
  {
    title: '3+ Years Durability',
    desc: 'Industrial-grade cast vinyl retains exact fit, tactile texture, and vibrant color.',
    highlighted: false,
  },
];

export function renderMarketingEmailHtml(options: MarketingEmailOptions): RenderedEmail {
  const isDark = (options.theme ?? 'dark') === 'dark';
  const showHeader = Boolean(options.showHeader);
  const showBadge = Boolean(options.showBadge);
  const logoPosition = options.logoPosition ?? 'top';
  const rawSubject = options.subject || 'Special Update from Exacoat';
  const resolvedSubject = replaceNamePlaceholders(rawSubject, options.recipientName);
  const subject = escapeHtml(resolvedSubject);

  const rawPreheader = options.preheaderText || 'Precision crafted device skins and exclusive announcements.';
  const resolvedPreheader = replaceNamePlaceholders(rawPreheader, options.recipientName);
  const preheader = escapeHtml(resolvedPreheader);

  const contentAlign = options.contentAlign || 'left';
  const showFooterLogo = options.showFooterLogo ?? false;
  const showSocialLinks = options.showSocialLinks ?? true;
  const instagramUrl = (options.instagramUrl || 'https://instagram.com/exacoat').trim();
  const xUrl = (options.xUrl || 'https://x.com/exacoat').trim();
  const youtubeUrl = (options.youtubeUrl || 'https://youtube.com/@exacoat').trim();
  const tiktokUrl = (options.tiktokUrl || 'https://tiktok.com/@exacoat').trim();

  const rawHeadline = options.headline || 'Exclusive Announcement';
  const resolvedHeadline = replaceNamePlaceholders(rawHeadline, options.recipientName);
  const headline = escapeHtml(resolvedHeadline);

  const rawGreeting = options.recipientGreeting || 'Hi {name|there},';
  const resolvedGreeting = replaceNamePlaceholders(rawGreeting, options.recipientName);
  const greeting = escapeHtml(resolvedGreeting);

  const badgeText = escapeHtml(options.badgeText || 'Announcement');
  const badgeVariant = options.badgeVariant || 'amber';

  // Badge Colors
  let badgeBg = isDark ? 'rgba(245,158,11,0.15)' : '#fff8eb';
  let badgeColor = isDark ? '#fbbf24' : '#d97706';
  let badgeBorder = isDark ? 'rgba(245,158,11,0.3)' : '#fef3c7';

  if (badgeVariant === 'emerald') {
    badgeBg = isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5';
    badgeColor = isDark ? '#34d399' : '#059669';
    badgeBorder = isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0';
  } else if (badgeVariant === 'blue') {
    badgeBg = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
    badgeColor = isDark ? '#60a5fa' : '#2563eb';
    badgeBorder = isDark ? 'rgba(59,130,246,0.3)' : '#bfdbfe';
  } else if (badgeVariant === 'purple') {
    badgeBg = isDark ? 'rgba(168,85,247,0.15)' : '#faf5ff';
    badgeColor = isDark ? '#c084fc' : '#7c3aed';
    badgeBorder = isDark ? 'rgba(168,85,247,0.3)' : '#e9d5ff';
  } else if (badgeVariant === 'zinc') {
    badgeBg = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f5';
    badgeColor = isDark ? '#e4e4e7' : '#3f3f46';
    badgeBorder = isDark ? 'rgba(255,255,255,0.15)' : '#e4e4e7';
  }

  // Theme palettes
  const bgOuter = isDark ? '#050507' : '#f7f7f7';
  const bgCard = isDark ? '#0e0e11' : '#ffffff';
  const cardBorder = isDark ? '#1f1f24' : '#e5e5e5';
  const textHeading = isDark ? '#ffffff' : '#111111';
  const textBody = isDark ? '#a1a1aa' : '#3f3f46';
  const textGreeting = isDark ? '#e4e4e7' : '#18181b';
  const headerDivider = isDark ? '#1a1a1f' : '#f0f0f0';

  // Body text paragraphs
  const rawBody = replaceNamePlaceholders(options.bodyText || '', options.recipientName);
  const paragraphs = rawBody
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const bodyHtml = paragraphs.map(p => {
    const formatted = escapeHtml(p).replace(/\n/g, '<br />');
    return `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.75;color:${textBody};text-align:${contentAlign};">${formatted}</p>`;
  }).join('');

  // Banner image section
  let bannerHtml = '';
  if (options.bannerImageUrl) {
    const imgUrl = escapeHtml(options.bannerImageUrl);
    const altText = escapeHtml(options.bannerImageAlt || headline);
    const imgBorder = isDark ? '1px solid #27272a' : '1px solid #e5e5e5';
    const ratio = options.bannerAspectRatio || '16:9';

    let ratioStyle = 'aspect-ratio:16/9;';
    if (ratio === '4:3') {
      ratioStyle = 'aspect-ratio:4/3;';
    } else if (ratio === '1:1') {
      ratioStyle = 'aspect-ratio:1/1;';
    } else if (ratio === '3:4') {
      ratioStyle = 'aspect-ratio:3/4;max-height:560px;';
    } else if (ratio === 'auto') {
      ratioStyle = '';
    }

    const imgTag = `<img src="${imgUrl}" alt="${altText}" width="520" style="width:100%;max-width:520px;${ratioStyle}height:auto;border-radius:20px;border:${imgBorder};display:block;margin:0 auto 20px;object-fit:cover;box-shadow:0 8px 30px rgba(0,0,0,0.35);" />`;
    if (options.bannerLinkUrl) {
      const linkUrl = escapeHtml(options.bannerLinkUrl);
      bannerHtml = `<div style="margin-bottom:20px;text-align:center;"><a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">${imgTag}</a></div>`;
    } else {
      bannerHtml = `<div style="margin-bottom:20px;text-align:center;">${imgTag}</div>`;
    }
  }

  // Sub-pill Capsule Notice (Left-aligned or Centered, Borderless, Subtle)
  let subPillHtml = '';
  if (options.subPillNotice) {
    const pillBg = isDark ? 'rgba(255,255,255,0.06)' : '#f1f1f4';
    const pillColor = isDark ? '#a1a1aa' : '#71717a';
    subPillHtml = `
      <div style="margin:0 0 16px;text-align:${contentAlign};">
        <span style="display:inline-block;padding:4px 12px;background:${pillBg};border-radius:9999px;font-size:9.5px;font-weight:500;color:${pillColor};letter-spacing:1.2px;text-transform:uppercase;line-height:13px;vertical-align:middle;">
          ${escapeHtml(options.subPillNotice)}
        </span>
      </div>`;
  }

  // Highlight / Promo coupon box
  let highlightHtml = '';
  if (options.promoCode || options.highlightTitle || options.highlightText) {
    const hTitle = escapeHtml(options.highlightTitle || (options.promoCode ? 'Exclusive Perk' : 'Special Highlight'));
    const hText = options.highlightText ? `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${textBody};">${escapeHtml(options.highlightText)}</p>` : '';
    const boxBg = isDark ? '#141419' : '#fafafa';
    const boxBorder = isDark ? '1.5px dashed #f59e0b' : '1.5px dashed #111111';
    const codeBg = isDark ? '#1f1f24' : '#ffffff';
    const codeColor = isDark ? '#fbbf24' : '#111111';
    const codeBorder = isDark ? '1px solid rgba(245,158,11,0.4)' : '1px solid #e4e4e7';

    const codeHtml = options.promoCode ? `
      <div style="margin-top:12px;">
        <span style="display:inline-block;padding:8px 20px;background:${codeBg};border:${codeBorder};color:${codeColor};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:16px;font-weight:800;letter-spacing:1.5px;border-radius:999px;">
          ${escapeHtml(options.promoCode)}
        </span>
      </div>` : '';

    highlightHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${boxBg};border:${boxBorder};border-radius:20px;border-collapse:separate;overflow:hidden;margin:24px 0 28px;">
        <tr>
          <td style="padding:22px 24px;text-align:center;">
            <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:${textHeading};">${hTitle}</p>
            ${hText}
            ${codeHtml}
          </td>
        </tr>
      </table>`;
  }

  // Trust / Feature Cards Grid (2-column layout, deep dark rounded cards)
  let trustGridHtml = '';
  const showGrid = options.showTrustGrid ?? isDark;
  if (showGrid) {
    const cards = options.trustCards && options.trustCards.length > 0 ? options.trustCards : DEFAULT_TRUST_CARDS;
    let cardRowsHtml = '';

    for (let i = 0; i < cards.length; i += 2) {
      const left = cards[i];
      const right = cards[i + 1];

      const renderCardCell = (c?: TrustFeatureCard) => {
        if (!c) return '<td width="48%"></td>';
        const isHighlight = Boolean(c.highlighted);
        const cardBg = isDark ? '#121215' : '#fafafa';
        const cardBorderColor = isHighlight 
          ? (isDark ? 'rgba(245,158,11,0.55)' : '#d97706') 
          : (isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5');
        const cardTitleColor = isHighlight && isDark ? '#fbbf24' : textHeading;

        return `
          <td width="48%" valign="top" style="padding-bottom:14px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${cardBg};border:1px solid ${cardBorderColor};border-radius:20px;border-collapse:separate;overflow:hidden;box-shadow:${isHighlight ? '0 0 20px rgba(245,158,11,0.08)' : 'none'};">
              <tr>
                <td style="padding:18px 16px;text-align:center;">
                  <div style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:999px;background:${isHighlight ? 'rgba(245,158,11,0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5')};color:${isHighlight ? '#f59e0b' : (isDark ? '#e4e4e7' : '#52525b')};font-size:12px;font-weight:bold;margin-bottom:10px;">
                    ${isHighlight ? '&#9733;' : '&#10003;'}
                  </div>
                  <p style="margin:0 0 5px;font-size:13px;font-weight:700;color:${cardTitleColor};letter-spacing:-0.2px;">
                    ${escapeHtml(c.title)}
                  </p>
                  <p style="margin:0;font-size:11.5px;line-height:1.55;color:${textBody};">
                    ${escapeHtml(c.desc)}
                  </p>
                </td>
              </tr>
            </table>
          </td>`;
      };

      cardRowsHtml += `
        <tr>
          ${renderCardCell(left)}
          <td width="4%"></td>
          ${renderCardCell(right)}
        </tr>`;
    }

    trustGridHtml = `
      <div style="margin:28px 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${cardRowsHtml}
        </table>
      </div>`;
  }

  // Action CTA buttons
  let ctaButtonsHtml = '';
  if (options.ctaText && options.ctaUrl) {
    const ctaText = escapeHtml(options.ctaText);
    const ctaUrl = escapeHtml(options.ctaUrl);

    let btnBg = '#f59e0b';
    let btnColor = '#000000';
    if (options.primaryCtaColor === 'white') {
      btnBg = '#ffffff';
      btnColor = '#000000';
    } else if (options.primaryCtaColor === 'emerald') {
      btnBg = '#10b981';
      btnColor = '#ffffff';
    } else if (!isDark) {
      btnBg = '#111111';
      btnColor = '#ffffff';
    }

    let secondaryHtml = '';
    if (options.secondaryCtaText && options.secondaryCtaUrl) {
      const secText = escapeHtml(options.secondaryCtaText);
      const secUrl = escapeHtml(options.secondaryCtaUrl);
      const secBg = isDark ? '#1a1a20' : '#f4f4f5';
      const secColor = isDark ? '#e4e4e7' : '#18181b';
      const secBorder = isDark ? '#27272a' : '#e4e4e7';

      secondaryHtml = `
        <a href="${secUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 26px;background:${secBg};color:${secColor};font-size:13.5px;font-weight:700;border-radius:999px;text-decoration:none;letter-spacing:0.3px;border:1px solid ${secBorder};margin-left:10px;margin-top:6px;">
          ${secText}
        </a>`;
    }

    ctaButtonsHtml = `
      <div style="margin:30px 0 24px;text-align:center;">
        <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 38px;background:${btnBg};color:${btnColor};font-size:14.5px;font-weight:900;border-radius:999px;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase;box-shadow:0 4px 18px rgba(0,0,0,0.25);margin-top:6px;">
          ${ctaText}
        </a>
        ${secondaryHtml}
      </div>`;
  }

  const unsubscribeUrl = escapeHtml(options.unsubscribeUrl || '{{unsubscribe_url}}');
  const footerNote = options.footerNote ? `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${textBody};text-align:center;">${escapeHtml(options.footerNote)}</p>` : '';
  const brandLogo = isDark ? BRAND_LOGO_WHITE_HTML : BRAND_LOGO_HTML;

  // Header and Logo positioning logic
  let topHeaderHtml = '';
  if (showHeader) {
    const badgeHtml = showBadge ? `
      <td align="right" valign="middle">
        <span style="display:inline-block;padding:3px 10px;background:${badgeBg};color:${badgeColor};font-size:9.5px;font-weight:700;border-radius:9999px;border:1px solid ${badgeBorder};letter-spacing:1.5px;text-transform:uppercase;">${badgeText}</span>
      </td>` : '';

    topHeaderHtml = `
      <!-- Top Header (Logo + Badge) -->
      <tr>
        <td style="padding:28px 36px 20px;border-bottom:1px solid ${headerDivider};" class="mobile-padding">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle">
                <a href="https://exacoat.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
                  ${brandLogo}
                </a>
              </td>
              ${badgeHtml}
            </tr>
          </table>
        </td>
      </tr>`;
  }

  // In-body logo when header is not shown
  let topLogoHtml = '';
  if (!showHeader && logoPosition === 'top') {
    topLogoHtml = `
      <div style="margin:0 0 24px;text-align:${contentAlign};">
        <a href="https://exacoat.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
          ${brandLogo}
        </a>
      </div>`;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: ${bgOuter};
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 20px !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body bgcolor="${bgOuter}" style="margin:0;padding:24px 0 60px;background-color:${bgOuter};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preview Preheader (Hidden snippet) -->
  <div style="display:none;font-size:1px;color:${bgOuter};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bgOuter}" style="background-color:${bgOuter};width:100%;margin:0;padding:0;">
    <!-- Top breathing room spacer before webview link -->
    <tr>
      <td height="36" style="height:36px;line-height:36px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
    </tr>

    <tr>
      <td align="center" style="padding:0 20px;">
        <!-- Top Webview Link with generous breathing space -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:550px;margin:0 auto 20px;">
          <tr>
            <td align="center" style="font-size:11px;color:#71717a;line-height:1.5;padding:0 0 6px;">
              If you cannot see this email properly, please <a href="{{webview_url}}" target="_blank" rel="noopener noreferrer" style="color:#a1a1aa;text-decoration:underline;">click here</a>.
            </td>
          </tr>
        </table>

        <!-- Main Card Container (Rounded 28px with left/right breathing margin) -->
        <table class="container-table" width="550" cellpadding="0" cellspacing="0" border="0" style="max-width:550px;width:100%;margin:0 auto;background:${bgCard};border:1px solid ${cardBorder};border-radius:28px;border-collapse:separate;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.5);">
          <tbody>
            ${topHeaderHtml}

            <!-- Message Headline & Body -->
            <tr>
              <td style="padding:36px 36px 32px;" class="mobile-padding">
                ${topLogoHtml}
                ${bannerHtml}
                ${subPillHtml}
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${textHeading};letter-spacing:-0.5px;line-height:1.3;text-align:${contentAlign};">${headline}</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:${textGreeting};text-align:${contentAlign};">${greeting}</p>
                ${bodyHtml}
                ${highlightHtml}
                ${trustGridHtml}
                ${ctaButtonsHtml}
                ${footerNote}

                <!-- Dedicated Spacer above Footer -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="36" style="height:36px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>

                <!-- Footer with Logo and Social Links -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${headerDivider};text-align:center;">
                  <tr>
                    <td align="center" style="padding-top:32px;padding-bottom:24px;">
                      ${showFooterLogo ? `
                      <div style="margin:0 0 18px;text-align:center;">
                        <a href="https://exacoat.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
                          ${brandLogo}
                        </a>
                      </div>` : ''}
                      ${showSocialLinks ? `
                      <!-- Social Links (Compact, small icons) -->
                      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                        <tr>
                          ${instagramUrl ? `
                          <td style="padding:0 5px;">
                            <a href="${escapeHtml(instagramUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:7px;border-radius:50%;background:${isDark ? '#141418' : '#f4f4f5'};border:1px solid ${cardBorder};text-decoration:none;" title="Instagram">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#e4e4e7' : '#27272a'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                            </a>
                          </td>` : ''}
                          ${xUrl ? `
                          <td style="padding:0 5px;">
                            <a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:7px;border-radius:50%;background:${isDark ? '#141418' : '#f4f4f5'};border:1px solid ${cardBorder};text-decoration:none;" title="X">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="${isDark ? '#e4e4e7' : '#27272a'}" style="display:block;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                            </a>
                          </td>` : ''}
                          ${youtubeUrl ? `
                          <td style="padding:0 5px;">
                            <a href="${escapeHtml(youtubeUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:7px;border-radius:50%;background:${isDark ? '#141418' : '#f4f4f5'};border:1px solid ${cardBorder};text-decoration:none;" title="YouTube">
                              <svg width="15" height="12" viewBox="0 0 24 24" fill="${isDark ? '#e4e4e7' : '#27272a'}" style="display:block;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </a>
                          </td>` : ''}
                        </tr>
                      </table>` : ''}

                      <p style="margin:0 0 8px;font-size:11.5px;color:#71717a;">
                        &copy; 2016-2026 Exacoat
                      </p>
                      <p style="margin:0;font-size:11px;color:#71717a;line-height:1.5;">
                        <a href="{{webview_url}}" target="_blank" rel="noopener noreferrer" style="color:#a1a1aa;text-decoration:underline;">View in browser</a>
                        &nbsp;&bull;&nbsp;
                        <a href="${unsubscribeUrl}" target="_blank" rel="noopener noreferrer" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Bottom breathing room spacer below card so it never touches bottom -->
    <tr>
      <td height="60" style="height:60px;line-height:60px;font-size:0;mso-line-height-rule:exactly;">&nbsp;</td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: options.subject, html, isLightMode: !isDark };
}

/**
 * Compiles marketing email options into clean, valid, responsive MJML markup.
 * This acts as the single source of truth for the Visual Marketing Studio.
 */
export function renderMarketingEmailMjml(options: MarketingEmailOptions): string {
  const isDark = (options.theme ?? 'dark') === 'dark';
  const showHeader = Boolean(options.showHeader);
  const showBadge = Boolean(options.showBadge);
  const logoPosition = options.logoPosition ?? 'top';
  const contentAlign = options.contentAlign || 'left';
  const showFooterLogo = options.showFooterLogo ?? false;
  const showSocialLinks = options.showSocialLinks ?? true;
  const instagramUrl = options.instagramUrl ?? 'https://instagram.com/exacoat';
  const xUrl = options.xUrl ?? 'https://x.com/exacoat';
  const youtubeUrl = options.youtubeUrl ?? 'https://youtube.com/@exacoat';
  const tiktokUrl = options.tiktokUrl ?? '';

  const headline = options.headline || 'Engineered Precision. Pure Tactile Feel.';
  const greeting = options.recipientGreeting || 'Hi {name|there},';
  const bodyText = options.bodyText || '';
  const subPillNotice = options.subPillNotice || '';
  const badgeText = options.badgeText || 'ANNOUNCEMENT';
  const badgeVariant = options.badgeVariant || 'amber';

  // Colors based on theme
  const outerBg = isDark ? '#050507' : '#f5f5f7';
  const cardBg = isDark ? '#0e0e11' : '#ffffff';
  const cardBorder = isDark ? '#1f1f24' : '#e4e4e7';
  const textHeading = isDark ? '#ffffff' : '#111111';
  const textGreeting = isDark ? '#e4e4e7' : '#18181b';
  const textBody = isDark ? '#a1a1aa' : '#52525b';
  const textMuted = isDark ? '#71717a' : '#a1a1aa';
  const dividerColor = isDark ? '#1a1a1f' : '#e5e7eb';
  const brandLogo = isDark ? BRAND_LOGO_WHITE_HTML : BRAND_LOGO_HTML;

  // Badge Colors
  let badgeBg = isDark ? 'rgba(245,158,11,0.15)' : '#fff8eb';
  let badgeColor = isDark ? '#fbbf24' : '#d97706';
  let badgeBorder = isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fef3c7';

  if (badgeVariant === 'emerald') {
    badgeBg = isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5';
    badgeColor = isDark ? '#34d399' : '#059669';
    badgeBorder = isDark ? '1px solid rgba(16,185,129,0.3)' : '1px solid #a7f3d0';
  } else if (badgeVariant === 'blue') {
    badgeBg = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff';
    badgeColor = isDark ? '#60a5fa' : '#2563eb';
    badgeBorder = isDark ? '1px solid rgba(59,130,246,0.3)' : '1px solid #bfdbfe';
  } else if (badgeVariant === 'purple') {
    badgeBg = isDark ? 'rgba(168,85,247,0.15)' : '#faf5ff';
    badgeColor = isDark ? '#c084fc' : '#7c3aed';
    badgeBorder = isDark ? '1px solid rgba(168,85,247,0.3)' : '1px solid #e9d5ff';
  } else if (badgeVariant === 'zinc') {
    badgeBg = isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5';
    badgeColor = isDark ? '#d4d4d8' : '#52525b';
    badgeBorder = isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e4e4e7';
  }

  // CTA Colors
  let btnBg = '#f59e0b';
  let btnColor = '#000000';
  if (options.primaryCtaColor === 'white') {
    btnBg = '#ffffff';
    btnColor = '#000000';
  } else if (options.primaryCtaColor === 'emerald') {
    btnBg = '#10b981';
    btnColor = '#ffffff';
  } else if (!isDark) {
    btnBg = '#111111';
    btnColor = '#ffffff';
  }

  // Sub-pill capsule
  let subPillMjml = '';
  if (subPillNotice) {
    const pillBg = isDark ? 'rgba(255,255,255,0.06)' : '#f1f1f4';
    const pillColor = isDark ? '#a1a1aa' : '#71717a';
    subPillMjml = `
      <!-- Sub-Pill Notice Capsule -->
      <mj-section padding="0 0 16px">
        <mj-column>
          <mj-button background-color="${pillBg}" color="${pillColor}" border-radius="9999px" font-size="9.5px" font-weight="600" letter-spacing="1.2px" text-transform="uppercase" align="${contentAlign === 'center' ? 'center' : 'left'}" inner-padding="5px 14px" padding="0">
            ${escapeHtml(subPillNotice)}
          </mj-button>
        </mj-column>
      </mj-section>`;
  }

  // Header / Logo
  let headerMjml = '';
  if (showHeader) {
    const badgeCol = showBadge ? `
        <mj-column width="40%" vertical-align="middle">
          <mj-button background-color="${badgeBg}" color="${badgeColor}" border="${badgeBorder}" border-radius="9999px" font-size="9.5px" font-weight="700" letter-spacing="1.5px" align="right" inner-padding="4px 10px" padding="0">
            ${escapeHtml(badgeText)}
          </mj-button>
        </mj-column>` : '';

    headerMjml = `
      <!-- Top Header -->
      <mj-section padding="0 0 20px" border-bottom="1px solid ${dividerColor}">
        <mj-column width="${showBadge ? '60%' : '100%'}" vertical-align="middle">
          <mj-text align="${contentAlign === 'center' ? 'center' : 'left'}" padding="0">
            <a href="https://exacoat.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
              ${brandLogo}
            </a>
          </mj-text>
        </mj-column>
        ${badgeCol}
      </mj-section>
      <mj-section padding="12px 0 0"><mj-column></mj-column></mj-section>`;
  } else if (logoPosition === 'top') {
    headerMjml = `
      <!-- Top Brand Logo -->
      <mj-section padding="0 0 24px">
        <mj-column>
          <mj-text align="${contentAlign === 'center' ? 'center' : 'left'}" padding="0">
            <a href="https://exacoat.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
              ${brandLogo}
            </a>
          </mj-text>
        </mj-column>
      </mj-section>`;
  }

  // Banner image
  let bannerMjml = '';
  if (options.bannerImageUrl) {
    bannerMjml = `
      <!-- Hero Banner Image -->
      <mj-section padding="0 0 24px">
        <mj-column>
          <mj-image src="${escapeHtml(options.bannerImageUrl)}" alt="${escapeHtml(options.bannerImageAlt || 'Exacoat')}" href="${options.bannerLinkUrl ? escapeHtml(options.bannerLinkUrl) : 'https://exacoat.com'}" border-radius="20px" padding="0" width="560px" />
        </mj-column>
      </mj-section>`;
  }

  // Body paragraphs
  const paragraphs = bodyText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const bodyParagraphsMjml = paragraphs.map(p => {
    return `<mj-text align="${contentAlign === 'center' ? 'center' : 'left'}" font-size="14px" line-height="1.7" color="${textBody}" padding="0 0 12px">
            ${escapeHtml(p).replace(/\n/g, '<br />')}
          </mj-text>`;
  }).join('\n          ');

  // Promo Box
  let promoMjml = '';
  if (options.promoCode || options.highlightTitle || options.highlightText) {
    const pTitle = escapeHtml(options.highlightTitle || (options.promoCode ? 'Exclusive Perk' : 'Special Highlight'));
    const pText = options.highlightText ? `
          <mj-text align="center" font-size="13px" line-height="1.6" color="${textBody}" padding="0 0 10px">
            ${escapeHtml(options.highlightText)}
          </mj-text>` : '';
    const pCode = options.promoCode ? `
          <mj-button background-color="${isDark ? '#1f1f24' : '#ffffff'}" color="${isDark ? '#fbbf24' : '#111111'}" border="${isDark ? '1px solid rgba(245,158,11,0.4)' : '1px solid #e4e4e7'}" font-size="16px" font-weight="800" letter-spacing="2px" border-radius="999px" inner-padding="8px 22px" padding="10px 0 0">
            ${escapeHtml(options.promoCode)}
          </mj-button>` : '';

    promoMjml = `
      <!-- Promo Box -->
      <mj-section padding="12px 0 24px">
        <mj-column background-color="${isDark ? '#141419' : '#f9fafb'}" border="${isDark ? '1.5px dashed #f59e0b' : '1.5px dashed #111111'}" border-radius="20px" padding="22px 24px">
          <mj-text align="center" font-size="15px" font-weight="700" color="${textHeading}" padding="0 0 6px">
            ${pTitle}
          </mj-text>
          ${pText}
          ${pCode}
        </mj-column>
      </mj-section>`;
  }

  // Feature / Trust Cards Grid
  let cardsMjml = '';
  const showGrid = options.showTrustGrid ?? isDark;
  if (showGrid) {
    const cards = options.trustCards && options.trustCards.length > 0 ? options.trustCards : DEFAULT_TRUST_CARDS;
    let cardSections = '';

    for (let i = 0; i < cards.length; i += 2) {
      const left = cards[i];
      const right = cards[i + 1];

      const renderCardCol = (c?: TrustFeatureCard) => {
        if (!c) return '<mj-column width="48%"></mj-column>';
        const isHighlight = Boolean(c.highlighted);
        const cardColBg = isDark ? '#121215' : '#fafafa';
        const cardColBorder = isHighlight
          ? (isDark ? 'rgba(245,158,11,0.55)' : '#d97706')
          : (isDark ? 'rgba(255,255,255,0.08)' : '#e5e5e5');
        const cardTitleColor = isHighlight && isDark ? '#fbbf24' : textHeading;

        return `
        <mj-column width="48%" background-color="${cardColBg}" border="1px solid ${cardColBorder}" border-radius="20px" padding="18px 16px">
          <mj-text align="center" font-size="13px" font-weight="bold" color="${cardTitleColor}" padding="0 0 4px">
            ${escapeHtml(c.title)}
          </mj-text>
          <mj-text align="center" font-size="11.5px" line-height="1.6" color="${textBody}" padding="0">
            ${escapeHtml(c.desc)}
          </mj-text>
        </mj-column>`;
      };

      cardSections += `
      <mj-section padding="0 0 14px">
        ${renderCardCol(left)}
        <mj-column width="4%"></mj-column>
        ${renderCardCol(right)}
      </mj-section>`;
    }

    cardsMjml = `
      <!-- Trust Feature Grid -->
      ${cardSections}`;
  }

  // CTA Buttons
  let ctaMjml = '';
  if (options.ctaText && options.ctaUrl) {
    let secondaryBtn = '';
    if (options.secondaryCtaText && options.secondaryCtaUrl) {
      const secBg = isDark ? '#1a1a20' : '#f4f4f5';
      const secColor = isDark ? '#e4e4e7' : '#18181b';
      const secBorder = isDark ? '1px solid #27272a' : '1px solid #e4e4e7';
      secondaryBtn = `
          <mj-button href="${escapeHtml(options.secondaryCtaUrl)}" background-color="${secBg}" color="${secColor}" border="${secBorder}" font-weight="700" font-size="13.5px" border-radius="999px" inner-padding="12px 26px" padding="12px 0 0">
            ${escapeHtml(options.secondaryCtaText)}
          </mj-button>`;
    }

    ctaMjml = `
      <!-- Action CTA -->
      <mj-section padding="16px 0 28px">
        <mj-column>
          <mj-button href="${escapeHtml(options.ctaUrl)}" background-color="${btnBg}" color="${btnColor}" font-weight="900" font-size="14.5px" border-radius="999px" inner-padding="15px 38px" text-transform="uppercase" letter-spacing="0.5px">
            ${escapeHtml(options.ctaText)}
          </mj-button>
          ${secondaryBtn}
        </mj-column>
      </mj-section>`;
  }

  const unsubscribeUrl = escapeHtml(options.unsubscribeUrl || '{{unsubscribe_url}}');
  const footerNoteMjml = options.footerNote ? `
          <mj-text align="center" font-size="12.5px" line-height="1.6" color="${textBody}" padding="0 0 12px">
            ${escapeHtml(options.footerNote)}
          </mj-text>` : '';

  return `<mjml>
  <mj-head>
    <mj-font name="Plus Jakarta Sans" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" />
    <mj-attributes>
      <mj-all font-family="Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" />
      <mj-text font-size="14.5px" color="${textBody}" line-height="1.7" />
    </mj-attributes>
    <mj-style>
      .outer-card-wrapper {
        width: calc(100% - 32px) !important;
        max-width: 550px !important;
        margin: 0 auto !important;
      }
      .outer-card-wrapper > table {
        width: 100% !important;
        margin: 0 auto !important;
      }
      @media only screen and (max-width: 600px) {
        .outer-card-wrapper {
          width: calc(100% - 24px) !important;
          margin: 0 auto !important;
        }
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="${outerBg}" width="560px">
    <!-- Top Webview Link -->
    <mj-section padding="36px 0 16px">
      <mj-column>
        <mj-text align="center" font-size="11px" color="${textMuted}" line-height="1.5">
          If you cannot see this email properly, please <a href="{{webview_url}}" style="color:${isDark ? '#d4d4d8' : '#71717a'};text-decoration:underline;">click here</a>.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Main Container Card (Rounded 28px with left/right breathing margin) -->
    <mj-wrapper css-class="outer-card-wrapper" background-color="${cardBg}" border-radius="28px" border="1px solid ${cardBorder}" padding="36px 24px 32px">
      ${headerMjml}
      ${subPillMjml}
      ${bannerMjml}

      <!-- Message Content -->
      <mj-section padding="0 0 8px">
        <mj-column>
          <mj-text align="${contentAlign === 'center' ? 'center' : 'left'}" font-size="26px" font-weight="900" color="${textHeading}" line-height="1.25" letter-spacing="-0.5px" padding="0 0 16px">
            ${escapeHtml(headline)}
          </mj-text>
          <mj-text align="${contentAlign === 'center' ? 'center' : 'left'}" font-size="15px" font-weight="600" color="${textGreeting}" padding="0 0 12px">
            ${escapeHtml(greeting)}
          </mj-text>
          ${bodyParagraphsMjml}
        </mj-column>
      </mj-section>

      ${promoMjml}
      ${cardsMjml}
      ${ctaMjml}

      <!-- Footer with Logo and Social Links -->
      <mj-section border-top="1px solid ${dividerColor}" padding="32px 0 16px">
        <mj-column>
          ${showFooterLogo ? `
          <mj-text align="center" padding="0 0 18px">
            <a href="https://exacoat.com" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
              ${brandLogo}
            </a>
          </mj-text>` : ''}
          ${showSocialLinks ? `
          <mj-text align="center" padding="0 0 16px">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                ${instagramUrl ? `
                <td style="padding:0 5px;">
                  <a href="${escapeHtml(instagramUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:7px;border-radius:50%;background:${isDark ? '#141418' : '#f4f4f5'};border:1px solid ${cardBorder};text-decoration:none;" title="Instagram">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${isDark ? '#e4e4e7' : '#27272a'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  </a>
                </td>` : ''}
                ${xUrl ? `
                <td style="padding:0 5px;">
                  <a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:7px;border-radius:50%;background:${isDark ? '#141418' : '#f4f4f5'};border:1px solid ${cardBorder};text-decoration:none;" title="X">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="${isDark ? '#e4e4e7' : '#27272a'}" style="display:block;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                </td>` : ''}
                ${youtubeUrl ? `
                <td style="padding:0 5px;">
                  <a href="${escapeHtml(youtubeUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:7px;border-radius:50%;background:${isDark ? '#141418' : '#f4f4f5'};border:1px solid ${cardBorder};text-decoration:none;" title="YouTube">
                    <svg width="15" height="12" viewBox="0 0 24 24" fill="${isDark ? '#e4e4e7' : '#27272a'}" style="display:block;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                </td>` : ''}
              </tr>
            </table>
          </mj-text>` : ''}
          ${footerNoteMjml}
          <mj-text align="center" font-size="11.5px" color="${textMuted}" padding="8px 0 0">
            &copy; 2016-2026 Exacoat
          </mj-text>
          <mj-text align="center" font-size="11px" color="${textMuted}" padding="6px 0 0">
            <a href="{{webview_url}}" style="color:${isDark ? '#d4d4d8' : '#71717a'};text-decoration:underline;">View in browser</a> &bull;
            <a href="${unsubscribeUrl}" style="color:${isDark ? '#d4d4d8' : '#71717a'};text-decoration:underline;">Unsubscribe</a>
          </mj-text>
        </mj-column>
      </mj-section>
    </mj-wrapper>
  </mj-body>
</mjml>`;
}


