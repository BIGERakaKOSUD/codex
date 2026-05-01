import { OzonApiError } from "@/lib/ozon/client.ts";
import { corsJson } from "./cors.ts";
import { RequestValidationError } from "./validation.ts";

export function apiErrorResponse(request: Request, error: unknown): Response {
  if (error instanceof RequestValidationError) {
    return corsJson(request, { error: error.message }, { status: 400 });
  }

  if (error instanceof OzonApiError) {
    if (error.status === 401 || error.status === 403) {
      return corsJson(
        request,
        {
          error: "Ozon API returned an authorization error. Check OZON_CLIENT_ID and OZON_API_KEY on the backend.",
          status: error.status,
          endpoint: error.endpoint,
        },
        { status: error.status },
      );
    }

    return corsJson(
      request,
      { error: error.message, status: error.status, endpoint: error.endpoint, responseBody: error.responseBody },
      { status: error.status >= 400 && error.status < 600 ? error.status : 500 },
    );
  }

  return corsJson(
    request,
    { error: error instanceof Error ? error.message : "Unknown backend error" },
    { status: 500 },
  );
}
