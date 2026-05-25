import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * Send a plain-text or HTML email, optionally with PDF attachments.
 *
 * @param {object} opts
 * @param {string}   opts.to          Recipient address
 * @param {string}   opts.subject
 * @param {string}   [opts.text]      Plain-text body
 * @param {string}   [opts.html]      HTML body (takes priority over text in email clients)
 * @param {Array}    [opts.attachments]  nodemailer attachment objects
 *                   e.g. [{ filename: 'Invoice-1.pdf', content: <Buffer>, contentType: 'application/pdf' }]
 */
export async function sendMail({ to, subject, text, html, attachments }) {
  await transporter.sendMail({
    from:        `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
    to,
    cc:          process.env.ADMIN_EMAIL || undefined,
    subject,
    text,
    html,
    attachments,
  });
}

// ── Email HTML templates ────────────────────────────────────────────────────

export function invoiceEmailHtml({ firstName, quoteId, total, isPaid }) {
  const green  = '#3d9e5f';
  const navy   = '#292560';

  const heading = isPaid
    ? 'Your payment has been received — order confirmed!'
    : 'Your order has been received — payment pending';

  const bodyText = isPaid
    ? `Your credit card payment of <strong>$${total} AUD</strong> has been successfully processed. Please find your tax invoice attached for your records.`
    : `Thank you for choosing Direct Bank Transfer. Please transfer <strong>$${total} AUD</strong> using the details below and quote your order reference as the payment description.<br><br>
       <strong>Account Name:</strong> Sustainable Printing Co.<br>
       <strong>BSB:</strong> 013 412<br>
       <strong>Account No:</strong> 3094 31255<br>
       <strong>Bank:</strong> ANZ<br><br>
       Your order will be processed once payment clears. Please find your tax invoice attached.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header bar -->
        <tr><td style="background:${green};padding:24px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Sustainable Printing Co.</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">sustainableprintingco.com.au</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${navy};">Hi ${firstName},</p>
          <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:${green};">${heading}</p>

          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">${bodyText}</p>

          <!-- Order reference chip -->
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr>
              <td style="background:#f0faf5;border:1px solid #c8e6d4;border-radius:6px;padding:12px 20px;">
                <p style="margin:0;font-size:12px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Order Reference</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${green};">#SPC-${quoteId}</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:14px;color:#444;line-height:1.6;">
            If you have any questions, please contact us at
            <a href="mailto:sales@sustainableprintingco.com.au" style="color:${green};">sales@sustainableprintingco.com.au</a>
            or call <strong>(03) 9482 2222</strong>.
          </p>
          <p style="margin:20px 0 0;font-size:14px;color:#444;">Kind regards,<br><strong>Sustainable Printing Co.</strong></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${green};padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#ffffff;">
            Ph: (03) 9482 2222 &nbsp;|&nbsp; www.sustainableprintingco.com.au<br>
            <span style="opacity:.8;">PO Box 2456 Fitzroy BC Vic 3065 &nbsp;|&nbsp; ABN 68 006 898 031</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Welcome email for guests whose pt_members account was auto-created during checkout.
 * Carries the generated plaintext password so the customer can log in to /my-history later.
 * Style mirrors the invoice email so users perceive both as official Sustainable Printing Co.
 * messages.
 */
export function guestCredentialsEmailHtml({ firstName, email, password }) {
  const green = '#3d9e5f';
  const navy  = '#292560';
  // FRONTEND_URL is a comma-separated list (localhost,prod). First entry = canonical site.
  const loginUrl = `${(process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim()}/login`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header bar -->
        <tr><td style="background:${green};padding:24px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Sustainable Printing Co.</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">sustainableprintingco.com.au</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${navy};">Hi ${firstName || 'there'},</p>
          <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:${green};">Your account is ready</p>

          <p style="margin:0 0 16px;font-size:14px;color:#444;line-height:1.6;">
            Thank you for placing your order with Sustainable Printing Co. We've created an account for you so
            you can track your order status, reorder later, and download invoices anytime.
          </p>

          <!-- Credentials block -->
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%;">
            <tr>
              <td style="background:#f0faf5;border:1px solid #c8e6d4;border-radius:6px;padding:16px 20px;">
                <p style="margin:0 0 8px;font-size:12px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Your Login Details</p>
                <p style="margin:0 0 6px;font-size:14px;color:${navy};"><strong>Email:</strong> <code style="font-size:13px;background:#ffffff;padding:2px 6px;border-radius:3px;">${email}</code></p>
                <p style="margin:0;font-size:14px;color:${navy};"><strong>Password:</strong> <code style="font-size:13px;background:#ffffff;padding:2px 6px;border-radius:3px;">${password}</code></p>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
            <tr>
              <td style="background:${green};border-radius:24px;">
                <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">Sign in to your account</a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6;">
            We recommend updating your password after your first sign-in.
            If you didn't place an order, please ignore this email or contact us at
            <a href="mailto:sales@sustainableprintingco.com.au" style="color:${green};">sales@sustainableprintingco.com.au</a>.
          </p>

          <p style="margin:20px 0 0;font-size:14px;color:#444;">Kind regards,<br><strong>Sustainable Printing Co.</strong></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${green};padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#ffffff;">
            Ph: (03) 9482 2222 &nbsp;|&nbsp; www.sustainableprintingco.com.au<br>
            <span style="opacity:.8;">PO Box 2456 Fitzroy BC Vic 3065 &nbsp;|&nbsp; ABN 68 006 898 031</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
