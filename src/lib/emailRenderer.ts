/**
 * Exacoat Standalone Email Template Renderer
 * High-fidelity client-side email renderer for immediate, 100% accurate previews in Manager ERP.
 * Matches WooCommerce transactional customer emails and Exacoat brand voice.
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

const BRAND_WORDMARK_HTML = `
  <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#111111;text-transform:uppercase;">
    EXA<span style="color:#f3aa18;">COAT</span>
  </div>
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
                      ${BRAND_WORDMARK_HTML}
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
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;" class="mobile-padding">
                <p style="margin:0 0 6px;font-size:12px;color:#71717a;">
                  Have questions about your account? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                </p>
                <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat. Precision-cut skins and device protection.</p>
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
                      ${BRAND_WORDMARK_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;background:#fff8eb;color:#d97706;font-size:11px;font-weight:600;border-radius:999px;border:1px solid #fef3c7;letter-spacing:0.3px;">Welcome</span>
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
                  Your Exacoat customer account has been created. You can use your account to track order fulfillment, save your delivery addresses, and explore our newest precision gadget skins.
                </p>
                <div style="margin:28px 0;">
                  <a href="${accountUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;background:#111111;color:#ffffff;font-size:14px;font-weight:600;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    Access Your Account &rarr;
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;" class="mobile-padding">
                <p style="margin:0 0 6px;font-size:12px;color:#71717a;">
                  Have questions about your account? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                </p>
                <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat. Precision-cut skins and device protection.</p>
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
        name: 'iPhone 16 Pro Full Body Skin - Matrix Black',
        quantity: 1,
        price: 'Rp 149.000',
        meta: 'Variant: Full Body • Texture: Matrix Black',
      }
    ],
    subtotal: 'Rp 149.000',
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

  let subject = `Your Exacoat order #${orderNum} is confirmed`;
  let badgeText = 'Order confirmed';
  let title = 'Order confirmed';
  let bodyPrimary = `Thank you for your order. We’ve received order #${orderNum} and our production team will begin preparing your skins shortly.`;
  let bodySecondary = 'Every Exacoat skin is precision cut to 0.01mm tolerance using premium 3M vinyl materials. You can review your order details below.';
  let showShipment = false;

  if (event === 'customer_order_in_production') {
    subject = `Your Exacoat order #${orderNum} is in production`;
    badgeText = 'In production';
    title = 'In production';
    bodyPrimary = `Your custom skins for order #${orderNum} are now on our precision-cut production line.`;
    bodySecondary = 'Our team inspects every cut edge and texture layer for maximum fit precision. We will notify you as soon as your order is packed and ready to ship.';
  } else if (event === 'customer_order_awaiting_pickup') {
    subject = `Your Exacoat order #${orderNum} is packaged and ready to ship`;
    badgeText = 'Ready to ship';
    title = 'Ready to ship';
    bodyPrimary = `Your order #${orderNum} has passed quality inspection and has been packaged for courier pickup.`;
    bodySecondary = 'Your courier tracking number will be activated as soon as the package is scanned at the logistics hub.';
  } else if (event === 'customer_order_shipped') {
    subject = `Your Exacoat order #${orderNum} is on its way`;
    badgeText = 'On its way';
    title = 'On its way to you';
    bodyPrimary = `Your order #${orderNum} has been dispatched and is on its way. You can find your tracking details below.`;
    bodySecondary = 'Thank you for choosing Exacoat. Be sure to check our step-by-step video installation guides before applying your skin.';
    showShipment = Boolean(merged.tracking_number);
  } else if (event === 'customer_order_completed') {
    subject = `Your Exacoat order #${orderNum} has arrived`;
    badgeText = 'Delivered';
    title = 'Delivered';
    bodyPrimary = `Your order #${orderNum} has been marked delivered by the courier.`;
    bodySecondary = 'We hope you love your new device protection. If you need any assistance with installation, our support team is always here to help.';
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
    bodySecondary = 'We will begin precision cutting your skins as soon as payment is confirmed.';
  } else if (event === 'customer_order_failed') {
    subject = `Payment incomplete for order #${orderNum}`;
    badgeText = 'Payment failed';
    title = 'Payment not completed';
    bodyPrimary = `We were unable to process payment for order #${orderNum}. Your payment provider may have declined or timed out.`;
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

  const itemsHtml = (merged.items || []).map((item: any) => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:700;color:#111111;">${escapeHtml(item.name)}</div>
        ${item.meta ? `<div style="font-size:12px;color:#71717a;margin-top:4px;">${escapeHtml(item.meta)}</div>` : ''}
      </td>
      <td style="padding:16px 0;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px;color:#52525b;font-weight:600;">
        x${escapeHtml(item.quantity || 1)}
      </td>
      <td style="padding:16px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:700;color:#111111;">
        ${escapeHtml(item.price)}
      </td>
    </tr>
  `).join('');

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
                      ${BRAND_WORDMARK_HTML}
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:5px 13px;background:#fff8eb;color:#d97706;font-size:11px;font-weight:700;border-radius:999px;border:1px solid #fef3c7;letter-spacing:0.3px;text-transform:uppercase;">${badgeText}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 24px;" class="mobile-padding">
                <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#111111;letter-spacing:-0.5px;line-height:1.3;">${title}</h1>
                <p style="margin:0 0 14px;font-size:15px;font-weight:600;color:#18181b;">Hi ${custName},</p>
                <p style="margin:0 0 14px;font-size:14.5px;line-height:1.7;color:#3f3f46;">${bodyPrimary}</p>
                <p style="margin:0 0 24px;font-size:13.5px;line-height:1.7;color:#71717a;">${bodySecondary}</p>

                ${showShipment ? `
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:18px 20px;margin-bottom:28px;">
                  <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Shipment Tracking</div>
                  <div style="font-size:14px;font-weight:700;color:#111111;margin-bottom:4px;">${escapeHtml(merged.courier)} — ${escapeHtml(merged.tracking_number)}</div>
                  ${merged.tracking_url ? `<a href="${escapeHtml(merged.tracking_url)}" target="_blank" style="font-size:12px;color:#d97706;font-weight:600;text-decoration:underline;">Track Shipment Live &rarr;</a>` : ''}
                </div>
                ` : ''}

                <!-- Items Breakdown -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #f0f0f0;">
                  <thead>
                    <tr>
                      <th align="left" style="padding:12px 0 8px;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
                      <th align="center" style="padding:12px 0 8px;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                      <th align="right" style="padding:12px 0 8px;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>

                <!-- Totals -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#71717a;">Subtotal</td>
                    <td style="padding:6px 0;text-align:right;font-size:13px;color:#111111;font-weight:600;">${escapeHtml(merged.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:13px;color:#71717a;">Shipping (${escapeHtml(merged.shipping_method_name || 'Standard')})</td>
                    <td style="padding:6px 0;text-align:right;font-size:13px;color:#111111;font-weight:600;">${escapeHtml(merged.shipping_total)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 4px;border-top:2px solid #111111;font-size:15px;font-weight:800;color:#111111;">Total</td>
                    <td style="padding:12px 0 4px;border-top:2px solid #111111;text-align:right;font-size:16px;font-weight:800;color:#111111;">${escapeHtml(merged.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;" class="mobile-padding">
                <p style="margin:0 0 6px;font-size:12px;color:#71717a;">
                  Have questions about your order? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                </p>
                <p style="margin:0;font-size:11px;color:#a1a1aa;letter-spacing:0.2px;">&copy; Exacoat. Precision-cut skins and device protection.</p>
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
                    <td>${BRAND_WORDMARK_HTML}</td>
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
                  Your Exacoat skin was delivered recently. We'd love to know how your installation went and see your fresh setup with <strong>${prodTitle}</strong>.
                </p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#52525b;">
                  Leave an honest review with photos of your device and we'll instantly send you an exclusive discount code for your next skin.
                </p>
                <div style="margin:28px 0;">
                  <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;background:#f3aa18;color:#0a0a0a;font-size:14px;font-weight:800;border-radius:100px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(243,170,24,0.35);">
                    Review Your Skin & Get Reward &rarr;
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;color:#71717a;">
                  Have questions about your order? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                </p>
                <p style="margin:0;font-size:11px;color:#a1a1aa;">&copy; Exacoat. Precision-cut skins and device protection.</p>
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
                    <td>${BRAND_WORDMARK_HTML}</td>
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
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
                <p style="margin:0 0 6px;font-size:12px;color:#71717a;">
                  Have questions about your order? Reach our team at <a href="mailto:support@exacoat.com" style="color:#111111;text-decoration:underline;font-weight:500;">support@exacoat.com</a>
                </p>
                <p style="margin:0;font-size:11px;color:#a1a1aa;">&copy; Exacoat. Precision-cut skins and device protection.</p>
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
    ${BRAND_WORDMARK_HTML}
    <h2 style="margin-top:20px;">Notification: ${escapeHtml(event)}</h2>
    <p>This is an automated notification from Exacoat.</p>
  </div>
</body>
</html>`;
  return { subject, html, isLightMode: true };
}
