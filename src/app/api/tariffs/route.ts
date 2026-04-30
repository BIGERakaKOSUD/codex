import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { importTariffVersion } from "@/lib/importExport/tariffImport.ts";

export async function GET(): Promise<Response> {
  const versions = await prisma.tariffVersion.findMany({
    orderBy: { createdAt: "desc" },
    include: { rules: true },
  });
  return NextResponse.json({ versions });
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const result = await importTariffVersion({
    file: await file.arrayBuffer(),
    fileName: file.name,
    name: String(formData.get("name") ?? file.name),
    sourceUrl: formData.get("sourceUrl") ? String(formData.get("sourceUrl")) : null,
    effectiveFrom: formData.get("effectiveFrom") ? new Date(String(formData.get("effectiveFrom"))) : null,
    effectiveTo: formData.get("effectiveTo") ? new Date(String(formData.get("effectiveTo"))) : null,
    activate: formData.get("activate") === "true",
  });
  return NextResponse.json(result);
}
