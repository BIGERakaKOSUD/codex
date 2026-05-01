import { parsePeriod } from "@/lib/http/period.ts";
import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { getEconomicsRows } from "@/lib/economicsService.ts";
import { prisma } from "@/lib/db.ts";
import { prismaManualFieldMap } from "@/lib/importExport/manualImport.ts";
import { validateEditableProductUpdate } from "@/lib/http/validation.ts";
import type { Prisma } from "@prisma/client";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const period = parsePeriod(url.searchParams);
    const rows = await getEconomicsRows(period);
    return corsJson(request, { rows, ...period });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}

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

export async function PUT(request: Request): Promise<Response> {
  try {
    const body = validateEditableProductUpdate(await request.json().catch(() => ({})));

    const prismaField = prismaManualFieldMap[body.field];
    if (!prismaField) {
      return corsJson(request, { error: "Field cannot be mapped" }, { status: 400 });
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
      return corsJson(request, { error: "offer_id or barcode is required" }, { status: 400 });
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

    return corsJson(request, { ok: true });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
