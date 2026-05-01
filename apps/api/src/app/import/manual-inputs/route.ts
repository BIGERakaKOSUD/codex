import { apiErrorResponse } from "@/lib/http/errors.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { isBodyTooLarge, isFileTooLarge, maxBodyBytes } from "@/lib/http/bodyLimit.ts";
import { importManualRows, parseSpreadsheet } from "@/lib/importExport/manualImport.ts";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (isBodyTooLarge(request)) {
      return corsJson(request, { error: `Файл слишком большой. Лимит: ${Math.round(maxBodyBytes() / 1024 / 1024)} MB.` }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return corsJson(request, { error: "File is required" }, { status: 400 });
    }

    if (isFileTooLarge(file)) {
      return corsJson(request, { error: `Файл слишком большой. Лимит: ${Math.round(maxBodyBytes() / 1024 / 1024)} MB.` }, { status: 413 });
    }

    const rows = await parseSpreadsheet(await file.arrayBuffer(), file.name);
    const result = await importManualRows(rows);
    return corsJson(request, result);
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
