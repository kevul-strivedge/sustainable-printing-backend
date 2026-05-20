import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

const GREEN      = '#3d9e5f';
const GREEN_DARK = '#2d7a4a';
const NAVY       = '#292560';
const TEXT       = '#222222';
const RULE_COLOR = '#8dc63f';

function rule(doc, y) {
  doc.moveTo(40, y).lineTo(555, y).lineWidth(1).strokeColor(RULE_COLOR).stroke();
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd   = String(dt.getDate()).padStart(2, '0');
  const mm   = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function _populateInvoice(doc, order) {
  // ── Header ──────────────────────────────────────────────────────────────────
  doc.image(LOGO_PATH, 40, 22, { width: 210 });

  doc.font('Helvetica-Bold').fontSize(28).fillColor(NAVY)
    .text('Tax Invoice', 320, 24, { align: 'right', width: 235 });
  doc.font('Helvetica').fontSize(11).fillColor(TEXT)
    .text(`Invoice No. ${order.id}`, 320, 64, { align: 'right', width: 235 })
    .text(`Date: ${formatDate(order.created)}`, 320, 80, { align: 'right', width: 235 });

  rule(doc, 108);

  // ── Invoice To / Attention ──────────────────────────────────────────────────
  const delivery = (() => {
    try { return JSON.parse(order.deliveryDetails ?? '{}'); } catch { return {}; }
  })();

  const company   = delivery.company   || order.member?.businessname || '';
  const firstName = delivery.firstName || order.member?.firstName    || '';
  const lastName  = delivery.lastName  || order.member?.lastName     || '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ')  || '—';
  const address   = delivery.address  || order.member?.address  || '';
  const suburb    = delivery.suburb   || order.member?.suburb   || '';
  const state     = delivery.state    || order.member?.state    || '';
  const postcode  = delivery.postcode || order.member?.postcode || '';

  const invoiceName = company || fullName;
  const addressLine = address;
  const townLine    = [suburb, state, postcode].filter(Boolean).join(' ');

  let y = 122;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text('Invoice To', 40, y);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(invoiceName, 200, y);
  y += 14;
  if (addressLine) {
    doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(addressLine, 200, y);
    y += 14;
  }
  if (townLine) {
    doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(townLine, 200, y);
    y += 14;
  }

  y += 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text('Attention', 40, y);
  doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(fullName, 200, y);
  y += 24;

  rule(doc, y);
  y += 10;

  // ── Description section ─────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text('Description', 40, y);
  y += 14;
  rule(doc, y);
  y += 10;

  const artworkLabel =
    order.artworkStatus === 'uploaded' ? 'Artwork will be supplied as PDF' :
    order.artworkStatus === 'pending'  ? 'Artwork to be supplied later'    :
                                         'No artwork';

  const orderPostcode = delivery.postcode || order.postcode || '';
  const quantityLabel = order.quantity ? `${order.kind ?? 1} x ${order.quantity}` : '—';

  const descRows = [
    ['Description', [order.stock, order.format].filter(Boolean).join(' ') || '—'],
    ['Size',        order.format  || '—'],
    ['Colour',      order.ink     || '—'],
    ['Stock',       order.stock   || '—'],
    ['Artwork',     artworkLabel],
    ['Proof',       'No proof required'],
    ['Finishing',   order.finish  || '—'],
    ['Delivery',    orderPostcode || '—'],
    ['Quantity',    quantityLabel],
  ];

  for (const [label, value] of descRows) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text(label, 40, y);
    doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(String(value), 200, y);
    y += 16;
  }

  y += 6;
  rule(doc, y);
  y += 8;

  // ── Purchase Order No. / Terms ──────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN)
    .text('Purchase Order No.', 40, y)
    .text('Terms:', 350, y, { align: 'right', width: 205 });
  y += 16;
  rule(doc, y);
  y += 8;

  // ── Ownership disclaimer ────────────────────────────────────────────────────
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(TEXT).text(
    'Ownership of the above remains with Sustainable Printing Co. until such time as full payment has been received by Sustainable Printing\nCo. and cleared by their bankers. Acceptance of these goods confirm acceptance of these conditions.',
    40, y, { width: 515, lineGap: 1 }
  );
  y += 32;

  // ── Payment Options ─────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text('Payment Options', 40, y);
  y += 14;
  rule(doc, y);
  y += 8;

  const paymentOptions = [
    ['Mail',            'Cheques made payable to Sustainable Printing Co.\nPlease enclose the remittance advice to address below.'],
    ['Credit Card',     'We accept EFTPOS. Visa, Mastercard, Bankcard and American Express.\n(All Amex payments will incur a 3% surcharge unless paid within 14 days from date of invoice)'],
    ['Direct Transfer', 'Account Name: Sustainable Printing Co.  BSB: 013 412  Account No: 3094 31255  Bank: ANZ'],
  ];

  for (const [label, text] of paymentOptions) {
    const startY = y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text(label, 40, startY);
    doc.font('Helvetica').fontSize(9).fillColor(TEXT).text(text, 140, startY, { width: 375, lineGap: 1 });
    const lineCount = text.split('\n').length;
    y += lineCount * 13 + 5;
  }

  y += 4;
  rule(doc, y);
  y += 12;

  // ── Summary (right-aligned) ─────────────────────────────────────────────────
  const subTotal = Number(order.printingPrice ?? 0) + Number(order.deliveryPrice ?? 0);
  const gst      = subTotal * 0.1;
  const total    = Number(order.paymentAmount ?? (subTotal + gst));
  const paid     = order.paymentStatus === 'Paid' ? total : 0;
  const balance  = total - paid;

  const summaryRows = [
    ['Sub Total', `$${subTotal.toFixed(2)}`],
    ['GST',       `$${gst.toFixed(2)}`],
    ['Total',     `$${total.toFixed(2)}`],
    ['Paid',      `$${paid.toFixed(2)}`],
    ['Balance',   `$${balance.toFixed(2)}`],
  ];

  for (const [label, value] of summaryRows) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN)
      .text(label, 360, y, { align: 'right', width: 95 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT)
      .text(value, 460, y, { align: 'right', width: 95 });
    y += 16;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const pageH = doc.page.height;

  doc.font('Helvetica').fontSize(9).fillColor(TEXT)
    .text('ABN 68 006 898 031', 40, pageH - 90);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
    .text('All Correspondence to: PO Box 2456 Fitzroy BC Vic 3065', 40, pageH - 78);
  doc.font('Helvetica').fontSize(9).fillColor(TEXT)
    .text('Email: sales@sustainableprintingco.com.au', 40, pageH - 66);

  doc.rect(0, pageH - 50, doc.page.width, 50).fill(GREEN_DARK);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
    .text('Ph: (03) 9482 2222     www.sustainableprintingco.com.au', 0, pageH - 33, {
      align: 'center', width: doc.page.width,
    });
}

export function buildInvoicePdf(order, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Invoice-${order.id}.pdf"`);
  doc.pipe(res);
  _populateInvoice(doc, order);
  doc.end();
}

export function generateInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data',  (c) => chunks.push(c));
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    _populateInvoice(doc, order);
    doc.end();
  });
}
