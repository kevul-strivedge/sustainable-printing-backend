import { db } from '../config/db.js';
import { ptMembers, ptQuotes, ptQuoteArtworks, ptProducts } from '../db/schema.js';
import { eq, desc, count } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';
import { sendMail } from '../utils/mailer.js';
import { buildQuotePdf } from '../utils/quotePdf.js';

export async function getQuote(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return error(res, 'Invalid quote id', 400);

    const rows = await db
      .select()
      .from(ptQuotes)
      .leftJoin(ptMembers, eq(ptQuotes.memberId, ptMembers.id))
      .where(eq(ptQuotes.id, id));

    if (!rows.length) return error(res, 'Order not found', 404);

    const { pt_quotes: q, pt_members: m } = rows[0];

    const artworkRows = await db
      .select({ fileName: ptQuoteArtworks.fileName, extension: ptQuoteArtworks.extension })
      .from(ptQuoteArtworks)
      .where(eq(ptQuoteArtworks.quoteId, id))
      .limit(1);

    const artwork = artworkRows[0] ?? null;

    return success(res, {
      id:              q.id,
      quantity:        q.quantity,
      kind:            q.kind,
      format:          q.format,
      stock:           q.stock,
      ink:             q.ink,
      finish:          q.finish,
      printingPrice:   q.printingPrice,
      deliveryPrice:   q.deliveryPrice,
      paymentAmount:   q.paymentAmount,
      paymentMethod:   q.paymentMethod,
      paymentStatus:   q.paymentStatus,
      created:         q.created,
      deliveryDetails: q.deliveryDetails ?? null,
      summary:         q.summary         ?? null,
      artworkUrl:      artwork?.fileName ?? null,
      member: m ? {
        firstName:    m.firstName,
        lastName:     m.lastName,
        email:        m.email,
        businessname: m.businessname,
        address:      m.address,
        suburb:       m.suburb,
        state:        m.state,
        postcode:     m.postcode,
        phone:        m.phone,
      } : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function submitQuote(req, res) {
  try {
    const {
      productDbId,
      kind,
      quantity,
      splits,
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

    // 1. Resolve member: use logged-in user if token present, else create guest record
    const now = new Date();
    let memberId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        memberId = decoded.id;
      } catch { /* invalid token — fall through to guest */ }
    }

    if (!memberId) {
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
      memberId = memberResult.insertId;
    } else {
      // Update existing member's delivery details from this order
      await db.update(ptMembers).set({
        businessname: company   || '',
        address:      address   || '',
        suburb:       suburb    || '',
        state:        state     || '',
        postcode:     postcode  || '',
        phone:        phone     || '',
        updatedAt:    now,
      }).where(eq(ptMembers.id, memberId));
    }

    // 2. Create quote record
    const paymentLabel = paymentMethod === 'bank' ? 'Direct Bank Transfer' : 'Credit Card';
    const deliverySnapshot = JSON.stringify({
      firstName: firstName  || '',
      lastName:  lastName   || '',
      email:     email      || '',
      company:   company    || '',
      address:   address    || '',
      suburb:    suburb     || '',
      state:     state      || '',
      postcode:  postcode   || '',
      phone:     phone      || '',
    });
    const [quoteResult] = await db.insert(ptQuotes).values({
      memberId,
      productType:     productDbId ?? null,
      kind:            kind ?? 1,
      quantity:        quantity ?? 0,
      postcode:        postcode || '',
      format:          formatLabel || '',
      stock:           stockLabel || '',
      ink:             printingType || '',
      finish:          extrasLabel || '',
      printingPrice:   printingPrice ?? 0,
      deliveryPrice:   deliveryPrice ?? 0,
      paymentAmount:   paymentAmount ?? 0,
      paymentMethod:   paymentLabel,
      paymentStatus:   'Unpaid',
      artworkStatus:   artworkFileUrl ? 'uploaded' : (artworkMethod === 'upload-later' ? 'pending' : 'no_artwork'),
      status:          'Pending',
      created:         new Date(),
      createdBy:       'Member',
      quoteType:       'design_and_print',
      deliveryType:    'PrintTogether',
      repeatJobDate:   now,
      deliveryDetails: deliverySnapshot,
      summary:         splits?.length ? JSON.stringify({ splits }) : null,
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

export async function getMyOrders(req, res, next) {
  try {
    const memberId = req.user.id;
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(5,  Number(req.query.limit) || 5);
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id:            ptQuotes.id,
        created:       ptQuotes.created,
        status:        ptQuotes.status,
        quantity:      ptQuotes.quantity,
        format:        ptQuotes.format,
        stock:         ptQuotes.stock,
        product:       ptQuotes.product,
        productType:   ptQuotes.productType,
        paymentAmount: ptQuotes.paymentAmount,
        paymentStatus: ptQuotes.paymentStatus,
        productName:   ptProducts.productName,
      })
      .from(ptQuotes)
      .leftJoin(ptProducts, eq(ptQuotes.productType, ptProducts.id))
      .where(eq(ptQuotes.memberId, memberId))
      .orderBy(desc(ptQuotes.id))
      .limit(limit)
      .offset(offset);

    const [countRow] = await db
      .select({ total: count() })
      .from(ptQuotes)
      .where(eq(ptQuotes.memberId, memberId));

    const total = Number(countRow?.total ?? 0);

    return success(res, {
      orders: rows.map(r => ({
        id:            r.id,
        created:       r.created,
        status:        r.status ?? 'Pending',
        quantity:      r.quantity,
        details:       r.productName || r.product || [r.stock, r.format].filter(Boolean).join(' ') || 'Unknown Product',
        productType:   r.productType ?? null,
        paymentAmount: r.paymentAmount,
        paymentStatus: r.paymentStatus,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function attachArtwork(req, res, next) {
  try {
    const quoteId  = Number(req.params.id);
    const memberId = req.user.id;
    const { artworkFileUrl, artworkFileName } = req.body;

    if (!quoteId || !artworkFileUrl || !artworkFileName) {
      return error(res, 'Missing required fields', 400);
    }

    const [quote] = await db
      .select({ id: ptQuotes.id, memberId: ptQuotes.memberId })
      .from(ptQuotes)
      .where(eq(ptQuotes.id, quoteId));

    if (!quote) return error(res, 'Order not found', 404);
    if (Number(quote.memberId) !== Number(memberId)) return error(res, 'Unauthorized', 403);

    const ext = artworkFileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png',
      ai: 'application/postscript',
      psd: 'image/vnd.adobe.photoshop',
    };

    await db.insert(ptQuoteArtworks).values({
      quoteId,
      fileName:        artworkFileUrl,
      mimeType:        mimeMap[ext] ?? 'application/octet-stream',
      extension:       ext,
      selectedArtwork: 1,
      selectedProof:   0,
    });

    await db.update(ptQuotes)
      .set({ artworkStatus: 'uploaded' })
      .where(eq(ptQuotes.id, quoteId));

    return success(res, null, 'Artwork attached successfully');
  } catch (err) {
    next(err);
  }
}

export async function downloadQuotePdf(req, res, next) {
  try {
    const id       = Number(req.params.id);
    const memberId = req.user.id;

    const rows = await db
      .select()
      .from(ptQuotes)
      .leftJoin(ptMembers, eq(ptQuotes.memberId, ptMembers.id))
      .where(eq(ptQuotes.id, id));

    if (!rows.length) return error(res, 'Order not found', 404);

    const { pt_quotes: q, pt_members: m } = rows[0];
    if (Number(q.memberId) !== Number(memberId)) return error(res, 'Unauthorized', 403);

    buildQuotePdf({ ...q, member: m }, res);
  } catch (err) {
    next(err);
  }
}

export async function reQuote(req, res, next) {
  try {
    const quoteId  = Number(req.params.id);
    const memberId = req.user.id;

    const [original] = await db
      .select()
      .from(ptQuotes)
      .where(eq(ptQuotes.id, quoteId));

    if (!original) return error(res, 'Order not found', 404);
    if (Number(original.memberId) !== Number(memberId)) return error(res, 'Unauthorized', 403);

    const now = new Date();
    const [result] = await db.insert(ptQuotes).values({
      memberId:        original.memberId,
      productType:     original.productType,
      kind:            original.kind,
      quantity:        original.quantity,
      postcode:        original.postcode      ?? '',
      format:          original.format        ?? '',
      stock:           original.stock         ?? '',
      ink:             original.ink           ?? '',
      finish:          original.finish        ?? '',
      printingPrice:   original.printingPrice ?? 0,
      deliveryPrice:   original.deliveryPrice ?? 0,
      paymentAmount:   original.paymentAmount ?? 0,
      paymentMethod:   original.paymentMethod ?? '',
      artworkStatus:   original.artworkStatus ?? 'no_artwork',
      deliveryDetails: original.deliveryDetails ?? null,
      status:          'Pending',
      paymentStatus:   'Unpaid',
      created:         now,
      createdBy:       'Member',
      quoteType:       original.quoteType    ?? 'design_and_print',
      deliveryType:    original.deliveryType ?? 'PrintTogether',
      repeatJobDate:   now,
    });
    const newQuoteId = result.insertId;

    // Copy the artwork row if one exists
    const artworkRows = await db
      .select()
      .from(ptQuoteArtworks)
      .where(eq(ptQuoteArtworks.quoteId, quoteId))
      .limit(1);

    if (artworkRows.length) {
      const a = artworkRows[0];
      await db.insert(ptQuoteArtworks).values({
        quoteId:         newQuoteId,
        fileName:        a.fileName,
        mimeType:        a.mimeType,
        extension:       a.extension,
        selectedArtwork: a.selectedArtwork,
        selectedProof:   a.selectedProof,
      });
    }

    return success(res, { quoteId: newQuoteId }, 'Order re-quoted successfully');
  } catch (err) {
    next(err);
  }
}

export async function sendQuoteEmail(req, res, next) {
  try {
    const quoteId  = Number(req.params.id);
    const memberId = req.user.id;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return error(res, 'Subject and message are required', 400);
    }

    const rows = await db
      .select({ memberId: ptQuotes.memberId, deliveryDetails: ptQuotes.deliveryDetails })
      .from(ptQuotes)
      .where(eq(ptQuotes.id, quoteId));

    if (!rows.length) return error(res, 'Order not found', 404);
    if (Number(rows[0].memberId) !== Number(memberId)) return error(res, 'Unauthorized', 403);

    // Prefer the billing email captured at order time over the account email
    let toEmail = null;
    try {
      const d = JSON.parse(rows[0].deliveryDetails ?? '{}');
      toEmail = d.email || null;
    } catch { /* fall through */ }

    if (!toEmail) {
      const memberRows = await db
        .select({ email: ptMembers.email })
        .from(ptMembers)
        .where(eq(ptMembers.id, memberId));
      toEmail = memberRows[0]?.email ?? null;
    }

    if (!toEmail) return error(res, 'No email address on file', 400);

    await sendMail({ to: toEmail, subject, text: message });

    return success(res, null, 'Email sent successfully');
  } catch (err) {
    next(err);
  }
}
