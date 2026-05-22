import { db } from '../config/db.js';
import {
  ptProductFinishes, ptFinishTypes, ptFinishPrices,
  ptProductPricing, ptProductQuantities,
  ptPaperTypes, ptFormats, ptInks,
} from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';

// GET /api/v1/configurator/:productId/config
// Returns the full initial config when a product is selected:
// paper types, sizes, front/back inks, finishes, quantity kinds
export const getProductConfig = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) return error(res, 'Invalid product ID', 400);

    const [finishing, paper_type, paper_size, front, back, quantity, design_options, quantity_options, pricing_table, finish_prices] = await Promise.all([

      // Finishes available for this product
      db.select({
        id: ptProductFinishes.id,
        productId: ptProductFinishes.productId,
        finishId: ptProductFinishes.finishId,
        ordering: ptFinishTypes.ordering,
        finishName: ptFinishTypes.finishName,
        group: ptFinishTypes.group,
        icon: ptFinishTypes.icon,
      })
        .from(ptProductFinishes)
        .innerJoin(ptFinishTypes, eq(ptProductFinishes.finishId, ptFinishTypes.id))
        .where(eq(ptProductFinishes.productId, productId))
        .orderBy(ptFinishTypes.ordering),

      // Distinct paper types (stocks) that have pricing for this product
      db.selectDistinct({
        stockId: ptProductPricing.stockId,
        paperName: ptPaperTypes.paperName,
        formatId: ptProductPricing.formatId,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .innerJoin(ptPaperTypes, eq(ptProductPricing.stockId, ptPaperTypes.id))
        .where(eq(ptProductQuantities.productId, productId)),

      // Distinct sizes (formats) with their associated stock and ink context
      db.selectDistinct({
        kind: ptProductQuantities.kind,
        formatId: ptProductPricing.formatId,
        formatName: ptFormats.formatName,
        stockId: ptProductPricing.stockId,
        frontInkId: ptProductPricing.frontInkId,
        backInkId: ptProductPricing.backInkId,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .innerJoin(ptFormats, eq(ptProductPricing.formatId, ptFormats.id))
        .where(eq(ptProductQuantities.productId, productId)),

      // Distinct front inks
      db.selectDistinct({
        frontInkId: ptProductPricing.frontInkId,
        inkName: ptInks.inkName,
        formatId: ptProductPricing.formatId,
        stockId: ptProductPricing.stockId,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .innerJoin(ptInks, eq(ptProductPricing.frontInkId, ptInks.id))
        .where(eq(ptProductQuantities.productId, productId)),

      // Distinct back inks
      db.selectDistinct({
        backInkId: ptProductPricing.backInkId,
        inkName: ptInks.inkName,
        formatId: ptProductPricing.formatId,
        stockId: ptProductPricing.stockId,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .innerJoin(ptInks, eq(ptProductPricing.backInkId, ptInks.id))
        .where(eq(ptProductQuantities.productId, productId)),

      // Distinct quantity kinds (1 row per kind, showing the associated options)
      db.selectDistinct({
        kind: ptProductQuantities.kind,
        formatId: ptProductPricing.formatId,
        stockId: ptProductPricing.stockId,
        frontInkId: ptProductPricing.frontInkId,
        backInkId: ptProductPricing.backInkId,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .where(eq(ptProductQuantities.productId, productId))
        .orderBy(ptProductQuantities.kind),

      // Distinct design counts (kind column) for this product
      db.selectDistinct({ kind: ptProductQuantities.kind })
        .from(ptProductQuantities)
        .where(eq(ptProductQuantities.productId, productId))
        .orderBy(ptProductQuantities.kind),

      // Distinct quantity-per-design values for this product
      db.selectDistinct({ quantity: ptProductQuantities.quantity })
        .from(ptProductQuantities)
        .where(eq(ptProductQuantities.productId, productId))
        .orderBy(ptProductQuantities.quantity),

      // Full pricing table — all (kind, quantity, formatId, stockId, price, estimatedWeight) rows
      db.select({
        kind:            ptProductQuantities.kind,
        quantity:        ptProductQuantities.quantity,
        formatId:        ptProductPricing.formatId,
        stockId:         ptProductPricing.stockId,
        price:           ptProductPricing.printtogetherPrice,
        estimatedWeight: ptProductPricing.estimatedWeight,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .where(eq(ptProductQuantities.productId, productId))
        .orderBy(ptProductQuantities.kind, ptProductQuantities.quantity),

      // Finish prices keyed by (finishId, quantity) for this product's quantities
      db.selectDistinct({
        finishId: ptFinishPrices.finishId,
        quantity: ptProductQuantities.quantity,
        price:    ptFinishPrices.price,
      })
        .from(ptProductFinishes)
        .innerJoin(ptFinishPrices,       eq(ptProductFinishes.finishId,   ptFinishPrices.finishId))
        .innerJoin(ptProductQuantities,  eq(ptFinishPrices.quantityId,    ptProductQuantities.id))
        .where(and(
          eq(ptProductFinishes.productId,    productId),
          eq(ptProductQuantities.productId,  productId),
        )),
    ]);

    return success(res, { paper_type, paper_size, front, back, finishing, finish_prices, quantity, design_options, quantity_options, pricing_table });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/configurator/:productId/quantities
// Query params: format_id, stock_id, front_ink_id, back_ink_id
// Called when the user changes finishing type — re-fetches available quantity kinds
export const getProductQuantities = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) return error(res, 'Invalid product ID', 400);

    const { format_id, stock_id, front_ink_id, back_ink_id } = req.query;

    const rows = await db.selectDistinct({
      kind: ptProductQuantities.kind,
      formatId: ptProductPricing.formatId,
      stockId: ptProductPricing.stockId,
      frontInkId: ptProductPricing.frontInkId,
      backInkId: ptProductPricing.backInkId,
    })
      .from(ptProductPricing)
      .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
      .where(and(
        eq(ptProductQuantities.productId, productId),
        format_id   ? eq(ptProductPricing.formatId,   Number(format_id))   : undefined,
        stock_id    ? eq(ptProductPricing.stockId,    Number(stock_id))    : undefined,
        front_ink_id ? eq(ptProductPricing.frontInkId, Number(front_ink_id)) : undefined,
        back_ink_id  ? eq(ptProductPricing.backInkId,  Number(back_ink_id))  : undefined,
      ))
      .orderBy(ptProductQuantities.kind);

    return success(res, rows, 'Quantities fetched');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/configurator/:productId/price
// Query params: format_id, stock_id, front_ink_id, back_ink_id, kind, postcode
// Returns all quantity rows for the selected kind/format/stock/ink combination
// finis_price and weight_price are placeholders until pt_finish_prices and
// pt_delivery_postcodes_ranges are integrated
export const getProductPrice = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) return error(res, 'Invalid product ID', 400);

    const { format_id, stock_id, front_ink_id, back_ink_id, kind } = req.query;

    const rows = await db.select({
      id: ptProductPricing.id,
      productId: ptProductQuantities.productId,
      kind: ptProductQuantities.kind,
      quantity: ptProductQuantities.quantity,
      isUpdate: ptProductQuantities.isUpdate,
      formatId: ptProductPricing.formatId,
      stockId: ptProductPricing.stockId,
      frontInkId: ptProductPricing.frontInkId,
      backInkId: ptProductPricing.backInkId,
      printerId: ptProductPricing.printerId,
      published: ptProductPricing.published,
      estimatedWeight: ptProductPricing.estimatedWeight,
      printtogetherPrice: ptProductPricing.printtogetherPrice,
      printerPrice: ptProductPricing.printerPrice,
      designBasicPrice: ptProductPricing.designBasicPrice,
      designFaceliftPrice: ptProductPricing.designFaceliftPrice,
      designCreativePrice: ptProductPricing.designCreativePrice,
      printerRef: ptProductPricing.printerRef,
      printingType: ptProductPricing.printingType,
      productQuantityId: ptProductPricing.productQuantityId,
    })
      .from(ptProductPricing)
      .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
      .where(and(
        eq(ptProductQuantities.productId, productId),
        kind         ? eq(ptProductQuantities.kind,    Number(kind))        : undefined,
        format_id    ? eq(ptProductPricing.formatId,   Number(format_id))   : undefined,
        stock_id     ? eq(ptProductPricing.stockId,    Number(stock_id))    : undefined,
        front_ink_id ? eq(ptProductPricing.frontInkId, Number(front_ink_id)) : undefined,
        back_ink_id  ? eq(ptProductPricing.backInkId,  Number(back_ink_id))  : undefined,
      ))
      .orderBy(ptProductQuantities.quantity);

    const enriched = rows.map((row) => ({
      ...row,
      finis_price: 0,  // TODO: integrate pt_finish_prices
      weight_price: 0, // TODO: integrate pt_delivery_postcodes_ranges + pt_delivery_weights
    }));

    return success(res, enriched, 'Pricing fetched');
  } catch (err) {
    next(err);
  }
};
