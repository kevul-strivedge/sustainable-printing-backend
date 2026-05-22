import { db } from '../config/db.js';
import {
  ptProductFinishes, ptFinishTypes, ptFinishPrices,
  ptProductPricing, ptProductQuantities, ptQuantities,
  ptPaperTypes, ptFormats, ptInks, ptPortfolio,
} from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { success, error } from '../utils/apiResponse.js';

// GET /api/v1/configurator/:productId/config
// Returns the full initial config when a product is selected:
// paper types, sizes, front/back inks, finishes, quantity kinds
export const getProductConfig = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) return error(res, 'Invalid product ID', 400);

    // Optional ?siblings=17,18 — pull paper/format/pricing data from these product IDs
    // as well, so a single configurator slug can surface options from related DB products
    // (mirrors the old Laravel pt_portfolio.parent_product_id sibling lookup).
    const siblingIds = String(req.query.siblings ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n !== productId);
    const productIds = [productId, ...siblingIds];

    const [finishing, paper_type, paper_size, front, back, quantity, design_options, quantity_options, pricing_table, finish_prices, portfolios] = await Promise.all([

      // Finishes available for these products
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
        .where(inArray(ptProductFinishes.productId, productIds))
        .orderBy(ptFinishTypes.ordering),

      // Distinct paper types (stocks) that have pricing for these products.
      // productId is included so the frontend can map a chosen paper → its portfolio.
      db.selectDistinct({
        stockId: ptProductPricing.stockId,
        paperName: ptPaperTypes.paperName,
        formatId: ptProductPricing.formatId,
        productId: ptProductQuantities.productId,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .innerJoin(ptPaperTypes, eq(ptProductPricing.stockId, ptPaperTypes.id))
        .where(inArray(ptProductQuantities.productId, productIds)),

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
        .where(inArray(ptProductQuantities.productId, productIds)),

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
        .where(inArray(ptProductQuantities.productId, productIds)),

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
        .where(inArray(ptProductQuantities.productId, productIds)),

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
        .where(inArray(ptProductQuantities.productId, productIds))
        .orderBy(ptProductQuantities.kind),

      // Distinct design counts (kind column) for these products
      db.selectDistinct({ kind: ptProductQuantities.kind })
        .from(ptProductQuantities)
        .where(inArray(ptProductQuantities.productId, productIds))
        .orderBy(ptProductQuantities.kind),

      // Distinct quantity-per-design values for these products
      db.selectDistinct({ quantity: ptProductQuantities.quantity })
        .from(ptProductQuantities)
        .where(inArray(ptProductQuantities.productId, productIds))
        .orderBy(ptProductQuantities.quantity),

      // Full pricing table — all (kind, quantity, formatId, stockId, productId, price, estimatedWeight) rows.
      // productId is needed so the frontend can distinguish "product 18 + paper 30" from
      // "product 48 + paper 30" when sibling products share the same paper stock.
      db.select({
        kind:            ptProductQuantities.kind,
        quantity:        ptProductQuantities.quantity,
        formatId:        ptProductPricing.formatId,
        stockId:         ptProductPricing.stockId,
        productId:       ptProductQuantities.productId,
        price:           ptProductPricing.printtogetherPrice,
        estimatedWeight: ptProductPricing.estimatedWeight,
      })
        .from(ptProductPricing)
        .innerJoin(ptProductQuantities, eq(ptProductPricing.productQuantityId, ptProductQuantities.id))
        .where(inArray(ptProductQuantities.productId, productIds))
        .orderBy(ptProductQuantities.kind, ptProductQuantities.quantity),

      // Finish prices — pt_finish_prices.quantity_id references pt_quantities (a global
      // tier table), NOT pt_product_quantities. Joining the wrong table made our query
      // return product-pricing IDs that happened to share numeric IDs for qty 100–500
      // but diverged at qty 750+ (e.g. pt_quantities.id=4 = qty 750 vs
      // pt_product_quantities.id=4 = product 15 / kind=1 / qty 1000). The frontend then
      // picks "highest tier ≤ qty" — matches Laravel ProductController.php:1553-1597.
      db.select({
        finishId: ptFinishPrices.finishId,
        quantity: ptQuantities.quantity,
        price:    ptFinishPrices.price,
        id:       ptFinishPrices.id,
      })
        .from(ptProductFinishes)
        .innerJoin(ptFinishPrices, eq(ptProductFinishes.finishId, ptFinishPrices.finishId))
        .innerJoin(ptQuantities,   eq(ptFinishPrices.quantityId,  ptQuantities.id))
        .where(inArray(ptProductFinishes.productId, productIds))
        .orderBy(ptFinishPrices.id),

      // Portfolio rows — title/description per product variant, used to swap the
      // product description in the UI when the user picks a different paper type.
      db.select({
        productId:    ptPortfolio.productId,
        title:        ptPortfolio.title,
        title2:       ptPortfolio.title2,
        description:  ptPortfolio.description,
        description1: ptPortfolio.description1,
        description2: ptPortfolio.description2,
      })
        .from(ptPortfolio)
        .where(inArray(ptPortfolio.productId, productIds)),
    ]);

    return success(res, { paper_type, paper_size, front, back, finishing, finish_prices, quantity, design_options, quantity_options, pricing_table, portfolios });
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
