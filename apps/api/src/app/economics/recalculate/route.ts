import { parsePeriodFromBody } from "@/lib/http/period.ts";
import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { getEconomicsRows } from "@/lib/economicsService.ts";
import { prisma } from "@/lib/db.ts";
import type { Prisma } from "@prisma/client";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const period = parsePeriodFromBody(await request.json().catch(() => ({})));
    const rows = await getEconomicsRows(period);
    await prisma.calculationSnapshot.createMany({
      data: rows.map((row) => ({
        periodFrom: period.periodFrom,
        periodTo: period.periodTo,
        offerId: typeof row.values.offer_id === "string" ? row.values.offer_id : null,
        ozonProductId: typeof row.values.product_id === "string" ? row.values.product_id : null,
        inputJson: { sourceMap: row.sourceMap } as Prisma.InputJsonValue,
        resultJson: { values: row.values, warnings: row.warnings, errors: row.errors } as Prisma.InputJsonValue,
      })),
    });
    return corsJson(request, { rows, ...period });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
