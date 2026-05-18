import { db } from '../config/db.js';
import { ptProducts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';

export const getAllProducts = async (req, res, next) => {
  try {
    const rows = await db.select().from(ptProducts).where(eq(ptProducts.published, 1));
    return success(res, rows, 'Products fetched');
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const rows = await db.select().from(ptProducts).where(eq(ptProducts.id, Number(req.params.id)));
    if (!rows.length) return error(res, 'Product not found', 404);
    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
};
