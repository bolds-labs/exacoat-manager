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
  } else if (event === 'customer_cashback_earned' || event === 'customer_store_credit_reminder') {
    return renderStoreCreditEmail(event, customData);
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

export const BRAND_LOGO_HTML = `
  <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="136" height="24" viewBox="0 0 1368000 241000" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" style="display:block;border:0;outline:none;width:136px;height:24px;">
    <path fill="#000000" fill-rule="nonzero" d="M1281000 218000l0 -40000 22000 -23000 43000 0 22000 23000 0 40000 -22000 23000 -43000 0 -22000 -23000zm59000 10000l14000 -14000 0 -32000 -14000 -14000 -31000 0 -14000 14000 0 32000 14000 14000 31000 0zm-33000 -52000l28000 0 8000 8000 0 13000 -5000 5000 6000 6000 0 10000 -12000 0 0 -7000 -4000 -5000 -9000 0 0 12000 -12000 0 0 -42000zm22000 20000l3000 -2000 0 -5000 -3000 -3000 -10000 0 0 10000 10000 0z"/>
    <path fill="#000000" fill-rule="nonzero" d="M0 202000l0 -108000 36000 -36000 97000 0 37000 36000 0 67000 -129000 0 0 29000 13000 14000 62000 0 13000 -13000 0 -11000 40000 0 0 23000 -35000 35000 -99000 0 -35000 -36000zm129000 -70000l0 -25000 -14000 -15000 -60000 0 -14000 15000 0 25000 88000 0zm180000 106000l-43000 -60000 -44000 60000 -45000 0 66000 -91000 -65000 -89000 46000 0 42000 58000 41000 -58000 46000 0 -64000 89000 66000 91000 -46000 0zm51000 -32000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -74000 0 -11000 11000 0 22000 11000 11000 44000 0zm102000 -4000l0 -108000 35000 -36000 95000 0 35000 36000 0 30000 -40000 0 0 -17000 -15000 -14000 -55000 0 -15000 14000 0 82000 15000 14000 55000 0 15000 -14000 0 -17000 40000 0 0 30000 -35000 36000 -95000 0 -35000 -36000zm188000 0l0 -108000 36000 -36000 100000 0 36000 36000 0 108000 -36000 36000 -100000 0 -36000 -36000zm116000 2000l15000 -15000 0 -82000 -15000 -14000 -60000 0 -15000 14000 0 82000 15000 15000 60000 0zm84000 2000l0 -43000 32000 -31000 93000 0 0 -27000 -14000 -13000 -56000 0 -14000 13000 0 11000 -40000 0 0 -20000 37000 -38000 90000 0 37000 38000 0 142000 -37000 0 0 -28000 -29000 28000 -67000 0 -32000 -32000zm95000 0l30000 -29000 0 -15000 -73000 0 -12000 11000 0 22000 11000 11000 44000 0zm118000 -4000l0 -109000 -33000 0 0 -35000 34000 0 0 -58000 40000 0 0 58000 55000 0 0 35000 -55000 0 0 96000 14000 14000 41000 0 0 35000 -60000 0 -36000 -36000z"/>
  </svg>
`;

export const BRAND_WORDMARK_HTML = BRAND_LOGO_HTML;

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
    const refundAmt = escapeHtml(merged.refund_amount || 'Rp 149.000');
    subject = `Refund confirmation for order #${orderNum}`;
    badgeText = 'Refund processed';
    title = 'Refund processed';
    bodyPrimary = `We have processed a refund of ${refundAmt} for order #${orderNum}.`;
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
    const iTot = escapeHtml(item.total || item.price || item.subtotal || 'Rp 149.000');

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

  const subtotal = escapeHtml(merged.subtotal || 'Rp 149.000');
  const discountTotal = escapeHtml(merged.discount_total || '');
  const shippingTotal = escapeHtml(isStorePickup ? (merged.shipping_total || 'Rp 0') : (merged.shipping_total || 'Rp 15.000'));
  const shippingName = escapeHtml(isStorePickup ? (merged.shipping_method_name || 'Store Pickup (Summarecon Bekasi)') : (merged.shipping_method_name || 'Standard'));
  const totalTax = escapeHtml(merged.total_tax || '');
  const total = escapeHtml(isStorePickup && !data.total ? (merged.subtotal || 'Rp 149.000') : (merged.total || (isStorePickup ? 'Rp 149.000' : 'Rp 164.000')));
  const totalRefunded = escapeHtml(merged.total_refunded || '');
  const paymentMeth = escapeHtml(merged.payment_method_title || 'Midtrans / QRIS');
  const shippingAddr = escapeHtml(merged.shipping_address || 'William Vance\nJl. Sudirman No. 42\nJakarta Selatan 12190\nIndonesia').replace(/\n/g, '<br>');

  let couponsRow = '';
  if (discountTotal && discountTotal !== 'Rp 0' && discountTotal !== '$0.00' && discountTotal !== '0') {
    couponsRow = `
    <tr>
      <td style="padding:8px 0;font-size:13.5px;color:#52525b;">Discount</td>
      <td align="right" style="padding:8px 0;font-size:13.5px;color:#059669;font-weight:600;">-${discountTotal}</td>
    </tr>`;
  }

  let taxRow = '';
  if (totalTax && totalTax !== 'Rp 0' && totalTax !== '$0.00' && totalTax !== '0') {
    taxRow = `
    <tr>
      <td style="padding:8px 0;font-size:13.5px;color:#52525b;">Tax</td>
      <td align="right" style="padding:8px 0;font-size:13.5px;color:#111111;font-weight:500;">${totalTax}</td>
    </tr>`;
  }

  let refundRow = '';
  if (totalRefunded && totalRefunded !== 'Rp 0' && totalRefunded !== '$0.00' && totalRefunded !== '0') {
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
  const balance = escapeHtml(data.store_credit_balance || 'Rp 50.000');
  const cashbackAmount = escapeHtml(data.cashback_amount || 'Rp 25.000');
  const expiryDate = escapeHtml(data.expiry_date || '');
  const orderNum = escapeHtml(data.order_number || '14589');
  const shopUrl = escapeHtml(data.shop_url || 'https://exacoat.com/shop/');

  const isCashback = event === 'customer_cashback_earned';
  const badgeText = isCashback ? 'Store Credit' : 'Store Credit';
  const title = isCashback ? 'Your cashback is ready to use' : 'Your store credit is waiting';
  const subject = isCashback
    ? `You received ${cashbackAmount} cashback on order #${orderNum}`
    : `You have ${balance} store credit waiting in your Exacoat account`;

  const bodyPrimary = isCashback
    ? `Your cashback of ${cashbackAmount} from order #${orderNum} has been credited to your Exacoat store credit balance.`
    : `You still have ${balance} in store credit available in your Exacoat account.`;

  const bodySecondary = isCashback
    ? `Your available store credit balance is now ${balance}. You can apply it directly during checkout on your next order.`
    : 'Use it on your next precision skin, camera protection, or accessories. Simply log in and apply your balance at checkout.';

  const ctaText = isCashback ? 'Shop Device Skins' : 'Use Your Credit';

  const cashbackPill = isCashback && cashbackAmount
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
