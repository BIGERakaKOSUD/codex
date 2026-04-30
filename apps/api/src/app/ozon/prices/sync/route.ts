import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { syncOzonProducts } from "@/lib/ozon/sync.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await syncOzonProducts();
    return corsJson(request, { ...result, scope: "prices" });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
