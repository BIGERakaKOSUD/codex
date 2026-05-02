-- Initial PostgreSQL schema for the Ozon Unit Economics backend.

CREATE TABLE "ozon_products" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT,
    "sku" TEXT,
    "offer_id" TEXT,
    "barcode" TEXT,
    "name" TEXT,
    "category_id" TEXT,
    "category_name" TEXT,
    "raw_api_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ozon_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_manual_inputs" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT,
    "offer_id" TEXT,
    "barcode" TEXT,
    "cost_price" DOUBLE PRECISION,
    "inbound_logistics_to_warehouse" DOUBLE PRECISION,
    "base_commission_percent" DOUBLE PRECISION,
    "product_volume_liters" DOUBLE PRECISION,
    "free_acceptance" BOOLEAN,
    "buyout_percent" DOUBLE PRECISION,
    "non_buyout_percent" DOUBLE PRECISION,
    "return_percent" DOUBLE PRECISION,
    "cancel_percent" DOUBLE PRECISION,
    "delivery_to_pickup_point_cost" DOUBLE PRECISION,
    "express_cost" DOUBLE PRECISION,
    "self_purchase_cost" DOUBLE PRECISION,
    "review_points_cost" DOUBLE PRECISION,
    "paid_storage_cost" DOUBLE PRECISION,
    "other_expenses" DOUBLE PRECISION,
    "confirmed_other_expenses" DOUBLE PRECISION,
    "total_drr_percent" DOUBLE PRECISION,
    "retail_price_without_promo" DOUBLE PRECISION,
    "promo_name" TEXT,
    "promo_discount_percent" DOUBLE PRECISION,
    "coinvest_acquiring_percent" DOUBLE PRECISION,
    "tax_usn_income_percent" DOUBLE PRECISION,
    "tax_usn_income_minus_expenses_percent" DOUBLE PRECISION,
    "vat_percent" DOUBLE PRECISION,
    "manufacturer_logistics_lead_weeks" DOUBLE PRECISION,
    "batch_qty" DOUBLE PRECISION,
    "sold_qty_month" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_manual_inputs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ozon_finance_transactions" (
    "id" SERIAL NOT NULL,
    "operation_id" TEXT NOT NULL,
    "operation_type" TEXT,
    "operation_date" TIMESTAMP(3) NOT NULL,
    "posting_number" TEXT,
    "sku" TEXT,
    "offer_id" TEXT,
    "product_id" TEXT,
    "service_name" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "raw_api_json" JSONB,

    CONSTRAINT "ozon_finance_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ozon_postings" (
    "id" SERIAL NOT NULL,
    "posting_number" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "status" TEXT,
    "created_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "sku" TEXT,
    "offer_id" TEXT,
    "quantity" INTEGER,
    "price" DOUBLE PRECISION,
    "raw_api_json" JSONB,

    CONSTRAINT "ozon_postings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tariff_versions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "source_url" TEXT,
    "raw_json" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tariff_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tariff_rules" (
    "id" SERIAL NOT NULL,
    "tariff_version_id" INTEGER NOT NULL,
    "category_id" TEXT,
    "category_name" TEXT,
    "commission_percent" DOUBLE PRECISION,
    "min_volume_liters" DOUBLE PRECISION,
    "max_volume_liters" DOUBLE PRECISION,
    "direct_logistics_cost" DOUBLE PRECISION,
    "reverse_logistics_cost" DOUBLE PRECISION,
    "acceptance_cost" DOUBLE PRECISION,
    "storage_cost_per_day" DOUBLE PRECISION,
    "pickup_delivery_cost" DOUBLE PRECISION,
    "nonlocal_markup_rule" JSONB,
    "raw_json" JSONB,

    CONSTRAINT "tariff_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calculation_snapshots" (
    "id" SERIAL NOT NULL,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "product_id" TEXT,
    "offer_id" TEXT,
    "input_json" JSONB NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ozon_products_product_id_key" ON "ozon_products"("product_id");
CREATE UNIQUE INDEX "ozon_products_offer_id_key" ON "ozon_products"("offer_id");
CREATE INDEX "ozon_products_offer_id_idx" ON "ozon_products"("offer_id");
CREATE INDEX "ozon_products_barcode_idx" ON "ozon_products"("barcode");
CREATE INDEX "ozon_products_sku_idx" ON "ozon_products"("sku");

CREATE UNIQUE INDEX "product_manual_inputs_offer_id_key" ON "product_manual_inputs"("offer_id");
CREATE UNIQUE INDEX "product_manual_inputs_barcode_key" ON "product_manual_inputs"("barcode");
CREATE INDEX "product_manual_inputs_offer_id_idx" ON "product_manual_inputs"("offer_id");

CREATE UNIQUE INDEX "ozon_finance_transactions_operation_id_service_name_offer_id_sku_key" ON "ozon_finance_transactions"("operation_id", "service_name", "offer_id", "sku");
CREATE INDEX "ozon_finance_transactions_operation_date_idx" ON "ozon_finance_transactions"("operation_date");
CREATE INDEX "ozon_finance_transactions_offer_id_idx" ON "ozon_finance_transactions"("offer_id");
CREATE INDEX "ozon_finance_transactions_posting_number_idx" ON "ozon_finance_transactions"("posting_number");

CREATE UNIQUE INDEX "ozon_postings_posting_number_scheme_offer_id_sku_key" ON "ozon_postings"("posting_number", "scheme", "offer_id", "sku");
CREATE INDEX "ozon_postings_created_at_idx" ON "ozon_postings"("created_at");
CREATE INDEX "ozon_postings_offer_id_idx" ON "ozon_postings"("offer_id");

CREATE INDEX "tariff_versions_active_idx" ON "tariff_versions"("active");
CREATE INDEX "tariff_rules_tariff_version_id_idx" ON "tariff_rules"("tariff_version_id");
CREATE INDEX "tariff_rules_category_id_idx" ON "tariff_rules"("category_id");

CREATE INDEX "calculation_snapshots_period_from_period_to_idx" ON "calculation_snapshots"("period_from", "period_to");
CREATE INDEX "calculation_snapshots_offer_id_idx" ON "calculation_snapshots"("offer_id");

CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

ALTER TABLE "tariff_rules" ADD CONSTRAINT "tariff_rules_tariff_version_id_fkey"
FOREIGN KEY ("tariff_version_id") REFERENCES "tariff_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
