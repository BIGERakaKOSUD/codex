import { NextResponse } from "next/server";
import { OzonApiError } from "@/lib/ozon/client.ts";
import { syncOzonProducts } from "@/lib/ozon/sync.ts";

export async function POST(): Promise<Response> {
  try {
    const result = await syncOzonProducts();
    return NextResponse.json(result);
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
