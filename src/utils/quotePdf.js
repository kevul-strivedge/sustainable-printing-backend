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
  doc.moveTo(40, y).lineTo(555, y).lineWidth(1.5).strokeColor(RULE_COLOR).stroke();
}

function labelValue(doc, label, value, y) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text(label, 40, y);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT).text(String(value ?? ''), 220, y);
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function buildQuotePdf(order, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Quote-${order.id}.pdf"`);
  doc.pipe(res);

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.image(LOGO_PATH, 40, 30, { width: 90 });

  doc.font('Helvetica-Bold').fontSize(26).fillColor(GREEN)
    .text('Quotation', 350, 32, { align: 'right', width: 205 });

  doc.font('Helvetica').fontSize(10).fillColor(TEXT)
    .text(`Ref No. :${order.id}`, 350, 64, { align: 'right', width: 205 });

  // ── Rule under header ───────────────────────────────────────────────────────
  rule(doc, 100);

  // ── Date / To / Attention ───────────────────────────────────────────────────
  const delivery = (() => {
    try { return JSON.parse(order.deliveryDetails ?? '{}'); } catch { return {}; }
  })();

  const fullName = [
    delivery.firstName || order.member?.firstName || '',
    delivery.lastName  || order.member?.lastName  || '',
  ].filter(Boolean).join(' ') || '—';

  const dateStr = formatDate(order.created);

  // Labels in the Date/To/Attention section are dark olive/teal per the design
  const infoLabel = (label, value, y) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#4a7c59').text(label, 40, y);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT).text(String(value ?? ''), 220, y);
  };

  infoLabel('Date',      dateStr,  114);
  infoLabel('To',        fullName, 132);
  infoLabel('Attention', fullName, 150);

  rule(doc, 172);

  // ── Order details ───────────────────────────────────────────────────────────
  const suburb   = delivery.suburb  || order.member?.suburb  || '';
  const state    = delivery.state   || order.member?.state   || '';
  const address  = delivery.address || order.member?.address || '';
  const deliveryStr = [address, suburb, state].filter(Boolean).join(', ') || '—';

  const artworkLabel =
    order.artworkStatus === 'uploaded' ? 'Artwork will be supplied as PDF' :
    order.artworkStatus === 'pending'  ? 'Artwork to be supplied later'    :
                                         'No artwork';

  const details = [
    ['Description', [order.stock, order.format].filter(Boolean).join(' ') || '—'],
    ['Size',        order.format  || '—'],
    ['Colour',      order.ink     || '—'],
    ['Stock',       order.stock   || '—'],
    ['Artwork',     artworkLabel],
    ['Proof',       'PDF'],
    ['Finishing',   order.finish  || '-'],
    ['Delivery',    deliveryStr],
    ['Your Quote Ref.', String(order.id)],
  ];

  let y = 186;
  for (const [label, value] of details) {
    labelValue(doc, label, value, y);
    y += 18;
  }

  rule(doc, y + 6);
  y += 18;

  // ── Quantity and Price ──────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN)
    .text('Quantity and Price', 40, y);
  y += 16;

  rule(doc, y);
  y += 12;

  // Table header
  const col = { type: 40, price: 250, gst: 370, total: 460 };
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN);
  doc.text('Printing type', col.type,  y);
  doc.text('Price',         col.price, y);
  doc.text('GST',           col.gst,   y);
  doc.text('Total Price',   col.total, y);
  y += 18;

  // Build split rows — prefer stored splits JSON; fall back to single row
  const storedSplits = (() => {
    try { return JSON.parse(order.summary ?? '{}').splits ?? null; } catch { return null; }
  })();

  const rows = storedSplits?.length
    ? storedSplits.map((s) => ({
        label: `${s.numDesigns ?? order.kind ?? 1} x ${s.qty}`,
        price: Number(s.price ?? 0),
      }))
    : [{
        label: order.quantity ? `${order.kind ?? 1} x ${order.quantity}` : '—',
        price: Number(order.printingPrice ?? 0),
      }];

  doc.font('Helvetica').fontSize(10).fillColor(TEXT);
  for (const row of rows) {
    const rowGst   = row.price * 0.1;
    const rowTotal = row.price + rowGst;
    doc.text(row.label,                  col.type,  y);
    doc.text(`$${row.price.toFixed(2)}`, col.price, y);
    doc.text(rowGst.toFixed(2),          col.gst,   y);
    doc.text(rowTotal.toFixed(2),        col.total, y);
    y += 18;
  }
  y += 6;

  // Notes
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN).text('Notes', 40, y);
  y += 20;

  rule(doc, y);
  y += 14;

  // ── Valid for ───────────────────────────────────────────────────────────────
  doc.font('Helvetica-BoldOblique').fontSize(10).fillColor(GREEN)
    .text('Quote Valid for 30 days', 40, y);
  y += 36;

  // ── Footer text ─────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN);
  doc.text('Thank you for your quote request.', 40, y); y += 20;
  doc.text(
    "If you have any queries, please don't hesitate to contact us on sales@sustainableprintingco.com.au",
    40, y, { width: 515 }
  ); y += 28;
  doc.text('Kind regards', 40, y); y += 18;
  doc.text('Sustainable Printing Co.', 40, y); y += 36;

  // ── Green footer bar ────────────────────────────────────────────────────────
  const pageH = doc.page.height;
  doc.rect(0, pageH - 50, doc.page.width, 50).fill(GREEN_DARK);
  doc.font('Helvetica').fontSize(12).fillColor('#ffffff')
    .text('sustainableprintingco.com.au', 0, pageH - 33, { align: 'center', width: doc.page.width });

  doc.end();
}
