export type FieldSource = "api" | "manual" | "imported" | "formula" | "missing";

export type TaxMode = "usn_income" | "usn_income_minus_expenses" | "vat_included" | "no_tax";
export type VatMode = "no_vat" | "vat_included";
export type CalculationBasis = "per_buyout" | "per_order";

export interface NormalizedOzonProductApiData {
  current_price: number | null;
  old_price: number | null;
  marketing_price: number | null;
  min_price: number | null;
  price_index?: string | null;
  vat_percent: number | null;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_g: number | null;
  volume_liters: number | null;
  stock_total: number | null;
  stock_reserved: number | null;
}

export interface NormalizedOzonProduct {
  barcode: string | null;
  offer_id: string | null;
  sku: string | null;
  product_id: string | null;
  product_name: string | null;
  category_name: string | null;
  category_id: string | null;
  api: NormalizedOzonProductApiData;
}

export interface ProductManualInputs {
  cost_price: number | null;
  inbound_logistics_to_warehouse: number | null;
  base_commission_percent: number | null;
  product_volume_liters: number | null;
  free_acceptance: boolean | null;
  buyout_percent: number | null;
  non_buyout_percent: number | null;
  return_percent: number | null;
  cancel_percent: number | null;
  delivery_to_pickup_point_cost: number | null;
  express_cost: number | null;
  self_purchase_cost: number | null;
  review_points_cost: number | null;
  paid_storage_cost: number | null;
  other_expenses: number | null;
  confirmed_other_expenses: number | null;
  total_drr_percent: number | null;
  retail_price_without_promo: number | null;
  promo_name: string | null;
  promo_discount_percent: number | null;
  coinvest_acquiring_percent: number | null;
  tax_usn_income_percent: number | null;
  tax_usn_income_minus_expenses_percent: number | null;
  vat_percent: number | null;
  manufacturer_logistics_lead_weeks: number | null;
  batch_qty: number | null;
  sold_qty_month: number | null;
  source?: "manual" | "imported";
}

export interface TariffRuleInput {
  base_commission_percent?: number | null;
  commission_percent?: number | null;
  direct_logistics_cost: number | null;
  reverse_logistics_cost: number | null;
  acceptance_cost: number | null;
  storage_cost_per_day?: number | null;
  pickup_delivery_cost: number | null;
  nonlocal_markup?: number | null;
}

export interface ActualFinanceAggregates {
  commission_fact_avg_rub?: number | null;
  logistics_per_order_avg_rub?: number | null;
  logistics_per_buyout_avg_rub?: number | null;
  acquiring_avg_rub?: number | null;
  advertising_avg_rub?: number | null;
  storage_avg_rub?: number | null;
  confirmed_ad_expenses?: number | null;
}

export interface CalculationSettings {
  use_actual_finance_data: boolean;
  tax_mode: TaxMode;
  vat_mode: VatMode;
  calculation_basis: CalculationBasis;
  include_express_in_logistics: boolean;
  include_storage_in_marketplace_expenses: boolean;
  include_reviews_in_total_expenses: boolean;
  include_self_purchase_in_total_expenses: boolean;
}

export interface CalculationInput {
  product: NormalizedOzonProduct;
  manualInputs: ProductManualInputs;
  tariffRule: TariffRuleInput | null;
  actualFinance: ActualFinanceAggregates | null;
  settings: CalculationSettings;
}

export interface CalculationValues {
  barcode: string | null;
  offer_id: string | null;
  sku: string | null;
  product_id: string | null;
  product_name: string | null;
  category_name: string | null;
  category_id: string | null;
  cost_price: number | null;
  inbound_logistics_to_warehouse: number;
  base_commission_percent: number | null;
  product_volume_liters: number | null;
  calculated_volume_liters: number | null;
  free_acceptance: boolean;
  buyout_percent: number | null;
  non_buyout_percent: number;
  return_percent: number;
  cancel_percent: number;
  delivery_to_pickup_point_cost: number;
  express_cost: number;
  self_purchase_cost: number;
  review_points_cost: number;
  paid_storage_cost: number;
  other_expenses: number;
  confirmed_other_expenses: number;
  total_drr_percent: number;
  retail_price_without_promo: number | null;
  promo_name: string | null;
  promo_discount_percent: number;
  coinvest_acquiring_percent: number;
  tax_usn_income_percent: number;
  tax_usn_income_minus_expenses_percent: number;
  vat_percent: number;
  manufacturer_logistics_lead_weeks: number | null;
  batch_qty: number | null;
  sold_qty_month: number | null;
  commission_rub: number | null;
  commission_fact_avg_rub: number | null;
  commission_formula_rub: number | null;
  calculated_marker: string;
  acquiring_rub: number | null;
  ozon_direct_base_logistics_rub: number;
  nonlocal_logistics_markup_rub: number;
  forecast_direct_logistics_rub: number | null;
  forecast_reverse_logistics_rub: number | null;
  acceptance_cost_rub: number;
  pickup_delivery_service_rub: number;
  total_logistics_rub: number | null;
  ad_cost_per_order_rub: number | null;
  ad_cost_per_buyout_rub: number | null;
  tacos_percent: number;
  total_expenses_rub: number | null;
  confirmed_total_expenses_rub: number | null;
  marketplace_expense_share_percent: number | null;
  retail_price_rub: number | null;
  retail_price_with_spp_rub: number | null;
  gross_profit_rub: number | null;
  taxable_profit_for_15_percent_rub: number | null;
  tax_usn_income_rub: number | null;
  tax_usn_income_minus_expenses_rub: number | null;
  vat_rub: number;
  total_tax_rub: number | null;
  net_profit_per_unit_rub: number | null;
  realized_profit_rub: number | null;
  investment_per_unit_rub: number | null;
  stock_turnover_weeks: number | null;
  cash_cycle_weeks: number | null;
  roi_ratio: number | null;
  annual_roi_percent: number | null;
  margin_percent: number | null;
  cost_price_share_percent: number | null;
}

export interface CalculationResult {
  values: CalculationValues;
  warnings: string[];
  errors: string[];
  sourceMap: Record<string, FieldSource>;
}
