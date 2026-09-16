const fs = require('fs');
const path = require('path');
const https = require('https');

const outDir = path.join(__dirname, '..', 'supabase', 'email-templates');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const projectRef = 'vamdbdbbltxjfcrsbgsq';
const pat = process.env.SUPABASE_PAT;
if (!pat) throw new Error('SUPABASE_PAT is required');

function baseTemplate({ subject, badge, title, greeting, bodyPrimary, bodySecondary, ctaText, ctaUrl, tokenSlot, securityNotice }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #080809;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    @media only screen and (max-width: 620px) {
      .container-table { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .otp-text { font-size: 28px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body bgcolor="#080809" style="margin:0;padding:0;background-color:#080809;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080809" style="background-color:#080809;padding:40px 14px;">
    <tbody>
      <tr>
        <td align="center">
          <table class="container-table" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#0e0e10;border-radius:24px;overflow:hidden;border:1px solid #1c1c20;box-shadow:0 16px 48px rgba(0,0,0,0.7);">
            <tbody>
              <!-- Header Bar -->
              <tr>
                <td style="padding:26px 36px 20px;border-bottom:1px solid #18181c;" class="mobile-padding">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle">
                        <img src="https://artmatter.co/wp-content/uploads/assets/brand/artmatter-wordmark-light.png" alt="Artmatter" width="160" style="width:160px;height:auto;display:block;border:0;outline:none;text-decoration:none;" />
                      </td>
                      <td align="right" valign="middle">
                        <span style="display:inline-block;padding:5px 12px;background:#141418;color:#a9ff5d;font-size:11px;font-weight:700;border-radius:999px;border:1px solid rgba(169,255,93,0.3);letter-spacing:0.3px;">${badge}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content Body -->
              <tr>
                <td style="padding:34px 36px 26px;" class="mobile-padding">
                  <h1 style="margin:0 0 14px;font-size:23px;font-weight:800;color:#ffffff;letter-spacing:-0.4px;line-height:1.25;">${title}</h1>
                  <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#f4f4f5;">${greeting}</p>
                  <p style="margin:0 0 14px;font-size:13.5px;line-height:1.7;color:#a1a1aa;">${bodyPrimary}</p>
                  ${bodySecondary ? `<p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#71717a;">${bodySecondary}</p>` : ''}

                  ${tokenSlot ? `
                  <!-- Refined Luxury OTP Passcode Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;border-collapse:separate;">
                    <tbody>
                      <tr>
                        <td align="center" style="background:#131316;border:1px solid #222226;border-radius:18px;padding:22px 18px 18px;box-shadow:0 4px 20px rgba(0,0,0,0.35);">
                          <!-- Header Tag -->
                          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                            <tr>
                              <td align="center">
                                <span style="display:inline-block;padding:3px 10px;background:rgba(255,255,255,0.04);color:#a1a1aa;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-radius:999px;border:1px solid rgba(255,255,255,0.06);font-family:'Plus Jakarta Sans',sans-serif;">
                                  Verification Code
                                </span>
                              </td>
                            </tr>
                          </table>
                          
                          <!-- Inner Code Display Badge -->
                          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;">
                            <tr>
                              <td align="center" style="background:#060608;border:1px solid rgba(169,255,93,0.35);border-radius:12px;padding:12px 24px;box-shadow:0 0 20px rgba(169,255,93,0.08), inset 0 1px 2px rgba(0,0,0,0.6);">
                                <span class="otp-text" style="color:#a9ff5d;font-size:36px;font-weight:800;letter-spacing:8px;display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Roboto Mono',monospace;line-height:1;text-shadow:0 0 14px rgba(169,255,93,0.35);">
                                  ${tokenSlot}
                                </span>
                              </td>
                            </tr>
                          </table>

                          <!-- Helper Subtext -->
                          <p style="margin:0;font-size:11.5px;color:#71717a;line-height:1.5;font-family:'Plus Jakarta Sans',sans-serif;">
                            Enter this 6-digit code on the verification screen, or click the button below.
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>` : ''}

                  ${ctaText && ctaUrl ? `
                  <div style="margin:24px 0 18px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius:999px;background:#ffffff;">
                          <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 30px;background:#ffffff;color:#09090b;font-size:13.5px;font-weight:700;border-radius:999px;text-decoration:none;letter-spacing:0.2px;box-shadow:0 2px 12px rgba(255,255,255,0.12);">
                            ${ctaText} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </div>` : ''}

                  ${securityNotice ? `
                  <div style="margin-top:22px;padding:14px 16px;background:#131316;border:1px solid #1e1e22;border-radius:12px;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">${securityNotice}</p>
                  </div>` : ''}
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding:0 36px;" class="mobile-padding">
                  <hr style="border:none;border-top:1px solid #18181c;margin:0;">
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding:26px 36px 30px;text-align:center;" class="mobile-padding">
                  <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#71717a;">
                    Have questions? Reach our artist team at <a href="mailto:artist@artmatter.co" style="color:#e4e4e7;text-decoration:underline;">artist@artmatter.co</a>
                  </p>
                  <p style="margin:0;font-size:11px;color:#52525b;letter-spacing:0.2px;">&copy; Artmatter</p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}

// 1. Confirm Sign Up (Contains both 6-Digit Code and 1-Click Button)
const confirmSignUpHtml = baseTemplate({
  subject: 'Confirm your email for Artmatter',
  badge: 'Email verification',
  title: 'Confirm your email',
  greeting: 'Welcome to Artmatter.',
  bodyPrimary: 'Thank you for signing up. Please verify your email address using the 6-digit code or link below to activate your artist workspace.',
  bodySecondary: 'If you did not sign up for an Artmatter account, you can safely ignore this email.',
  ctaText: 'Confirm Email Address',
  ctaUrl: '{{ .ConfirmationURL }}',
  tokenSlot: '{{ .Token }}',
  securityNotice: 'If the button above does not open directly, copy and paste the confirmation link into your browser: <br><span style="color:#a9ff5d;word-break:break-all;font-size:11.5px;">{{ .ConfirmationURL }}</span>'
});
fs.writeFileSync(path.join(outDir, 'confirm-sign-up.html'), confirmSignUpHtml);

// 2. Reset Password
const resetPasswordHtml = baseTemplate({
  subject: 'Reset your Artmatter password',
  badge: 'Account security',
  title: 'Reset your password',
  greeting: 'Password reset request.',
  bodyPrimary: 'We received a request to reset the password for your Artmatter account. You can set a new password using the button or 6-digit code below.',
  bodySecondary: 'If you did not request a password reset, your account remains secure and you can safely disregard this email.',
  ctaText: 'Reset Password',
  ctaUrl: '{{ .ConfirmationURL }}',
  tokenSlot: '{{ .Token }}',
  securityNotice: 'This password reset link expires in 60 minutes and can only be used once.'
});
fs.writeFileSync(path.join(outDir, 'reset-password.html'), resetPasswordHtml);

// 3. Magic Link or OTP
const magicLinkHtml = baseTemplate({
  subject: 'Your login code for Artmatter',
  badge: 'Artist sign-in',
  title: 'Your sign-in code',
  greeting: 'Sign in to Artmatter.',
  bodyPrimary: 'Use the 6-digit verification code below or click the sign-in button to access your workspace.',
  bodySecondary: 'If you did not request this link, you can safely ignore this message.',
  ctaText: 'Sign In to Artmatter',
  ctaUrl: '{{ .ConfirmationURL }}',
  tokenSlot: '{{ .Token }}',
  securityNotice: 'For your security, this verification link and code expire in 5 minutes and can only be used once.'
});
fs.writeFileSync(path.join(outDir, 'magic-link-otp.html'), magicLinkHtml);

// Upload updated templates to Supabase
const payload = {
  mailer_subjects_confirmation: 'Confirm your email for Artmatter',
  mailer_templates_confirmation_content: confirmSignUpHtml,
  mailer_subjects_recovery: 'Reset your Artmatter password',
  mailer_templates_recovery_content: resetPasswordHtml,
  mailer_subjects_magic_link: 'Your login code for Artmatter',
  mailer_templates_magic_link_content: magicLinkHtml
};

const postData = JSON.stringify(payload);

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/config/auth`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${pat}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    console.log('[SUPABASE EMAIL TEMPLATES UPDATE STATUS]', res.statusCode);
  });
});

req.write(postData);
req.end();
