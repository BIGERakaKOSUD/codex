import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

type TariffRawRow = Record<string, unknown>;

const headerMap: Record<string, string> = {
  "category_id": "categoryId",
  "category id": "categoryId",
  "id категории": "categoryId",
  "категория id": "categoryId",
  "category_name": "categoryName",
  "category name": "categoryName",
  "категория": "categoryName",
  "commission_percent": "commissionPercent",
  "комиссия": "commissionPercent",
  "комиссия %": "commissionPercent",
  "direct_logistics_cost": "directLogisticsCost",
  "прямая логистика": "directLogisticsCost",
  "reverse_logistics_cost": "reverseLogisticsCost",
  "обратная логистика": "reverseLogisticsCost",
  "acceptance_cost": "acceptanceCost",
  "приемка": "acceptanceCost",
  "storage_cost_per_day": "storageCostPerDay",
  "хранение": "storageCostPerDay",
  "pickup_delivery_cost": "pickupDeliveryCost",
  "доставка до пвз": "pickupDeliveryCost",
  "min_volume_liters": "minVolumeLiters",
  "max_volume_liters": "maxVolumeLiters",
  "nonlocal_markup": "nonlocalMarkup",
};

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function parseRows(buffer: ArrayBuffer, fileName: string): Promise<TariffRawRow[]> {
  const bytes = Buffer.from(buffer);
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as TariffRawRow[]) : ((parsed as { rules?: TariffRawRow[] }).rules ?? []);
  }
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const parsed = Papa.parse<TariffRawRow>(bytes.toString("utf8"), {
      header: true,
      delimiter: lower.endsWith(".tsv") ? "\t" : undefined,
      skipEmptyLines: true,
    });
    return parsed.data;
  }

  const workbook = XLSX.read(bytes, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  return sheetName ? XLSX.utils.sheet_to_json<TariffRawRow>(workbook.Sheets[sheetName], { defval: null }) : [];
}

function normalizeTariffRow(row: TariffRawRow): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const target = headerMap[normalizeHeader(key)] ?? key;
    normalized[target] = value;
  }
  return normalized;
}

export async function importTariffVersion(params: {
  file: ArrayBuffer;
  fileName: string;
  name: string;
  sourceUrl?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  activate?: boolean;
}): Promise<{ versionId: number; rules: number }> {
  const rows = (await parseRows(params.file, params.fileName)).map(normalizeTariffRow);

  const version = await prisma.$transaction(async (tx) => {
    if (params.activate) {
      await tx.tariffVersion.updateMany({ data: { active: false } });
    }

    return tx.tariffVersion.create({
      data: {
        name: params.name,
        sourceUrl: params.sourceUrl ?? null,
        effectiveFrom: params.effectiveFrom ?? null,
        effectiveTo: params.effectiveTo ?? null,
        active: params.activate ?? false,
        rawJson: rows as Prisma.InputJsonValue,
        rules: {
          create: rows.map((row) => ({
            categoryId: typeof row.categoryId === "string" || typeof row.categoryId === "number" ? String(row.categoryId) : null,
            categoryName: typeof row.categoryName === "string" ? row.categoryName : null,
            commissionPercent: numberOrNull(row.commissionPercent),
            minVolumeLiters: numberOrNull(row.minVolumeLiters),
            maxVolumeLiters: numberOrNull(row.maxVolumeLiters),
            directLogisticsCost: numberOrNull(row.directLogisticsCost),
            reverseLogisticsCost: numberOrNull(row.reverseLogisticsCost),
            acceptanceCost: numberOrNull(row.acceptanceCost),
            storageCostPerDay: numberOrNull(row.storageCostPerDay),
            pickupDeliveryCost: numberOrNull(row.pickupDeliveryCost),
            nonlocalMarkupRule: { value: numberOrNull(row.nonlocalMarkup) } as Prisma.InputJsonValue,
            rawJson: row as Prisma.InputJsonValue,
          })),
        },
      },
    });
  });

  return { versionId: version.id, rules: rows.length };
}
