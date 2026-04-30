import { parsePeriodFromBody } from "@/lib/http/period.ts";
import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { loadOzonFinanceTransactions } from "@/lib/ozon/sync.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const period = parsePeriodFromBody(await request.json().catch(() => ({})));
    const result = await loadOzonFinanceTransactions(period.periodFrom, period.periodTo);
    return corsJson(request, result);
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
