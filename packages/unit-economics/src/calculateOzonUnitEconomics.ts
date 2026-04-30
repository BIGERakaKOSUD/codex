import type {
  CalculationInput,
  CalculationResult,
  FieldSource,
  ProductManualInputs,
} from "../../shared/src/types.ts";

const moneyFields = new Set([
  "commission_rub",
  "commission_fact_avg_rub",
  "commission_formula_rub",
  "acquiring_rub",
  "ozon_direct_base_logistics_rub",
  "nonlocal_logistics_markup_rub",
  "forecast_direct_logistics_rub",
  "forecast_reverse_logistics_rub",
  "acceptance_cost_rub",
  "pickup_delivery_service_rub",
  "total_logistics_rub",
  "ad_cost_per_order_rub",
  "ad_cost_per_buyout_rub",
  "total_expenses_rub",
  "confirmed_total_expenses_rub",
  "retail_price_rub",
  "retail_price_with_spp_rub",
  "gross_profit_rub",
  "taxable_profit_for_15_percent_rub",
  "tax_usn_income_rub",
  "tax_usn_income_minus_expenses_rub",
  "vat_rub",
  "total_tax_rub",
  "net_profit_per_unit_rub",
  "realized_profit_rub",
  "investment_per_unit_rub",
]);

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOrZero(value: number | null | undefined): number {
  return isNumber(value) ? value : 0;
}

function nullableNumber(value: number | null | undefined): number | null {
  return isNumber(value) ? value : null;
}

function round(value: number | null, digits = 4): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundValue(key: string, value: number | null): number | null {
  return moneyFields.has(key) ? round(value, 2) : round(value, 4);
}

function manualSource(inputs: ProductManualInputs, field: string, fallback: FieldSource = "manual"): FieldSource {
  const value = inputs[field as keyof ProductManualInputs];
  if (value === null || value === undefined || value === "") {
    return "missing";
  }

  return inputs.source === "imported" ? "imported" : fallback;
}

function setSource(sourceMap: Record<string, FieldSource>, field: string, source: FieldSource): void {
  sourceMap[field] = source;
}

function calculatedVolumeLiters(widthMm: number | null, heightMm: number | null, depthMm: number | null): number | null {
  if (!isNumber(widthMm) || !isNumber(heightMm) || !isNumber(depthMm)) {
    return null;
  }

  return round((widthMm * heightMm * depthMm) / 1_000_000, 4);
}

export function calculateOzonUnitEconomics(input: CalculationInput): CalculationResult {
  const { product, manualInputs, tariffRule, actualFinance, settings } = input;
  const sourceMap: Record<string, FieldSource> = {};
  const warnings: string[] = [];
  const errors: string[] = [];

  const sourceForManual = (field: string): FieldSource => manualSource(manualInputs, field);
  const costPrice = nullableNumber(manualInputs.cost_price);
  if (costPrice === null) {
    errors.push("missing_cost_price");
  }

  const calculatedVolume = calculatedVolumeLiters(product.api.width_mm, product.api.height_mm, product.api.depth_mm);
  let productVolume = nullableNumber(manualInputs.product_volume_liters);
  let productVolumeSource: FieldSource = sourceForManual("product_volume_liters");

  if (productVolume === null && isNumber(product.api.volume_liters)) {
    productVolume = product.api.volume_liters;
    productVolumeSource = "api";
  }

  if (productVolume === null && calculatedVolume !== null) {
    productVolume = calculatedVolume;
    productVolumeSource = "formula";
  }

  if (productVolume === null) {
    warnings.push("missing_volume");
    productVolumeSource = "missing";
  }

  const inbound = numberOrZero(manualInputs.inbound_logistics_to_warehouse);
  const freeAcceptance = manualInputs.free_acceptance === true;
  const buyoutPercent = nullableNumber(manualInputs.buyout_percent);
  const buyoutRate = buyoutPercent === null ? null : buyoutPercent / 100;
  const nonBuyoutRate = numberOrZero(manualInputs.non_buyout_percent) / 100;
  const returnRate = numberOrZero(manualInputs.return_percent) / 100;
  const cancelRate = numberOrZero(manualInputs.cancel_percent) / 100;

  if (buyoutRate === null || buyoutRate <= 0) {
    errors.push("buyout_rate_must_be_positive");
  }

  const apiRetailPrice = nullableNumber(product.api.current_price);
  const manualRetailPrice = nullableNumber(manualInputs.retail_price_without_promo);
  const retailPriceWithoutPromo = manualRetailPrice ?? apiRetailPrice;
  setSource(
    sourceMap,
    "retail_price_without_promo",
    manualRetailPrice !== null ? sourceForManual("retail_price_without_promo") : apiRetailPrice !== null ? "api" : "missing",
  );

  const promoDiscountPercent = numberOrZero(manualInputs.promo_discount_percent);
  const retailPrice =
    retailPriceWithoutPromo === null
      ? null
      : retailPriceWithoutPromo * (1 - Math.max(0, promoDiscountPercent) / 100);

  if (retailPrice === null) {
    errors.push("missing_retail_price");
  }

  const retailPriceWithSpp = nullableNumber(product.api.marketing_price);
  setSource(sourceMap, "retail_price_with_spp_rub", retailPriceWithSpp === null ? "missing" : "api");

  const tariffCommission = nullableNumber(tariffRule?.base_commission_percent ?? tariffRule?.commission_percent);
  const manualCommission = nullableNumber(manualInputs.base_commission_percent);
  const baseCommissionPercent = manualCommission ?? tariffCommission;
  setSource(
    sourceMap,
    "base_commission_percent",
    manualCommission !== null ? sourceForManual("base_commission_percent") : tariffCommission !== null ? "imported" : "missing",
  );
  if (baseCommissionPercent === null) {
    errors.push("missing_commission");
  }

  const commissionFormula =
    retailPrice !== null && baseCommissionPercent !== null ? (retailPrice * baseCommissionPercent) / 100 : null;
  const commissionFact = nullableNumber(actualFinance?.commission_fact_avg_rub);
  const useActualCommission = settings.use_actual_finance_data && commissionFact !== null;
  const commission = useActualCommission ? commissionFact : commissionFormula;
  setSource(sourceMap, "commission_rub", useActualCommission ? "api" : commissionFormula === null ? "missing" : "formula");

  const acquiringPercent = numberOrZero(manualInputs.coinvest_acquiring_percent);
  const acquiring =
    settings.use_actual_finance_data && nullableNumber(actualFinance?.acquiring_avg_rub) !== null
      ? nullableNumber(actualFinance?.acquiring_avg_rub)
      : retailPrice === null
        ? null
        : (retailPrice * acquiringPercent) / 100;

  const totalDrrPercent = numberOrZero(manualInputs.total_drr_percent);
  const adCostPerOrder = retailPrice === null ? null : (retailPrice * totalDrrPercent) / 100;
  const canDivideByBuyout = buyoutRate !== null && buyoutRate > 0;
  const adCostPerBuyout = adCostPerOrder === null || !canDivideByBuyout ? null : adCostPerOrder / buyoutRate;

  const directBase = numberOrZero(tariffRule?.direct_logistics_cost);
  const nonlocalMarkup = numberOrZero(tariffRule?.nonlocal_markup);
  const pickupDelivery = numberOrZero(manualInputs.delivery_to_pickup_point_cost ?? tariffRule?.pickup_delivery_cost);
  const expressCost = numberOrZero(manualInputs.express_cost);
  const forecastDirect =
    directBase + nonlocalMarkup + pickupDelivery + (settings.include_express_in_logistics ? expressCost : 0);

  const reverseBase = numberOrZero(tariffRule?.reverse_logistics_cost);
  const forecastReverse = !canDivideByBuyout ? null : (reverseBase * (nonBuyoutRate + returnRate)) / buyoutRate;
  const acceptanceCost = freeAcceptance ? 0 : numberOrZero(tariffRule?.acceptance_cost);
  const paidStorage = numberOrZero(manualInputs.paid_storage_cost);

  let totalLogistics: number | null;
  if (settings.use_actual_finance_data) {
    totalLogistics =
      settings.calculation_basis === "per_order"
        ? nullableNumber(actualFinance?.logistics_per_order_avg_rub)
        : nullableNumber(actualFinance?.logistics_per_buyout_avg_rub);
  } else {
    totalLogistics = !canDivideByBuyout
      ? null
      : forecastDirect / buyoutRate + (forecastReverse ?? 0) + inbound + acceptanceCost + paidStorage;
  }

  const otherExpenses = numberOrZero(manualInputs.other_expenses);
  const selfPurchase = numberOrZero(manualInputs.self_purchase_cost);
  const reviewPoints = numberOrZero(manualInputs.review_points_cost);
  const totalExpenses =
    costPrice === null || retailPrice === null || commission === null || acquiring === null || totalLogistics === null || adCostPerBuyout === null
      ? null
      : costPrice +
        inbound +
        commission +
        acquiring +
        totalLogistics +
        adCostPerBuyout +
        (settings.include_express_in_logistics ? 0 : expressCost) +
        (settings.include_self_purchase_in_total_expenses ? selfPurchase : 0) +
        (settings.include_reviews_in_total_expenses ? reviewPoints : 0) +
        otherExpenses;

  const confirmedOtherExpenses = numberOrZero(manualInputs.confirmed_other_expenses);
  const confirmedAdExpenses = numberOrZero(actualFinance?.confirmed_ad_expenses);
  const confirmedTotalExpenses =
    costPrice === null || commission === null || acquiring === null || totalLogistics === null
      ? null
      : costPrice + inbound + commission + acquiring + totalLogistics + confirmedOtherExpenses + confirmedAdExpenses;

  const grossProfit = retailPrice === null || totalExpenses === null ? null : retailPrice - totalExpenses;
  if (grossProfit !== null && grossProfit < 0) {
    warnings.push("negative_profit");
  }

  const taxUsnIncomePercent = numberOrZero(manualInputs.tax_usn_income_percent);
  const taxUsnIncome = retailPrice === null ? null : (retailPrice * taxUsnIncomePercent) / 100;
  const taxableProfit15 =
    retailPrice === null || confirmedTotalExpenses === null ? null : Math.max(retailPrice - confirmedTotalExpenses, 0);
  const taxUsnIncomeMinusExpensesPercent = numberOrZero(manualInputs.tax_usn_income_minus_expenses_percent);
  const taxUsnIncomeMinusExpenses =
    taxableProfit15 === null ? null : (taxableProfit15 * taxUsnIncomeMinusExpensesPercent) / 100;

  const vatPercent = numberOrZero(manualInputs.vat_percent ?? product.api.vat_percent);
  const vatRub = retailPrice !== null && settings.vat_mode === "vat_included" && vatPercent > 0 ? (retailPrice * vatPercent) / (100 + vatPercent) : 0;

  let totalTax: number | null = 0;
  if (settings.tax_mode === "usn_income") {
    totalTax = taxUsnIncome;
  } else if (settings.tax_mode === "usn_income_minus_expenses") {
    totalTax = taxUsnIncomeMinusExpenses;
  } else if (settings.tax_mode === "vat_included") {
    totalTax = 0;
  }
  totalTax = totalTax === null ? null : totalTax + vatRub;

  const netProfit = grossProfit === null || totalTax === null ? null : grossProfit - totalTax;
  const soldQtyMonth = nullableNumber(manualInputs.sold_qty_month);
  const realizedProfit = netProfit === null || soldQtyMonth === null ? null : netProfit * soldQtyMonth;
  const investmentPerUnit = costPrice === null ? null : costPrice + inbound;
  if (investmentPerUnit !== null && investmentPerUnit <= 0) {
    errors.push("investment_per_unit_must_be_positive");
  }

  const roiRatio = netProfit === null || investmentPerUnit === null || investmentPerUnit <= 0 ? null : netProfit / investmentPerUnit;
  const batchQty = nullableNumber(manualInputs.batch_qty);
  const leadWeeks = nullableNumber(manualInputs.manufacturer_logistics_lead_weeks);
  const stockTurnoverWeeks = batchQty !== null && soldQtyMonth !== null && soldQtyMonth > 0 ? (batchQty / soldQtyMonth) * 4.345 : null;
  const cashCycleWeeks = leadWeeks !== null && stockTurnoverWeeks !== null ? leadWeeks + stockTurnoverWeeks : null;
  const annualRoiPercent = roiRatio === null || cashCycleWeeks === null || cashCycleWeeks <= 0 ? null : roiRatio * 100 * 52 / cashCycleWeeks;
  const marginPercent = netProfit === null || retailPrice === null || retailPrice <= 0 ? null : netProfit / retailPrice * 100;
  const costPriceSharePercent = costPrice === null || retailPrice === null || retailPrice <= 0 ? null : costPrice / retailPrice * 100;

  const marketplaceExpenses =
    commission === null || acquiring === null || totalLogistics === null || adCostPerBuyout === null
      ? null
      : commission +
        acquiring +
        totalLogistics +
        adCostPerBuyout +
        (settings.include_storage_in_marketplace_expenses ? paidStorage : 0) +
        acceptanceCost;
  const marketplaceShare =
    marketplaceExpenses === null || retailPrice === null || retailPrice <= 0 ? null : marketplaceExpenses / retailPrice * 100;

  const values = {
    barcode: product.barcode,
    offer_id: product.offer_id,
    sku: product.sku,
    product_id: product.product_id,
    product_name: product.product_name,
    category_name: product.category_name,
    category_id: product.category_id,
    cost_price: costPrice,
    inbound_logistics_to_warehouse: inbound,
    base_commission_percent: baseCommissionPercent,
    product_volume_liters: productVolume,
    calculated_volume_liters: calculatedVolume,
    free_acceptance: freeAcceptance,
    buyout_percent: buyoutPercent,
    non_buyout_percent: numberOrZero(manualInputs.non_buyout_percent),
    return_percent: numberOrZero(manualInputs.return_percent),
    cancel_percent: numberOrZero(manualInputs.cancel_percent),
    delivery_to_pickup_point_cost: pickupDelivery,
    express_cost: expressCost,
    self_purchase_cost: selfPurchase,
    review_points_cost: reviewPoints,
    paid_storage_cost: paidStorage,
    other_expenses: otherExpenses,
    confirmed_other_expenses: confirmedOtherExpenses,
    total_drr_percent: totalDrrPercent,
    retail_price_without_promo: retailPriceWithoutPromo,
    promo_name: manualInputs.promo_name,
    promo_discount_percent: promoDiscountPercent,
    coinvest_acquiring_percent: acquiringPercent,
    tax_usn_income_percent: taxUsnIncomePercent,
    tax_usn_income_minus_expenses_percent: taxUsnIncomeMinusExpensesPercent,
    vat_percent: vatPercent,
    manufacturer_logistics_lead_weeks: leadWeeks,
    batch_qty: batchQty,
    sold_qty_month: soldQtyMonth,
    commission_rub: commission,
    commission_fact_avg_rub: commissionFact,
    commission_formula_rub: commissionFormula,
    calculated_marker: settings.use_actual_finance_data ? "actual_finance" : "formula",
    acquiring_rub: acquiring,
    ozon_direct_base_logistics_rub: directBase,
    nonlocal_logistics_markup_rub: nonlocalMarkup,
    forecast_direct_logistics_rub: forecastDirect,
    forecast_reverse_logistics_rub: forecastReverse,
    acceptance_cost_rub: acceptanceCost,
    pickup_delivery_service_rub: pickupDelivery,
    total_logistics_rub: totalLogistics,
    ad_cost_per_order_rub: adCostPerOrder,
    ad_cost_per_buyout_rub: adCostPerBuyout,
    tacos_percent: totalDrrPercent,
    total_expenses_rub: totalExpenses,
    confirmed_total_expenses_rub: confirmedTotalExpenses,
    marketplace_expense_share_percent: marketplaceShare,
    retail_price_rub: retailPrice,
    retail_price_with_spp_rub: retailPriceWithSpp,
    gross_profit_rub: grossProfit,
    taxable_profit_for_15_percent_rub: taxableProfit15,
    tax_usn_income_rub: taxUsnIncome,
    tax_usn_income_minus_expenses_rub: taxUsnIncomeMinusExpenses,
    vat_rub: vatRub,
    total_tax_rub: totalTax,
    net_profit_per_unit_rub: netProfit,
    realized_profit_rub: realizedProfit,
    investment_per_unit_rub: investmentPerUnit,
    stock_turnover_weeks: stockTurnoverWeeks,
    cash_cycle_weeks: cashCycleWeeks,
    roi_ratio: roiRatio,
    annual_roi_percent: annualRoiPercent,
    margin_percent: marginPercent,
    cost_price_share_percent: costPriceSharePercent,
  };

  for (const [field, value] of Object.entries(values)) {
    if (typeof value === "number") {
      (values as Record<string, unknown>)[field] = roundValue(field, value);
    }
  }

  const manualFields = [
    "cost_price",
    "inbound_logistics_to_warehouse",
    "free_acceptance",
    "buyout_percent",
    "non_buyout_percent",
    "return_percent",
    "cancel_percent",
    "delivery_to_pickup_point_cost",
    "express_cost",
    "self_purchase_cost",
    "review_points_cost",
    "paid_storage_cost",
    "other_expenses",
    "confirmed_other_expenses",
    "total_drr_percent",
    "promo_name",
    "promo_discount_percent",
    "coinvest_acquiring_percent",
    "tax_usn_income_percent",
    "tax_usn_income_minus_expenses_percent",
    "vat_percent",
    "manufacturer_logistics_lead_weeks",
    "batch_qty",
    "sold_qty_month",
  ];

  for (const field of manualFields) {
    setSource(sourceMap, field, sourceForManual(field));
  }

  setSource(sourceMap, "product_volume_liters", productVolumeSource);
  setSource(sourceMap, "retail_price_rub", retailPrice === null ? "missing" : "formula");
  setSource(sourceMap, "commission_formula_rub", commissionFormula === null ? "missing" : "formula");
  setSource(sourceMap, "commission_fact_avg_rub", commissionFact === null ? "missing" : "api");
  setSource(sourceMap, "acquiring_rub", acquiring === null ? "missing" : settings.use_actual_finance_data ? "api" : "formula");
  setSource(sourceMap, "total_logistics_rub", totalLogistics === null ? "missing" : settings.use_actual_finance_data ? "api" : "formula");

  for (const field of Object.keys(values)) {
    if (!sourceMap[field]) {
      const value = values[field as keyof typeof values];
      sourceMap[field] = value === null || value === undefined ? "missing" : "formula";
    }
  }

  return {
    values,
    warnings,
    errors,
    sourceMap,
  };
}
