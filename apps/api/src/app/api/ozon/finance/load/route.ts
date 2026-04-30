import { NextResponse } from "next/server";
import { parsePeriodFromBody } from "@/lib/http/period.ts";
import { OzonApiError } from "@/lib/ozon/client.ts";
import { loadOzonFinanceTransactions, loadOzonPostings } from "@/lib/ozon/sync.ts";

export async function POST(request: Request): Promise<Response> {
  try {
    const period = parsePeriodFromBody(await request.json().catch(() => ({})));
    const [finance, fbs, fbo] = await Promise.all([
      loadOzonFinanceTransactions(period.periodFrom, period.periodTo),
      loadOzonPostings("FBS", period.periodFrom, period.periodTo),
      loadOzonPostings("FBO", period.periodFrom, period.periodTo),
    ]);
    return NextResponse.json({ ...finance, fbsPostings: fbs.postings, fboPostings: fbo.postings });
  } catch (error) {
    if (error instanceof OzonApiError) {
      return NextResponse.json(
        { error: error.message, status: error.status, endpoint: error.endpoint, responseBody: error.responseBody },
        { status: error.status >= 400 && error.status < 600 ? error.status : 500 },
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
