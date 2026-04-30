import { NextResponse } from "next/server";
import { importManualRows, parseSpreadsheet } from "@/lib/importExport/manualImport.ts";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const rows = await parseSpreadsheet(await file.arrayBuffer(), file.name);
  const result = await importManualRows(rows);
  return NextResponse.json(result);
}
