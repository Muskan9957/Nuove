const { Resend } = require('resend');

// Lazy init — avoids crash when key isn't set yet
const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM     = process.env.EMAIL_FROM || 'Nuove <noreply@nuove.in>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support.nuove@anahatone.com';
const APP      = 'Nuove';

// ─── Shared HTML wrapper ─────────────────────────────────────────────
const layout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${APP}</title>
</head>
<body style="margin:0;padding:0;background:#F8F8FA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8FA;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <img src="https://www.nuove.in/email-logo.png" alt="${APP}" width="300" height="80" style="display:inline-block;width:300px;height:80px;border:0;outline:none;"/>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#FFFFFF;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="color:#8888A0;font-size:12px;margin:0;">
            © ${new Date().getFullYear()} ${APP}
          </p>
          <p style="color:#8888A0;font-size:11px;margin:6px 0 0;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ─── Password Reset Email ────────────────────────────────────────────
const passwordResetHtml = ({ name, resetUrl }) => layout(`
  <!-- Header band -->
  <div style="background:linear-gradient(135deg,rgba(255,95,31,0.15),rgba(255,60,172,0.10));padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="font-size:36px;margin-bottom:12px;">🔐</div>
    <h1 style="color:#111111;font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;">Reset your password</h1>
    <p style="color:#4A4A60;font-size:15px;margin:0;line-height:1.5;">
      Hey ${name || 'Creator'}, we got a request to reset your ${APP} password.
    </p>
  </div>

  <!-- Body -->
  <div style="padding:32px 40px;">
    <p style="color:#4A4A60;font-size:14px;line-height:1.7;margin:0 0 28px;">
      Click the button below to set a new password. This link expires in <strong style="color:#111111;">1 hour</strong>.
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center" style="padding-bottom:28px;">
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#FF5F1F,#FF3CAC);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
          Reset Password →
        </a>
      </td></tr>
    </table>

    <!-- URL fallback -->
    <div style="background:#F8F8FA;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="color:#8888A0;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Or copy this link</p>
      <p style="color:#4A4A60;font-size:12px;margin:0;word-break:break-all;font-family:monospace;">${resetUrl}</p>
    </div>

    <p style="color:#8888A0;font-size:13px;margin:0;line-height:1.6;">
      Didn't request this? Your account is safe — just ignore this email.
    </p>
  </div>
`);

// ─── Welcome Email ────────────────────────────────────────────────────
const welcomeHtml = ({ name }) => layout(`
  <!-- Header band -->
  <div style="background:linear-gradient(135deg,rgba(255,95,31,0.15),rgba(255,60,172,0.10));padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="font-size:36px;margin-bottom:12px;">🚀</div>
    <h1 style="color:#111111;font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;">Welcome to ${APP}!</h1>
    <p style="color:#4A4A60;font-size:15px;margin:0;line-height:1.5;">
      Hey ${name || 'Creator'}, your account is ready. Let's make your first viral script.
    </p>
  </div>

  <!-- Body -->
  <div style="padding:32px 40px;">
    <!-- Feature bullets -->
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
      ${[
        ['⚡', 'Script Generator', 'Hooks, body & CTA in seconds'],
        ['💬', 'Creator Advisor',  'Personalised AI coaching, on demand'],
        ['🎥', 'Record',           'Built-in teleprompter to record on the spot'],
        ['📈', 'Trending Topics',  'Real, current trends to ride today'],
        ['✍️', 'Captions',         'Scroll-stopping captions & hashtags'],
      ].map(([emoji, title, sub]) => `
        <tr>
          <td style="padding:10px 0;vertical-align:top;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:20px;padding-right:14px;vertical-align:top;padding-top:2px;">${emoji}</td>
                <td>
                  <div style="color:#111111;font-size:14px;font-weight:700;margin-bottom:2px;">${title}</div>
                  <div style="color:#4A4A60;font-size:13px;">${sub}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `).join('')}
    </table>

    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">
        <a href="${process.env.FRONTEND_URL || 'https://nuove.in'}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#FF5F1F,#FF3CAC);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
          Open my dashboard →
        </a>
      </td></tr>
    </table>
  </div>
`);

// ─── Exported send functions ─────────────────────────────────────────

const sendPasswordReset = async ({ to, name, resetUrl }) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED — add RESEND_API_KEY to .env] Reset URL: ${resetUrl}`);
    return;
  }
  await resend.emails.send({
    from    : FROM,
    replyTo : REPLY_TO,
    to,
    subject: `Reset your ${APP} password`,
    html   : passwordResetHtml({ name, resetUrl }),
  });
};

const sendWelcome = async ({ to, name }) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED — add RESEND_API_KEY to .env] Welcome for ${to}`);
    return;
  }
  await resend.emails.send({
    from    : FROM,
    replyTo : REPLY_TO,
    to,
    subject: `Welcome to ${APP} 🚀`,
    html   : welcomeHtml({ name }),
  });
};

// ─── Verification Email (6-digit code) ────────────────────────────────
const verificationHtml = ({ name, code }) => layout(`
  <div style="background:linear-gradient(135deg,rgba(255,95,31,0.15),rgba(255,60,172,0.10));padding:36px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <div style="font-size:36px;margin-bottom:12px;">✉️</div>
    <h1 style="color:#111111;font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px;">Verify your email</h1>
    <p style="color:#4A4A60;font-size:15px;margin:0;line-height:1.5;">
      Hey ${name || 'Creator'}, enter this code on the Nuove screen to activate your account.
    </p>
  </div>
  <div style="padding:32px 40px;">
    <p style="color:#4A4A60;font-size:14px;line-height:1.7;margin:0 0 20px;">
      Your verification code:
    </p>
    <div style="background:#F8F8FA;border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <span style="color:#111111;font-size:34px;font-weight:800;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</span>
    </div>
    <p style="color:#8888A0;font-size:13px;margin:0;">This code is valid for one use. Didn't sign up? You can safely ignore this email.</p>
  </div>
`);

const sendVerificationEmail = async ({ to, name, code }) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED] Verification code for ${to}: ${code}`);
    return;
  }
  await resend.emails.send({
    from    : FROM,
    replyTo : REPLY_TO,
    to,
    subject: `Your ${APP} verification code: ${code}`,
    html   : verificationHtml({ name, code }),
  });
};

const sendSupportTicket = async ({ fromEmail, fromName, message }) => {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL SKIPPED — add RESEND_API_KEY to .env] Support query from ${fromEmail}: ${message}`);
    return;
  }
  await resend.emails.send({
    from    : FROM,
    replyTo : fromEmail,
    to      : REPLY_TO,
    subject : `[Nuove Support] Ticket from ${fromName || 'User'}`,
    html    : layout(`
      <div style="padding:32px 40px;">
        <h2 style="color:#FF5F1F; margin-top:0; font-size:22px; font-weight:800;">New Support Request</h2>
        <p style="color:#4A4A60; font-size:14px; margin: 4px 0;"><strong>Name:</strong> ${fromName || 'N/A'}</p>
        <p style="color:#4A4A60; font-size:14px; margin: 4px 0;"><strong>Email:</strong> ${fromEmail}</p>
        <div style="background:#F8F8FA; border:1px solid rgba(255,255,255,0.10); border-radius:12px; padding:20px; color:#111111; font-family:monospace; white-space:pre-wrap; line-height:1.6; margin-top:20px;">${message}</div>
      </div>
    `)
  });
};

module.exports = { sendPasswordReset, sendWelcome, sendVerificationEmail, sendSupportTicket };

