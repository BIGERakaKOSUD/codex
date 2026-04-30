import { parsePeriod } from "@/lib/http/period.ts";
import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsResponse, optionsResponse } from "@/lib/http/cors.ts";
import { createEconomicsWorkbook } from "@/lib/importExport/exportEconomics.ts";
import { getEconomicsRows } from "@/lib/economicsService.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const period = parsePeriod(new URL(request.url).searchParams);
    const rows = await getEconomicsRows(period);
    const workbook = createEconomicsWorkbook(rows);
    const body = Uint8Array.from(workbook).buffer;
    return corsResponse(request, body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"ozon-unit-economics.xlsx\"",
      },
    });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
