import { db } from '../config/db.js';
import { ptQuotes } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';

export const createOrder = async (req, res, next) => {
  try {
    // Full implementation deferred — pt_quotes has 72 columns; will be built
    // once the quote creation flow is designed.
    return success(res, {}, 'Quote created', 201);
  } catch (err) {
    next(err);
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const rows = await db.select().from(ptQuotes).where(eq(ptQuotes.memberId, req.user.id));
    return success(res, rows, 'Quotes fetched');
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(ptQuotes)
      .where(and(eq(ptQuotes.id, Number(req.params.id)), eq(ptQuotes.memberId, req.user.id)));

    if (!rows.length) return error(res, 'Quote not found', 404);
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
};
