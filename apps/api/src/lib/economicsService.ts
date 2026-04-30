import { prisma } from "@/lib/db";
import { calculateOzonUnitEconomics, defaultCalculationSettings, emptyManualInputs } from "@ozon-unit-economics/unit-economics";
import type {
  ActualFinanceAggregates,
  CalculationSettings,
  NormalizedOzonProduct,
  ProductManualInputs,
  TariffRuleInput,
} from "@ozon-unit-economics/shared";

type JsonObject = Record<string, unknown>;

export interface EconomicsQuery {
  periodFrom: Date;
  periodTo: Date;
  settings?: Partial<CalculationSettings>;
}

export interface EconomicsRow {
  id: number;
  values: Record<string, unknown>;
  sourceMap: Record<string, string>;
  warnings: string[];
  errors: string[];
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function rawApi(productRaw: unknown): NormalizedOzonProduct["api"] {
  const raw = asObject(productRaw);
  const normalized = asObject(raw.normalizedApi);

  return {
    current_price: toNumber(normalized.current_price),
    old_price: toNumber(normalized.old_price),
    marketing_price: toNumber(normalized.marketing_price),
    min_price: toNumber(normalized.min_price),
    price_index: typeof normalized.price_index === "string" ? normalized.price_index : null,
    vat_percent: toNumber(normalized.vat_percent),
    width_mm: toNumber(normalized.width_mm),
    height_mm: toNumber(normalized.height_mm),
    depth_mm: toNumber(normalized.depth_mm),
    weight_g: toNumber(normalized.weight_g),
    volume_liters: toNumber(normalized.volume_liters),
    stock_total: toNumber(normalized.stock_total),
    stock_reserved: toNumber(normalized.stock_reserved),
  };
}

function toManualInputs(input: Record<string, unknown> | null | undefined): ProductManualInputs {
  if (!input) {
    return { ...emptyManualInputs };
  }

  return {
    cost_price: toNumber(input.costPrice),
    inbound_logistics_to_warehouse: toNumber(input.inboundLogisticsToWarehouse),
    base_commission_percent: toNumber(input.baseCommissionPercent),
    product_volume_liters: toNumber(input.productVolumeLiters),
    free_acceptance: typeof input.freeAcceptance === "boolean" ? input.freeAcceptance : null,
    buyout_percent: toNumber(input.buyoutPercent),
    non_buyout_percent: toNumber(input.nonBuyoutPercent),
    return_percent: toNumber(input.returnPercent),
    cancel_percent: toNumber(input.cancelPercent),
    delivery_to_pickup_point_cost: toNumber(input.deliveryToPickupPointCost),
    express_cost: toNumber(input.expressCost),
    self_purchase_cost: toNumber(input.selfPurchaseCost),
    review_points_cost: toNumber(input.reviewPointsCost),
    paid_storage_cost: toNumber(input.paidStorageCost),
    other_expenses: toNumber(input.otherExpenses),
    confirmed_other_expenses: toNumber(input.confirmedOtherExpenses),
    total_drr_percent: toNumber(input.totalDrrPercent),
    retail_price_without_promo: toNumber(input.retailPriceWithoutPromo),
    promo_name: typeof input.promoName === "string" ? input.promoName : null,
    promo_discount_percent: toNumber(input.promoDiscountPercent),
    coinvest_acquiring_percent: toNumber(input.coinvestAcquiringPercent),
    tax_usn_income_percent: toNumber(input.taxUsnIncomePercent),
    tax_usn_income_minus_expenses_percent: toNumber(input.taxUsnIncomeMinusExpensesPercent),
    vat_percent: toNumber(input.vatPercent),
    manufacturer_logistics_lead_weeks: toNumber(input.manufacturerLogisticsLeadWeeks),
    batch_qty: toNumber(input.batchQty),
    sold_qty_month: toNumber(input.soldQtyMonth),
    source: input.source === "imported" ? "imported" : "manual",
  };
}

function toTariffRule(rule: Record<string, unknown> | null | undefined): TariffRuleInput | null {
  if (!rule) {
    return null;
  }

  const nonlocalRule = asObject(rule.nonlocalMarkupRule);
  return {
    commission_percent: toNumber(rule.commissionPercent),
    direct_logistics_cost: toNumber(rule.directLogisticsCost),
    reverse_logistics_cost: toNumber(rule.reverseLogisticsCost),
    acceptance_cost: toNumber(rule.acceptanceCost),
    storage_cost_per_day: toNumber(rule.storageCostPerDay),
    pickup_delivery_cost: toNumber(rule.pickupDeliveryCost),
    nonlocal_markup: toNumber(nonlocalRule.value),
  };
}

function classifyExpense(operationType: string | null, serviceName: string | null): keyof ActualFinanceAggregates | "other" {
  const text = `${operationType ?? ""} ${serviceName ?? ""}`.toLowerCase();
  if (text.includes("commission") || text.includes("комисс") || text.includes("sale_commission")) {
    return "commission_fact_avg_rub";
  }
  if (text.includes("acquiring") || text.includes("эквайр")) {
    return "acquiring_avg_rub";
  }
  if (text.includes("advert") || text.includes("реклам") || text.includes("marketing") || text.includes("продвиж")) {
    return "advertising_avg_rub";
  }
  if (text.includes("storage") || text.includes("хранен")) {
    return "storage_avg_rub";
  }
  if (text.includes("delivery") || text.includes("logistic") || text.includes("достав") || text.includes("логист") || text.includes("return")) {
    return "logistics_per_buyout_avg_rub";
  }
  return "other";
}

async function financeAggregates(periodFrom: Date, periodTo: Date): Promise<Map<string, ActualFinanceAggregates>> {
  const [transactions, postings] = await Promise.all([
    prisma.ozonFinanceTransaction.findMany({
      where: { operationDate: { gte: periodFrom, lte: periodTo } },
    }),
    prisma.ozonPosting.findMany({
      where: { createdAt: { gte: periodFrom, lte: periodTo } },
    }),
  ]);

  const soldQty = new Map<string, number>();
  for (const posting of postings) {
    if (!posting.offerId) {
      continue;
    }
    const status = posting.status?.toLowerCase() ?? "";
    if (status.includes("delivered") || status.includes("awaiting") || status.includes("достав")) {
      soldQty.set(posting.offerId, (soldQty.get(posting.offerId) ?? 0) + (posting.quantity ?? 1));
    }
  }

  const totals = new Map<string, Record<string, number>>();
  for (const transaction of transactions) {
    if (!transaction.offerId) {
      continue;
    }

    const bucket = classifyExpense(transaction.operationType, transaction.serviceName);
    if (bucket === "other") {
      continue;
    }

    const entry = totals.get(transaction.offerId) ?? {};
    entry[bucket] = (entry[bucket] ?? 0) + Math.abs(transaction.amount);
    totals.set(transaction.offerId, entry);
  }

  const result = new Map<string, ActualFinanceAggregates>();
  for (const [offerId, total] of totals.entries()) {
    const divisor = Math.max(soldQty.get(offerId) ?? 1, 1);
    result.set(offerId, {
      commission_fact_avg_rub: total.commission_fact_avg_rub ? total.commission_fact_avg_rub / divisor : null,
      acquiring_avg_rub: total.acquiring_avg_rub ? total.acquiring_avg_rub / divisor : null,
      advertising_avg_rub: total.advertising_avg_rub ? total.advertising_avg_rub / divisor : null,
      storage_avg_rub: total.storage_avg_rub ? total.storage_avg_rub / divisor : null,
      logistics_per_buyout_avg_rub: total.logistics_per_buyout_avg_rub ? total.logistics_per_buyout_avg_rub / divisor : null,
      logistics_per_order_avg_rub: total.logistics_per_buyout_avg_rub ? total.logistics_per_buyout_avg_rub / divisor : null,
      confirmed_ad_expenses: total.advertising_avg_rub ? total.advertising_avg_rub / divisor : null,
    });
  }

  return result;
}

function findTariff(
  product: { categoryId: string | null; categoryName: string | null },
  rules: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  return (
    rules.find((rule) => rule.categoryId && rule.categoryId === product.categoryId) ??
    rules.find((rule) => {
      const categoryName = typeof rule.categoryName === "string" ? rule.categoryName.toLowerCase() : "";
      return categoryName !== "" && categoryName === (product.categoryName ?? "").toLowerCase();
    }) ??
    null
  );
}

export async function getEconomicsRows(query: EconomicsQuery): Promise<EconomicsRow[]> {
  const settings: CalculationSettings = { ...defaultCalculationSettings };
  for (const [key, value] of Object.entries(query.settings ?? {})) {
    if (value !== undefined) {
      (settings as unknown as Record<string, unknown>)[key] = value;
    }
  }
  const [products, manualInputs, activeTariff, actualFinance] = await Promise.all([
    prisma.ozonProduct.findMany({ orderBy: [{ categoryName: "asc" }, { offerId: "asc" }] }),
    prisma.productManualInput.findMany(),
    prisma.tariffVersion.findFirst({ where: { active: true }, include: { rules: true } }),
    financeAggregates(query.periodFrom, query.periodTo),
  ]);

  const manualByOffer = new Map(
    manualInputs
      .filter((input) => input.offerId)
      .map((input) => [input.offerId, input as unknown as Record<string, unknown>]),
  );
  const manualByBarcode = new Map(
    manualInputs
      .filter((input) => input.barcode)
      .map((input) => [input.barcode, input as unknown as Record<string, unknown>]),
  );
  const rules = activeTariff?.rules.map((rule) => rule as unknown as Record<string, unknown>) ?? [];

  return products.map((product) => {
    const manual = toManualInputs(
      (product.offerId ? manualByOffer.get(product.offerId) : undefined) ??
        (product.barcode ? manualByBarcode.get(product.barcode) : undefined),
    );
    const normalizedProduct: NormalizedOzonProduct = {
      barcode: product.barcode,
      offer_id: product.offerId,
      sku: product.sku,
      product_id: product.ozonProductId,
      product_name: product.name,
      category_name: product.categoryName,
      category_id: product.categoryId,
      api: rawApi(product.rawApiJson),
    };
    const result = calculateOzonUnitEconomics({
      product: normalizedProduct,
      manualInputs: manual,
      tariffRule: toTariffRule(findTariff(product, rules)),
      actualFinance: product.offerId ? actualFinance.get(product.offerId) ?? null : null,
      settings,
    });

    return {
      id: product.id,
      values: result.values as unknown as Record<string, unknown>,
      sourceMap: result.sourceMap,
      warnings: result.warnings,
      errors: result.errors,
    };
  });
}
