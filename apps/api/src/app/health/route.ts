import { corsJson, optionsResponse } from "@/lib/http/cors.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export function GET(request: Request): Response {
  return corsJson(request, {
    ok: true,
    service: "ozon-unit-economics-api",
  });
}
