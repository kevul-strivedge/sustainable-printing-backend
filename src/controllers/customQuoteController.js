import multer from 'multer';
import { sendMail } from '../utils/mailer.js';
import { success, error } from '../utils/apiResponse.js';

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/postscript',
  'application/illustrator',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extOk = /\.(pdf|ai|eps|png|jpg|jpeg)$/i.test(file.originalname);
    if (ALLOWED_MIMES.has(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a PDF, AI, EPS, PNG, or JPG file.'));
    }
  },
}).single('artwork');

function row(label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:7px 14px;font-size:13px;color:#666;font-weight:600;white-space:nowrap;width:180px;border-bottom:1px solid #f0f0f0;">${label}</td>
      <td style="padding:7px 14px;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${value}</td>
    </tr>`;
}

function sectionHeader(label) {
  return `
    <tr style="background:#f8f9fa;">
      <td colspan="2" style="padding:8px 14px;font-size:11px;font-weight:700;color:#3d9e5f;text-transform:uppercase;letter-spacing:.6px;">${label}</td>
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
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">New Custom Quote Request</p>
        </td></tr>

        <tr><td style="padding:28px 32px 12px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:${navy};">Custom Quote Request</p>
          <p style="margin:6px 0 0;font-size:13px;color:#666;">A new custom quote has been submitted via the website.</p>
        </td></tr>

        <tr><td style="padding:0 32px 24px;">
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">
            ${sectionHeader('Product Details')}
            ${row('Category',      data.category)}
            ${row('Name of Item',  data.nameOfItem)}
            ${row('Description',   data.describeItem)}
            ${row('Size',          data.size)}
            ${row('Designs/Kinds', data.designs)}
            ${sectionHeader('Contact Details')}
            ${row('Business Name', data.businessName)}
            ${row('Name',          data.name)}
            ${row('Email',         data.email)}
            ${row('Phone',         data.phone)}
          </table>
          ${data.hasAttachment ? `<p style="margin:14px 0 0;font-size:13px;color:#444;">Artwork file attached: <strong>${data.attachmentName}</strong></p>` : ''}
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

export function submitCustomQuote(req, res) {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return error(res, 'File exceeds the 20MB limit.', 400);
    }
    if (err) {
      return error(res, err.message, 400);
    }

    const { category, nameOfItem, describeItem, size, designs, businessName, name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return error(res, 'Name, email, and phone are required.', 400);
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return error(res, 'Server configuration error.', 500);
    }

    const attachments = [];
    if (req.file) {
      attachments.push({
        filename:    req.file.originalname,
        content:     req.file.buffer.toString('base64'),
        encoding:    'base64',
        contentType: req.file.mimetype,
      });
    }

    try {
      await sendMail({
        to:          adminEmail,
        subject:     'Request a Custom Quote',
        html:        buildEmailHtml({
          category, nameOfItem, describeItem, size, designs, businessName, name, email, phone,
          hasAttachment:  !!req.file,
          attachmentName: req.file?.originalname,
        }),
        attachments,
      });

      return success(res, null, 'Your custom quote request has been sent successfully. We will be in touch shortly.');
    } catch (mailErr) {
      console.error('[customQuote] email failed:', mailErr?.message ?? mailErr);
      return error(res, 'Failed to send your request. Please try again.', 500);
    }
  });
}
