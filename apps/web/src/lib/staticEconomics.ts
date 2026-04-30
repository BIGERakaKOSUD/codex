import * as Papa from "papaparse";
import * as XLSX from "xlsx";
import { calculateOzonUnitEconomics, defaultCalculationSettings, emptyManualInputs } from "@ozon-unit-economics/unit-economics";
import { economicsColumns, importColumnMap } from "@ozon-unit-economics/shared";
import type {
  CalculationResult,
  FieldSource,
  NormalizedOzonProduct,
  ProductManualInputs,
} from "@ozon-unit-economics/shared";

export interface EconomicsRow {
  id: number;
  product: NormalizedOzonProduct;
  manualInputs: ProductManualInputs;
  values: Record<string, unknown>;
  sourceMap: Record<string, FieldSource>;
  warnings: string[];
  errors: string[];
}

export interface StaticStore {
  rows: EconomicsRow[];
  lastCalculation: string | null;
  lastImport: string | null;
}

export const staticStorageKey = "ozon-unit-economics-static-v1";

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "да"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "нет"].includes(normalized)) {
    return false;
  }
  return null;
}

function normalizeRawRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(row)) {
    const key = importColumnMap[normalizeHeader(header)] ?? normalizeHeader(header);
    normalized[key] = value;
  }
  return normalized;
}

function manualFromRow(row: Record<string, unknown>): ProductManualInputs {
  return {
    ...emptyManualInputs,
    cost_price: parseNumber(row.cost_price),
    inbound_logistics_to_warehouse: parseNumber(row.inbound_logistics_to_warehouse),
    base_commission_percent: parseNumber(row.base_commission_percent),
    product_volume_liters: parseNumber(row.product_volume_liters),
    free_acceptance: parseBoolean(row.free_acceptance),
    buyout_percent: parseNumber(row.buyout_percent),
    non_buyout_percent: parseNumber(row.non_buyout_percent),
    return_percent: parseNumber(row.return_percent),
    cancel_percent: parseNumber(row.cancel_percent),
    delivery_to_pickup_point_cost: parseNumber(row.delivery_to_pickup_point_cost),
    express_cost: parseNumber(row.express_cost),
    self_purchase_cost: parseNumber(row.self_purchase_cost),
    review_points_cost: parseNumber(row.review_points_cost),
    paid_storage_cost: parseNumber(row.paid_storage_cost),
    other_expenses: parseNumber(row.other_expenses),
    confirmed_other_expenses: parseNumber(row.confirmed_other_expenses),
    total_drr_percent: parseNumber(row.total_drr_percent),
    retail_price_without_promo: parseNumber(row.retail_price_without_promo),
    promo_name: row.promo_name ? String(row.promo_name) : null,
    promo_discount_percent: parseNumber(row.promo_discount_percent),
    coinvest_acquiring_percent: parseNumber(row.coinvest_acquiring_percent),
    tax_usn_income_percent: parseNumber(row.tax_usn_income_percent),
    tax_usn_income_minus_expenses_percent: parseNumber(row.tax_usn_income_minus_expenses_percent),
    vat_percent: parseNumber(row.vat_percent),
    manufacturer_logistics_lead_weeks: parseNumber(row.manufacturer_logistics_lead_weeks),
    batch_qty: parseNumber(row.batch_qty),
    sold_qty_month: parseNumber(row.sold_qty_month),
    source: "imported",
  };
}

function productFromRow(row: Record<string, unknown>): NormalizedOzonProduct {
  return {
    barcode: row.barcode ? String(row.barcode) : null,
    offer_id: row.offer_id ? String(row.offer_id) : null,
    sku: row.sku ? String(row.sku) : null,
    product_id: row.product_id ? String(row.product_id) : null,
    product_name: row.product_name ? String(row.product_name) : null,
    category_name: row.category_name ? String(row.category_name) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    api: {
      current_price: null,
      old_price: null,
      marketing_price: null,
      min_price: null,
      vat_percent: null,
      width_mm: null,
      height_mm: null,
      depth_mm: null,
      weight_g: null,
      volume_liters: null,
      stock_total: null,
      stock_reserved: null,
    },
  };
}

export async function parseManualFile(file: File): Promise<EconomicsRow[]> {
  const buffer = await file.arrayBuffer();
  const lower = file.name.toLowerCase();
  let rawRows: Array<Record<string, unknown>>;

  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const text = new TextDecoder().decode(buffer);
    rawRows = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      delimiter: lower.endsWith(".tsv") ? "\t" : undefined,
      skipEmptyLines: true,
    }).data;
  } else {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    rawRows = sheetName ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: null }) : [];
  }

  return rawRows.map((raw, index) => {
    const normalized = normalizeRawRow(raw);
    return recalculateRow({
      id: index + 1,
      product: productFromRow(normalized),
      manualInputs: manualFromRow(normalized),
      values: {},
      sourceMap: {},
      warnings: [],
      errors: [],
    });
  });
}

export function recalculateRow(row: EconomicsRow): EconomicsRow {
  const result: CalculationResult = calculateOzonUnitEconomics({
    product: row.product,
    manualInputs: row.manualInputs,
    tariffRule: null,
    actualFinance: null,
    settings: defaultCalculationSettings,
  });

  return {
    ...row,
    values: result.values as unknown as Record<string, unknown>,
    sourceMap: result.sourceMap,
    warnings: result.warnings,
    errors: result.errors,
  };
}

export function updateManualValue(row: EconomicsRow, field: string, value: string | boolean): EconomicsRow {
  const parsedValue =
    field === "promo_name"
      ? String(value)
      : field === "free_acceptance"
        ? value === true || value === "true"
        : parseNumber(value);

  return recalculateRow({
    ...row,
    manualInputs: {
      ...row.manualInputs,
      [field]: parsedValue,
      source: "manual",
    },
  });
}

export function loadStaticStore(): StaticStore {
  if (typeof window === "undefined") {
    return { rows: [], lastCalculation: null, lastImport: null };
  }

  const raw = window.localStorage.getItem(staticStorageKey);
  if (!raw) {
    return { rows: [], lastCalculation: null, lastImport: null };
  }

  try {
    const parsed = JSON.parse(raw) as StaticStore;
    return {
      rows: (parsed.rows ?? []).map(recalculateRow),
      lastCalculation: parsed.lastCalculation ?? null,
      lastImport: parsed.lastImport ?? null,
    };
  } catch {
    return { rows: [], lastCalculation: null, lastImport: null };
  }
}

export function saveStaticStore(store: StaticStore): void {
  window.localStorage.setItem(staticStorageKey, JSON.stringify(store));
}

export function clearStaticStore(): void {
  window.localStorage.removeItem(staticStorageKey);
}

export function createBackupJson(store: StaticStore): string {
  return JSON.stringify(store, null, 2);
}

export function loadBackupJson(text: string): StaticStore {
  const parsed = JSON.parse(text) as StaticStore;
  return {
    rows: (parsed.rows ?? []).map(recalculateRow),
    lastCalculation: parsed.lastCalculation ?? null,
    lastImport: parsed.lastImport ?? null,
  };
}

export function createExportWorkbook(rows: EconomicsRow[]): ArrayBuffer {
  const exportRows = rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const column of economicsColumns) {
      record[column.label] = row.values[column.key] ?? null;
    }
    record.Errors = row.errors.join(", ");
    record.Warnings = row.warnings.join(", ");
    return record;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ozon Unit Economics");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
