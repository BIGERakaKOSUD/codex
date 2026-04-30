import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { importManualRows, parseSpreadsheet } from "@/lib/importExport/manualImport.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return corsJson(request, { error: "File is required" }, { status: 400 });
    }

    const rows = await parseSpreadsheet(await file.arrayBuffer(), file.name);
    const result = await importManualRows(rows);
    return corsJson(request, result);
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
