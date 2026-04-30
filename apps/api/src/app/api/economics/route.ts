import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createEconomicsWorkbook } from "@/lib/importExport/exportEconomics.ts";
import { prismaManualFieldMap } from "@/lib/importExport/manualImport.ts";
import { parsePeriod } from "@/lib/http/period.ts";
import { editableManualKeys } from "@ozon-unit-economics/shared";
import { getEconomicsRows } from "@/lib/economicsService.ts";
import type { CalculationSettings, TaxMode, VatMode } from "@ozon-unit-economics/shared";

const taxModes = new Set<TaxMode>(["usn_income", "usn_income_minus_expenses", "vat_included", "no_tax"]);
const vatModes = new Set<VatMode>(["no_vat", "vat_included"]);

function normalizeEditableValue(field: string, value: unknown): string | number | boolean | null {
  if (value === "" || value === undefined) {
    return null;
  }
  if (field === "promo_name") {
    return typeof value === "string" ? value : String(value);
  }
  if (field === "free_acceptance") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return ["true", "1", "да", "yes"].includes(value.toLowerCase());
    }
    return null;
  }
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { periodFrom, periodTo } = parsePeriod(url.searchParams);
  const settings: Partial<CalculationSettings> = {};
  if (url.searchParams.get("useActualFinance") === "true") {
    settings.use_actual_finance_data = true;
  }
  const taxMode = url.searchParams.get("taxMode") as TaxMode | null;
  if (taxMode && taxModes.has(taxMode)) {
    settings.tax_mode = taxMode;
  }
  const vatMode = url.searchParams.get("vatMode") as VatMode | null;
  if (vatMode && vatModes.has(vatMode)) {
    settings.vat_mode = vatMode;
  }

  const rows = await getEconomicsRows({ periodFrom, periodTo, settings });
  if (url.searchParams.get("format") === "xlsx") {
    const workbook = createEconomicsWorkbook(rows);
    const body = Uint8Array.from(workbook).buffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"ozon-unit-economics.xlsx\"",
      },
    });
  }

  return NextResponse.json({ rows, periodFrom, periodTo });
}

export async function PUT(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    offer_id?: string | null;
    barcode?: string | null;
    field?: string;
    value?: unknown;
  };

  if (!body.field || !editableManualKeys.has(body.field)) {
    return NextResponse.json({ error: "Field is not editable" }, { status: 400 });
  }

  const prismaField = prismaManualFieldMap[body.field];
  if (!prismaField) {
    return NextResponse.json({ error: "Field cannot be mapped" }, { status: 400 });
  }

  const product = await prisma.ozonProduct.findFirst({
    where: {
      OR: [
        ...(body.offer_id ? [{ offerId: body.offer_id }] : []),
        ...(body.barcode ? [{ barcode: body.barcode }] : []),
      ],
    },
  });

  const offerId = product?.offerId ?? body.offer_id ?? null;
  const barcode = product?.barcode ?? body.barcode ?? null;
  if (!offerId && !barcode) {
    return NextResponse.json({ error: "offer_id or barcode is required" }, { status: 400 });
  }

  const data: Prisma.ProductManualInputUncheckedCreateInput = {
    offerId,
    barcode,
    ozonProductId: product?.ozonProductId ?? null,
    source: "manual",
  };
  (data as Record<string, unknown>)[prismaField] = normalizeEditableValue(body.field, body.value);

  await prisma.productManualInput.upsert({
    where: offerId ? { offerId } : { barcode: barcode ?? "" },
    create: data,
    update: data,
  });

  return NextResponse.json({ ok: true });
}
