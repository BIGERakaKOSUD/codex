import test from "node:test";
import assert from "node:assert/strict";

import { calculateOzonUnitEconomics } from "../../src/lib/unitEconomics/calculateOzonUnitEconomics.ts";

const product = {
  barcode: "4600000000001",
  offer_id: "OFFER-1",
  sku: "1001",
  product_id: "2001",
  product_name: "Test product",
  category_name: "Category",
  category_id: "10",
  api: {
    current_price: null,
    old_price: null,
    marketing_price: null,
    min_price: null,
    vat_percent: null,
    width_mm: 100,
    height_mm: 100,
    depth_mm: 100,
    weight_g: 250,
    volume_liters: null,
    stock_total: 0,
    stock_reserved: 0,
  },
};

const baseManual = {
  cost_price: 500,
  inbound_logistics_to_warehouse: 50,
  base_commission_percent: 10,
  product_volume_liters: 1,
  free_acceptance: false,
  buyout_percent: 100,
  non_buyout_percent: 0,
  return_percent: 0,
  cancel_percent: 0,
  delivery_to_pickup_point_cost: 25,
  express_cost: 0,
  self_purchase_cost: 0,
  review_points_cost: 0,
  paid_storage_cost: 0,
  other_expenses: 0,
  confirmed_other_expenses: 0,
  total_drr_percent: 10,
  retail_price_without_promo: 1000,
  promo_name: null,
  promo_discount_percent: 0,
  coinvest_acquiring_percent: 2,
  tax_usn_income_percent: 6,
  tax_usn_income_minus_expenses_percent: 15,
  vat_percent: 0,
  manufacturer_logistics_lead_weeks: 2,
  batch_qty: 100,
  sold_qty_month: 50,
};

const tariff = {
  base_commission_percent: null,
  direct_logistics_cost: 80,
  reverse_logistics_cost: 60,
  acceptance_cost: 15,
  storage_cost_per_day: 0,
  pickup_delivery_cost: 25,
  nonlocal_markup: 10,
};

const settings = {
  use_actual_finance_data: false,
  tax_mode: "no_tax",
  vat_mode: "no_vat",
  calculation_basis: "per_buyout",
  include_express_in_logistics: true,
  include_storage_in_marketplace_expenses: true,
  include_reviews_in_total_expenses: true,
  include_self_purchase_in_total_expenses: true,
};

function calculate(overrides = {}, settingsOverrides = {}, actualFinance = null, productOverrides = {}) {
  return calculateOzonUnitEconomics({
    product: {
      ...product,
      ...productOverrides,
      api: { ...product.api, ...(productOverrides.api ?? {}) },
    },
    manualInputs: { ...baseManual, ...overrides },
    tariffRule: tariff,
    actualFinance,
    settings: { ...settings, ...settingsOverrides },
  });
}

test("calculates a product with 100% buyout", () => {
  const result = calculate();

  assert.equal(result.errors.length, 0);
  assert.equal(result.values.retail_price_rub, 1000);
  assert.equal(result.values.commission_rub, 100);
  assert.equal(result.values.acquiring_rub, 20);
  assert.equal(result.values.ad_cost_per_buyout_rub, 100);
  assert.equal(result.values.total_logistics_rub, 180);
  assert.equal(result.values.total_expenses_rub, 950);
  assert.equal(result.values.net_profit_per_unit_rub, 50);
});

test("calculates a product with 70% buyout and returns", () => {
  const result = calculate({
    buyout_percent: 70,
    non_buyout_percent: 20,
    return_percent: 10,
  });

  assert.equal(result.errors.length, 0);
  assert.equal(Math.round(result.values.ad_cost_per_buyout_rub * 100) / 100, 142.86);
  assert.equal(Math.round(result.values.forecast_reverse_logistics_rub * 100) / 100, 25.71);
  assert.equal(Math.round(result.values.total_logistics_rub * 100) / 100, 255);
  assert.equal(Math.round(result.values.net_profit_per_unit_rub * 100) / 100, -67.86);
});

test("marks a product with negative profit", () => {
  const result = calculate({ cost_price: 900 });

  assert.ok(result.values.net_profit_per_unit_rub < 0);
  assert.ok(result.warnings.includes("negative_profit"));
});

test("does not invent missing cost price", () => {
  const result = calculate({ cost_price: null });

  assert.equal(result.values.cost_price, null);
  assert.equal(result.sourceMap.cost_price, "missing");
  assert.ok(result.errors.includes("missing_cost_price"));
});

test("warns when volume is missing and keeps calculated volume for checks", () => {
  const result = calculate({ product_volume_liters: null });

  assert.equal(result.values.product_volume_liters, 1);
  assert.equal(result.values.calculated_volume_liters, 1);
  assert.equal(result.sourceMap.product_volume_liters, "formula");
});

test("marks volume as missing when API dimensions and manual volume are absent", () => {
  const result = calculate(
    { product_volume_liters: null },
    {},
    null,
    { api: { width_mm: null, height_mm: null, depth_mm: null, volume_liters: null } },
  );

  assert.equal(result.values.product_volume_liters, null);
  assert.equal(result.sourceMap.product_volume_liters, "missing");
  assert.ok(result.warnings.includes("missing_volume"));
});

test("returns a row error when buyout percent is zero", () => {
  const result = calculate({ buyout_percent: 0 });

  assert.ok(result.errors.includes("buyout_rate_must_be_positive"));
  assert.equal(result.values.ad_cost_per_buyout_rub, null);
  assert.equal(result.values.total_logistics_rub, null);
});

test("applies promo discount to seller retail price", () => {
  const result = calculate({ promo_discount_percent: 15, promo_name: "Promo" });

  assert.equal(result.values.retail_price_rub, 850);
  assert.equal(result.values.commission_rub, 85);
  assert.equal(result.sourceMap.retail_price_rub, "formula");
});

test("calculates USN income tax", () => {
  const result = calculate({}, { tax_mode: "usn_income" });

  assert.equal(result.values.tax_usn_income_rub, 60);
  assert.equal(result.values.total_tax_rub, 60);
  assert.equal(result.values.net_profit_per_unit_rub, -10);
});

test("calculates USN income minus expenses tax", () => {
  const result = calculate({ confirmed_other_expenses: 0 }, { tax_mode: "usn_income_minus_expenses" });

  assert.equal(result.values.taxable_profit_for_15_percent_rub, 150);
  assert.equal(result.values.tax_usn_income_minus_expenses_rub, 22.5);
  assert.equal(result.values.total_tax_rub, 22.5);
});

test("adds included VAT only when VAT mode is enabled", () => {
  const result = calculate({ vat_percent: 20 }, { tax_mode: "usn_income", vat_mode: "vat_included" });

  assert.equal(Math.round(result.values.vat_rub * 100) / 100, 166.67);
  assert.equal(Math.round(result.values.total_tax_rub * 100) / 100, 226.67);
});

test("calculates annual ROI when batch and monthly sold quantity are present", () => {
  const result = calculate();

  assert.equal(Math.round(result.values.roi_ratio * 10000) / 10000, 0.0909);
  assert.equal(Math.round(result.values.annual_roi_percent * 100) / 100, 44.22);
});

test("does not double count express or optional expenses when included elsewhere", () => {
  const result = calculate(
    {
      express_cost: 40,
      self_purchase_cost: 30,
      review_points_cost: 20,
      paid_storage_cost: 10,
    },
    {
      include_express_in_logistics: true,
      include_reviews_in_total_expenses: false,
      include_self_purchase_in_total_expenses: false,
    },
  );

  assert.equal(result.values.forecast_direct_logistics_rub, 155);
  assert.equal(result.values.total_logistics_rub, 230);
  assert.equal(result.values.total_expenses_rub, 1000);
});
