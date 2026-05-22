import { db } from '../config/db.js';
import {
  ptDeliveryPostcodesRanges,
  ptDeliveryWeights,
  ptDeliveryPrices,
} from '../db/schema.js';
import { and, lte, gte, eq } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';

// GET /api/v1/delivery/price?postcode=2000&weight=0.5
export async function getDeliveryPrice(req, res, next) {
  try {
    const pc = Number(req.query.postcode);
    const wt = Number(req.query.weight);

    if (!pc || isNaN(pc)) return error(res, 'postcode is required', 400);
    if (isNaN(wt)) return error(res, 'weight is required', 400);

    // 1. Find zone from postcode range — fall back to zone 1 (NSW metro) if no range matches,
    // matching the old Laravel behaviour where any 4-digit postcode resolves to a price
    // rather than an error.
    const [rangeRow] = await db
      .select({ zoneId: ptDeliveryPostcodesRanges.zoneId })
      .from(ptDeliveryPostcodesRanges)
      .where(
        and(
          lte(ptDeliveryPostcodesRanges.rangeBegining, pc),
          gte(ptDeliveryPostcodesRanges.rangeFinish, pc)
        )
      )
      .limit(1);

    const zoneId = rangeRow?.zoneId ?? 1;

    // 2. Find weight bracket
    const [weightRow] = await db
      .select({ id: ptDeliveryWeights.id })
      .from(ptDeliveryWeights)
      .where(
        and(
          lte(ptDeliveryWeights.minWeight, wt),
          gte(ptDeliveryWeights.maxWeight, wt)
        )
      )
      .limit(1);

    // Fall back to the highest bracket if weight exceeds max
    const weightId = weightRow
      ? weightRow.id
      : (await db.select({ id: ptDeliveryWeights.id }).from(ptDeliveryWeights).orderBy(ptDeliveryWeights.maxWeight).limit(1))[0]?.id;

    if (!weightId) return error(res, 'Weight out of range', 404);

    // 3. Look up price for zone + weight bracket
    const [priceRow] = await db
      .select({ price: ptDeliveryPrices.price })
      .from(ptDeliveryPrices)
      .where(
        and(
          eq(ptDeliveryPrices.zoneId, Number(zoneId)),
          eq(ptDeliveryPrices.weightId, weightId)
        )
      )
      .limit(1);

    return success(res, { deliveryPrice: priceRow?.price ?? 0 });
  } catch (err) {
    next(err);
  }
}
