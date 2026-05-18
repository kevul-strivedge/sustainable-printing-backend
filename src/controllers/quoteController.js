import { db } from '../config/db.js';
import { ptMembers, ptQuotes, ptQuoteArtworks } from '../db/schema.js';

export async function submitQuote(req, res) {
  try {
    const {
      productDbId,
      kind,
      quantity,
      formatLabel,
      stockLabel,
      printingType,
      extrasLabel,
      printingPrice,
      deliveryPrice,
      paymentAmount,
      artworkMethod,
      artworkFileUrl,
      artworkFileName,
      firstName,
      lastName,
      company,
      address,
      suburb,
      state,
      postcode,
      phone,
      email,
      paymentMethod,
    } = req.body;

    if (!firstName || !lastName || !email || !postcode) {
      return res.status(400).json({ success: false, message: 'Missing required delivery fields.' });
    }

    // 1. Create member record
    const now = new Date();
    const [memberResult] = await db.insert(ptMembers).values({
      firstName,
      lastName,
      businessname: company || '',
      address:      address || '',
      suburb:       suburb || '',
      state:        state || '',
      postcode:     postcode || '',
      email,
      phone:        phone || '',
      status:       'Pending',
      created:      now,
      createdAt:    now,
      updatedAt:    now,
      // NOT NULL columns with no real DB default — must be explicitly supplied
      name:                '',
      password:            '',
      passwordToken:       '',
      rememberToken:       '',
      invoiceBusinessname: '',
      invoiceFirstName:    '',
      invoiceLastName:     '',
      invoiceAddress:      '',
      invoiceSuburb:       '',
      invoiceState:        '',
      invoicePostcode:     '',
      invoiceEmail:        '',
      invoicePhone:        '',
      invoiceMobile:       '',
    });
    const memberId = memberResult.insertId;

    // 2. Create quote record
    const paymentLabel = paymentMethod === 'bank' ? 'Direct Bank Transfer' : 'Credit Card';
    const [quoteResult] = await db.insert(ptQuotes).values({
      memberId,
      productType:   productDbId ?? null,
      kind:          kind ?? 1,
      quantity:      quantity ?? 0,
      postcode:      postcode || '',
      format:        formatLabel || '',
      stock:         stockLabel || '',
      ink:           printingType || '',
      finish:        extrasLabel || '',
      printingPrice: printingPrice ?? 0,
      deliveryPrice: deliveryPrice ?? 0,
      paymentAmount: paymentAmount ?? 0,
      paymentMethod: paymentLabel,
      paymentStatus: 'Unpaid',
      artworkStatus: artworkFileUrl ? 'uploaded' : (artworkMethod === 'upload-later' ? 'pending' : 'no_artwork'),
      status:        'Pending',
      created:       new Date(),
      createdBy:     'Member',
      quoteType:     'design_and_print',
      deliveryType:  'PrintTogether',
      repeatJobDate: now,
    });
    const quoteId = quoteResult.insertId;

    // 3. Link uploaded artwork file
    if (artworkFileUrl && artworkFileName) {
      const ext = artworkFileName.split('.').pop()?.toLowerCase() ?? '';
      const mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', ai: 'application/postscript', psd: 'image/vnd.adobe.photoshop' };
      await db.insert(ptQuoteArtworks).values({
        quoteId,
        fileName:        artworkFileUrl,
        mimeType:        mimeMap[ext] ?? 'application/octet-stream',
        extension:       ext,
        selectedArtwork: 1,
        selectedProof:   0,
      });
    }

    return res.json({ success: true, quoteId });
  } catch (err) {
    console.error('submitQuote error:', err?.message ?? err);
    return res.status(500).json({ success: false, message: err?.message ?? 'Failed to submit order. Please try again.' });
  }
}
