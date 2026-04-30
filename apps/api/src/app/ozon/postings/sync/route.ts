import { parsePeriodFromBody } from "@/lib/http/period.ts";
import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { loadOzonPostings } from "@/lib/ozon/sync.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const period = parsePeriodFromBody(await request.json().catch(() => ({})));
    const [fbs, fbo] = await Promise.all([
      loadOzonPostings("FBS", period.periodFrom, period.periodTo),
      loadOzonPostings("FBO", period.periodFrom, period.periodTo),
    ]);
    return corsJson(request, { fbsPostings: fbs.postings, fboPostings: fbo.postings });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
