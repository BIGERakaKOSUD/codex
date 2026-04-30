import { prisma } from "@/lib/db";
import { importColumnMap } from "@ozon-unit-economics/shared";
import type { Prisma } from "@prisma/client";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

type ImportRow = Record<string, unknown>;

export const prismaManualFieldMap: Record<string, string> = {
  cost_price: "costPrice",
  inbound_logistics_to_warehouse: "inboundLogisticsToWarehouse",
  base_commission_percent: "baseCommissionPercent",
  product_volume_liters: "productVolumeLiters",
  free_acceptance: "freeAcceptance",
  buyout_percent: "buyoutPercent",
  non_buyout_percent: "nonBuyoutPercent",
  return_percent: "returnPercent",
  cancel_percent: "cancelPercent",
  delivery_to_pickup_point_cost: "deliveryToPickupPointCost",
  express_cost: "expressCost",
  self_purchase_cost: "selfPurchaseCost",
  review_points_cost: "reviewPointsCost",
  paid_storage_cost: "paidStorageCost",
  other_expenses: "otherExpenses",
  confirmed_other_expenses: "confirmedOtherExpenses",
  total_drr_percent: "totalDrrPercent",
  retail_price_without_promo: "retailPriceWithoutPromo",
  promo_name: "promoName",
  promo_discount_percent: "promoDiscountPercent",
  coinvest_acquiring_percent: "coinvestAcquiringPercent",
  tax_usn_income_percent: "taxUsnIncomePercent",
  tax_usn_income_minus_expenses_percent: "taxUsnIncomeMinusExpensesPercent",
  vat_percent: "vatPercent",
  manufacturer_logistics_lead_weeks: "manufacturerLogisticsLeadWeeks",
  batch_qty: "batchQty",
  sold_qty_month: "soldQtyMonth",
};

export interface ManualImportResult {
  imported: number;
  createdManualOnly: number;
  updatedExisting: number;
  conflicts: Array<{ row: number; offer_id: string | null; barcode: string | null; matches: number }>;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["да", "yes", "true", "1"].includes(normalized)) {
      return true;
    }
    if (["нет", "no", "false", "0"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function parseSpreadsheet(buffer: ArrayBuffer, fileName: string): Promise<ImportRow[]> {
  const bytes = Buffer.from(buffer);
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const text = bytes.toString("utf8");
    const parsed = Papa.parse<ImportRow>(text, {
      header: true,
      delimiter: lower.endsWith(".tsv") ? "\t" : undefined,
      skipEmptyLines: true,
    });
    return parsed.data;
  }

  const workbook = XLSX.read(bytes, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }
  return XLSX.utils.sheet_to_json<ImportRow>(workbook.Sheets[sheetName], { defval: null });
}

function normalizeImportRow(row: ImportRow): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [sourceKey, value] of Object.entries(row)) {
    const mapped = importColumnMap[normalizeHeader(sourceKey)];
    if (!mapped) {
      continue;
    }
    normalized[mapped] = value;
  }

  return normalized;
}

function toPrismaManualData(row: Record<string, unknown>): Prisma.ProductManualInputUncheckedCreateInput {
  const data: Prisma.ProductManualInputUncheckedCreateInput = { source: "imported" };

  for (const [field, prismaField] of Object.entries(prismaManualFieldMap)) {
    if (!(field in row)) {
      continue;
    }

    if (field === "free_acceptance") {
      (data as Record<string, unknown>)[prismaField] = parseBoolean(row[field]);
    } else if (field === "promo_name") {
      (data as Record<string, unknown>)[prismaField] = typeof row[field] === "string" ? row[field] : null;
    } else {
      (data as Record<string, unknown>)[prismaField] = parseNumber(row[field]);
    }
  }

  return data;
}

export async function importManualRows(rows: ImportRow[]): Promise<ManualImportResult> {
  const result: ManualImportResult = {
    imported: 0,
    createdManualOnly: 0,
    updatedExisting: 0,
    conflicts: [],
  };

  for (const [index, rawRow] of rows.entries()) {
    const row = normalizeImportRow(rawRow);
    const offerId = typeof row.offer_id === "string" || typeof row.offer_id === "number" ? String(row.offer_id).trim() : null;
    const barcode = typeof row.barcode === "string" || typeof row.barcode === "number" ? String(row.barcode).trim() : null;
    const categoryName = typeof row.category_name === "string" ? row.category_name : null;

    if (!offerId && !barcode) {
      continue;
    }

    const matches = await prisma.ozonProduct.findMany({
      where: {
        OR: [
          ...(offerId ? [{ offerId }] : []),
          ...(barcode ? [{ barcode }] : []),
        ],
      },
    });

    if (matches.length > 1) {
      result.conflicts.push({ row: index + 2, offer_id: offerId, barcode, matches: matches.length });
      continue;
    }

    let product = matches[0] ?? null;
    if (!product) {
      product = await prisma.ozonProduct.create({
        data: {
          offerId,
          barcode,
          categoryName,
          rawApiJson: { manualOnly: true },
        },
      });
      result.createdManualOnly += 1;
    } else {
      result.updatedExisting += 1;
    }

    const data: Prisma.ProductManualInputUncheckedCreateInput = {
      ...toPrismaManualData(row),
      offerId: product.offerId ?? offerId,
      barcode: product.barcode ?? barcode,
      ozonProductId: product.ozonProductId,
    };

    const where: Prisma.ProductManualInputWhereUniqueInput = data.offerId ? { offerId: data.offerId } : { barcode: data.barcode ?? "" };
    await prisma.productManualInput.upsert({
      where,
      create: data,
      update: data,
    });

    result.imported += 1;
  }

  return result;
}
