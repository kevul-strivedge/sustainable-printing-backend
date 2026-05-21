import { sendMail } from '../utils/mailer.js';
import { success, error } from '../utils/apiResponse.js';

function row(label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:7px 14px;font-size:13px;color:#666;font-weight:600;white-space:nowrap;width:180px;border-bottom:1px solid #f0f0f0;">${label}</td>
      <td style="padding:7px 14px;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${value}</td>
    </tr>`;
}

function buildEmailHtml(data) {
  const green = '#3d9e5f';
  const navy  = '#292560';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <tr><td style="background:${green};padding:24px 32px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Sustainable Printing Co.</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">Sample Pack Request</p>
        </td></tr>

        <tr><td style="padding:28px 32px 12px;">
          <p style="margin:0;font-size:16px;font-weight:700;color:${navy};">Hello Admin,</p>
          <p style="margin:8px 0 0;font-size:13px;color:#666;">A new sample pack request has been submitted via the website.</p>
        </td></tr>

        <tr><td style="padding:0 32px 24px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">
            ${row('Business Name', data.businessName)}
            ${row('First Name',    data.firstName)}
            ${row('Surname',       data.surname)}
            ${row('Email',         data.email)}
            ${row('Phone',         data.phone)}
            ${row('Address',       data.address)}
            ${row('Town/City',     data.townCity)}
            ${row('State',         data.state)}
            ${row('Postcode',      data.postcode)}
            ${data.sampleOf ? row('In particular, I would like a sample of...', data.sampleOf) : ''}
          </table>
        </td></tr>

        <tr><td style="background:${green};padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#ffffff;">
            Ph: (03) 9482 2222 &nbsp;|&nbsp; www.sustainableprintingco.com.au
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function submitSamplePack(req, res, next) {
  try {
    const { businessName, firstName, surname, email, address, phone, townCity, state, postcode, sampleOf } = req.body;

    if (!firstName || !surname || !email || !address || !phone || !townCity || !state || !postcode) {
      return error(res, 'Please fill in all required fields.', 400);
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return error(res, 'Server configuration error.', 500);

    await sendMail({
      to:      adminEmail,
      subject: 'Request Sample Pack from User!',
      html:    buildEmailHtml({ businessName, firstName, surname, email, address, phone, townCity, state, postcode, sampleOf }),
    });

    return success(res, null, 'Your sample pack request has been sent successfully.');
  } catch (err) {
    console.error('[samplePack] email failed:', err?.message ?? err);
    next(err);
  }
}
