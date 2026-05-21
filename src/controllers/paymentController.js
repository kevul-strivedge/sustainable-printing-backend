import { db } from '../config/db.js';
import { ptQuotes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';
import { chargeCard } from '../utils/cybersource.js';
import { sendMail, invoiceEmailHtml } from '../utils/mailer.js';
import { generateInvoicePdfBuffer } from '../utils/invoicePdf.js';

export async function processCardPayment(req, res, next) {
  try {
    const quoteId = Number(req.params.quoteId);
    if (!quoteId) return error(res, 'Invalid quote ID', 400);

    const { cardNumber, cardType, cvv, expiryMonth, expiryYear, cardOwner } = req.body;
    if (!cardNumber || !cvv || !expiryMonth || !expiryYear) {
      return error(res, 'Card details are required', 400);
    }

    const month = parseInt(expiryMonth, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid expiry month. Please enter a value between 01 and 12.' });
    }

    // Fetch the quote
    const rows = await db.select().from(ptQuotes).where(eq(ptQuotes.id, quoteId)).limit(1);
    if (!rows.length) return error(res, 'Order not found', 404);
    const quote = rows[0];

    // Verify ownership when authenticated
    if (req.user && quote.memberId && req.user.id !== quote.memberId) {
      return error(res, 'Not authorized', 403);
    }

    // Parse billing details from the stored delivery snapshot
    let billing = {};
    try {
      billing = JSON.parse(quote.deliveryDetails ?? '{}');
    } catch { /* fall back to empty */ }

    console.log('[Payment] quoteId:', quoteId, '| DB paymentAmount:', quote.paymentAmount, '| type:', typeof quote.paymentAmount);

    const result = await chargeCard({
      amount:        quote.paymentAmount ?? 0,
      billing:       {
        firstName: billing.firstName ?? '',
        lastName:  billing.lastName  ?? '',
        address:   billing.address   ?? '',
        postcode:  billing.postcode  ?? '',
        suburb:    billing.suburb    ?? '',
        state:     billing.state     ?? '',
        phone:     billing.phone     ?? '',
        email:     billing.email     ?? '',
      },
      card: {
        number:      cardNumber.replace(/\s/g, ''),
        cvv,
        expiryMonth: String(month).padStart(2, '0'),
        expiryYear:  String(expiryYear).length === 2 ? `20${expiryYear}` : String(expiryYear),
      },
      referenceCode: quoteId,
    });

    if (result.status === 'AUTHORIZED') {
      const today = new Date().toISOString().slice(0, 10);
      await db.update(ptQuotes).set({
        paymentStatus:    'Paid',
        paymentReference: result.transactionId?.slice(0, 32) ?? null,
        paymentDate:      today,
        paymentMethod:    `Credit Card (${cardType || 'Card'})`,
      }).where(eq(ptQuotes.id, quoteId));

      // Send invoice email to delivery email
      const toEmail = billing.email;
      if (toEmail) {
        try {
          const paidOrder = { ...quote, paymentStatus: 'Paid' };
          const total     = Number(quote.paymentAmount ?? 0).toFixed(2);
          const pdfBuffer = await generateInvoicePdfBuffer(paidOrder);
          console.log('[processCardPayment] invoice PDF buffer size:', pdfBuffer?.length);
          await sendMail({
            to:          toEmail,
            subject:     `Confirmed Order | reference #${quoteId}`,
            html:        invoiceEmailHtml({ firstName: billing.firstName || '', quoteId, total, isPaid: true }),
            attachments: [{
              filename:    `Invoice-${quoteId}.pdf`,
              content:     pdfBuffer.toString('base64'),
              encoding:    'base64',
              contentType: 'application/pdf',
            }],
          });
          console.log('[processCardPayment] invoice email sent to:', toEmail);
        } catch (emailErr) {
          console.error('[processCardPayment] invoice email failed:', emailErr?.message ?? emailErr);
        }
      }

      return success(res, { transactionId: result.transactionId, status: 'paid' });
    }

    // Payment declined or failed — store error details
    await db.update(ptQuotes).set({
      paymentErrorMsg:  result.errorMsg?.slice(0, 500)   ?? 'Payment declined',
      paymentErrorBody: result.errorBody?.slice(0, 5000) ?? null,
    }).where(eq(ptQuotes.id, quoteId));

    return res.status(402).json({
      success: false,
      message: result.errorMsg ?? 'Your card was declined. Please check the details and try again.',
    });
  } catch (err) {
    next(err);
  }
}
