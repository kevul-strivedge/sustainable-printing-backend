import {
  mysqlTable, int, varchar, text, float, tinyint,
  datetime, timestamp, date, mysqlEnum,
} from 'drizzle-orm/mysql-core';

// ─── Members ─────────────────────────────────────────────────────────────────

export const ptMembers = mysqlTable('pt_members', {
  id:                   int('id').autoincrement().primaryKey(),
  createdUserId:        int('created_user_id').default(0),
  assignedUserId:       int('assigned_user_id').default(0),
  affiliateId:          int('affiliate_id').default(0),
  subscribed:           tinyint('subscribed').default(0),
  blacklisted:          tinyint('blacklisted').default(0),
  useDeliveryDetails:   tinyint('use_delivery_details').default(0),
  created:              datetime('created'),
  token:                varchar('token', { length: 128 }),
  businessname:         varchar('businessname', { length: 128 }),
  firstName:            varchar('first_name', { length: 128 }),
  lastName:             varchar('last_name', { length: 128 }),
  address:              varchar('address', { length: 128 }),
  suburb:               varchar('suburb', { length: 128 }),
  state:                varchar('state', { length: 4 }),
  postcode:             varchar('postcode', { length: 8 }),
  email:                varchar('email', { length: 128 }),
  phone:                varchar('phone', { length: 16 }),
  mobile:               varchar('mobile', { length: 16 }),
  paymentTerms:         varchar('payment_terms', { length: 128 }),
  status:               mysqlEnum('status', ['Pending', 'Confirmed', 'Active', 'Suspended']),
  contactMethod:        varchar('contact_method', { length: 16 }),
  contactType:          mysqlEnum('contact_type', ['PrintTogether', 'Subgreen Design', 'sustainableprintingco']).default('PrintTogether'),
  businessTypeId:       int('business_type_id'),
  heardFromId:          int('heard_from_id'),
  notes:                text('notes'),
  useInvoicingData:     tinyint('use_invoicing_data').notNull().default(0),
  invoiceBusinessname:  varchar('invoice_businessname', { length: 128 }).notNull().default(''),
  invoiceFirstName:     varchar('invoice_first_name', { length: 128 }).notNull().default(''),
  invoiceLastName:      varchar('invoice_last_name', { length: 128 }).notNull().default(''),
  invoiceAddress:       varchar('invoice_address', { length: 128 }).notNull().default(''),
  invoiceSuburb:        varchar('invoice_suburb', { length: 128 }).notNull().default(''),
  invoiceState:         varchar('invoice_state', { length: 4 }).notNull().default(''),
  invoicePostcode:      varchar('invoice_postcode', { length: 8 }).notNull().default(''),
  invoiceEmail:         varchar('invoice_email', { length: 128 }).notNull().default(''),
  invoicePhone:         varchar('invoice_phone', { length: 16 }).notNull().default(''),
  invoiceMobile:        varchar('invoice_mobile', { length: 16 }).notNull().default(''),
  password:             varchar('password', { length: 191 }).notNull().default(''),
  passwordToken:        varchar('password_token', { length: 255 }).notNull().default(''),
  rememberToken:        varchar('remember_token', { length: 100 }).notNull().default(''),
  name:                 varchar('name', { length: 200 }).notNull().default(''),
  createdAt:            timestamp('created_at').defaultNow(),
  updatedAt:            timestamp('updated_at'),
});

export const ptMemberAddresses = mysqlTable('pt_member_addresses', {
  id:           int('id').autoincrement().primaryKey(),
  memberId:     int('member_id').notNull().default(0),
  businessname: varchar('businessname', { length: 128 }),
  firstName:    varchar('first_name', { length: 128 }),
  lastName:     varchar('last_name', { length: 128 }),
  address:      varchar('address', { length: 128 }),
  suburb:       varchar('suburb', { length: 128 }),
  state:        varchar('state', { length: 4 }),
  postcode:     varchar('postcode', { length: 8 }),
});

// ─── Products ─────────────────────────────────────────────────────────────────

export const ptProducts = mysqlTable('pt_products', {
  id:                   int('id').autoincrement().primaryKey(),
  productType:          int('product_type').notNull().default(0),
  ordering:             int('ordering').notNull().default(0),
  published:            tinyint('published').notNull().default(0),
  proof:                varchar('proof', { length: 128 }),
  productName:          varchar('product_name', { length: 128 }),
  scheduleOptionType:   mysqlEnum('schedule_option_type', ['Batch', 'Custom']).notNull().default('Batch'),
  scheduleCustomOption: text('schedule_custom_option'),
});

export const ptProductFormats = mysqlTable('pt_product_formats', {
  id:        int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().default(0),
  formatId:  int('format_id').notNull().default(0),
});

export const ptProductInks = mysqlTable('pt_product_inks', {
  id:        int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().default(0),
  inkId:     int('ink_id').notNull().default(0),
});

export const ptProductStocks = mysqlTable('pt_product_stocks', {
  id:        int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().default(0),
  stockId:   int('stock_id').notNull().default(0),
});

export const ptProductFinishes = mysqlTable('pt_product_finishes', {
  id:        int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().default(0),
  finishId:  int('finish_id').notNull().default(0),
});

export const ptProductQuantities = mysqlTable('pt_product_quantities', {
  id:        int('id').autoincrement().primaryKey(),
  productId: int('product_id').notNull().default(0),
  kind:      int('kind').notNull().default(0),
  quantity:  int('quantity').notNull().default(0),
  isUpdate:  tinyint('is_update').notNull().default(0),
});

export const ptProductPricing = mysqlTable('pt_product_pricing', {
  id:                  int('id').autoincrement().primaryKey(),
  formatId:            int('format_id').notNull().default(0),
  stockId:             int('stock_id').notNull().default(0),
  productQuantityId:   int('product_quantity_id').notNull().default(0),
  frontInkId:          int('front_ink_id').notNull().default(0),
  backInkId:           int('back_ink_id').notNull().default(0),
  printerId:           int('printer_id').notNull().default(0),
  published:           tinyint('published').notNull().default(0),
  estimatedWeight:     float('estimated_weight').notNull().default(0),
  printtogetherPrice:  float('printtogether_price').notNull().default(0),
  printerPrice:        float('printer_price').notNull().default(0),
  designBasicPrice:    float('design_basic_price').notNull().default(0),
  designFaceliftPrice: float('design_facelift_price').notNull().default(0),
  designCreativePrice: float('design_creative_price').notNull().default(0),
  printerRef:          varchar('printer_ref', { length: 32 }).notNull().default(''),
  printingType:        mysqlEnum('printing_type', ['digital', 'offset']).notNull().default('digital'),
});

// ─── Lookup / Attribute Tables ────────────────────────────────────────────────

export const ptPaperTypes = mysqlTable('pt_paper_types', {
  id:          int('id').autoincrement().primaryKey(),
  paperName:   varchar('paper_name', { length: 128 }).notNull().default(''),
  description: text('description'),
  weight:      float('weight'),
  ordering:    int('ordering').notNull().default(1),
});

export const ptFormats = mysqlTable('pt_formats', {
  id:                int('id').autoincrement().primaryKey(),
  hasFlatSize:       tinyint('has_flat_size').notNull().default(0),
  hasFinishSize:     tinyint('has_finish_size').notNull().default(0),
  flatHeight:        int('flat_height'),
  flatWidth:         int('flat_width'),
  finishHeight:      int('finish_height'),
  finishWidth:       int('finish_width'),
  ordering:          int('ordering').notNull().default(1),
  formatName:        varchar('format_name', { length: 128 }),
  formatDescription: text('format_description'),
  formatIcon:        varchar('format_icon', { length: 128 }),
});

export const ptInks = mysqlTable('pt_inks', {
  id:      int('id').autoincrement().primaryKey(),
  ordering: int('ordering').notNull().default(1),
  inkName: varchar('ink_name', { length: 128 }).notNull().default(''),
});

export const ptFinishTypes = mysqlTable('pt_finish_types', {
  id:         int('id').autoincrement().primaryKey(),
  ordering:   int('ordering').notNull().default(1),
  finishName: varchar('finish_name', { length: 128 }).notNull().default(''),
  group:      varchar('group', { length: 16 }).notNull().default(''),
  icon:       varchar('icon', { length: 128 }),
});

export const ptFinishPrices = mysqlTable('pt_finish_prices', {
  id:         int('id').autoincrement().primaryKey(),
  quantityId: int('quantity_id').notNull().default(0),
  finishId:   int('finish_id').notNull().default(0),
  price:      float('price').notNull().default(0),
});

// ─── Quotes (ordering system) ─────────────────────────────────────────────────

export const ptQuotes = mysqlTable('pt_quotes', {
  id:                      int('id').autoincrement().primaryKey(),
  invoiced:                tinyint('invoiced'),
  extracted:               tinyint('extracted'),
  memberId:                int('member_id'),
  printerId:               int('printer_id'),
  batchId:                 int('batch_id'),
  createdUserId:           int('created_user_id'),
  assignedUserId:          int('assigned_user_id'),
  offerId:                 int('offer_id'),
  voucherId:               int('voucher_id').notNull().default(0),
  storeId:                 int('store_id').notNull().default(0),
  productType:             int('product_type'),
  postcode:                varchar('postcode', { length: 128 }),
  kind:                    int('kind'),
  quantity:                int('quantity'),
  costPrice:               float('cost_price').notNull().default(0),
  printingPrice:           float('printing_price'),
  designPrice:             float('design_price'),
  deliveryPrice:           float('delivery_price'),
  printerPrice:            float('printer_price').notNull().default(0),
  discountAmount:          float('discount_amount').notNull().default(0),
  paymentAmount:           float('payment_amount'),
  paymentCharges:          float('payment_charges').notNull().default(0),
  weight:                  float('weight'),
  artworkDate:             date('artwork_date'),
  deliveryDate:            date('delivery_date'),
  invoicedDate:            date('invoiced_date'),
  extractedDate:           date('extracted_date'),
  paymentDate:             date('payment_date'),
  dispatchDate:            date('dispatch_date'),
  created:                 datetime('created'),
  status:                  varchar('status', { length: 128 }).default('Pending'),
  product:                 text('product'),
  graphicDesignOption:     varchar('graphic_design_option', { length: 32 }).default('none'),
  format:                  text('format'),
  stock:                   text('stock'),
  finish:                  text('finish'),
  proof:                   text('proof'),
  ink:                     text('ink'),
  createdBy:               mysqlEnum('created_by', ['Member', 'Printer', 'Admin']).default('Admin'),
  scheduleOptionType:      mysqlEnum('schedule_option_type', ['Batch', 'Custom']).default('Batch'),
  scheduleCustomOption:    text('schedule_custom_option'),
  paymentStatus:           mysqlEnum('payment_status', ['Paid', 'Unpaid', 'Pending', 'Refunded']).default('Unpaid'),
  paymentReference:        varchar('payment_reference', { length: 32 }),
  paymentMethod:           varchar('payment_method', { length: 64 }),
  deliveryType:            mysqlEnum('delivery_type', ['PrintTogether', 'Client', 'Other', '']).default(''),
  deliveryMethod:          text('delivery_method'),
  deliveryReference:       text('delivery_reference'),
  printerRef:              varchar('printer_ref', { length: 32 }),
  artworkStatus:           varchar('artwork_status', { length: 128 }).notNull().default('no_artwork'),
  quoteType:               varchar('quote_type', { length: 128 }).notNull().default('design_and_print'),
  designJobName:           text('design_job_name'),
  ptDescription:           text('pt_description'),
  notes:                   text('notes'),
  summary:                 text('summary'),
  comments:                text('comments'),
  overview:                text('overview'),
  deliveryNumberOfBoxes:   varchar('delivery_number_of_boxes', { length: 256 }),
  deliveryQuantityPerBox:  varchar('delivery_quantity_per_box', { length: 256 }),
  deliverySpecialNotes:    text('delivery_special_notes'),
  deliveryDetails:         text('delivery_details'),
  deliveryInstructions:    text('delivery_instructions'),
  purchaseOrderNumber:     varchar('purchase_order_number', { length: 128 }),
  flatSheetsQuantity:      varchar('flat_sheets_quantity', { length: 128 }),
  flatSheetSize:           varchar('flat_sheet_size', { length: 128 }),
  printSheetSize:          varchar('print_sheet_size', { length: 128 }),
  repeatJobReference:      varchar('repeat_job_reference', { length: 128 }),
  repeatJob:               tinyint('repeat_job').notNull().default(0),
  repeatJobDate:           date('repeat_job_date'),
  printingType:            varchar('printing_type', { length: 32 }).notNull().default(''),
  paymentErrorMsg:         text('payment_error_msg'),
  paymentErrorBody:        text('payment_error_body'),
});

// ─── Delivery ─────────────────────────────────────────────────────────────────

export const ptDeliveryMethods = mysqlTable('pt_delivery_methods', {
  id:         int('id').autoincrement().primaryKey(),
  methodName: varchar('method_name', { length: 128 }),
});

export const ptDeliveryZones = mysqlTable('pt_delivery_zones', {
  id:       int('id').autoincrement().primaryKey(),
  zoneCode: varchar('zone_code', { length: 5 }).notNull().default(''),
  zoneName: varchar('zone_name', { length: 128 }),
});

export const ptDeliveryPrices = mysqlTable('pt_delivery_prices', {
  id:       int('id').autoincrement().primaryKey(),
  zoneId:   int('zone_id').notNull().default(0),
  weightId: int('weight_id').notNull().default(0),
  price:    float('price').notNull().default(0),
});

// ─── Quote Artworks ───────────────────────────────────────────────────────────

export const ptQuoteArtworks = mysqlTable('pt_quote_artworks', {
  id:              int('id').autoincrement().primaryKey(),
  quoteId:         int('quote_id').notNull().default(0),
  fileName:        text('file_name'),
  mimeType:        text('mime_type'),
  extension:       varchar('extension', { length: 32 }).notNull().default(''),
  selectedArtwork: tinyint('selected_artwork').notNull().default(0),
  selectedProof:   tinyint('selected_proof').notNull().default(0),
});
