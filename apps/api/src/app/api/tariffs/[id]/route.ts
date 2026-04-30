import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json()) as { active?: boolean };
  const versionId = Number(id);
  if (!Number.isFinite(versionId)) {
    return NextResponse.json({ error: "Invalid tariff version id" }, { status: 400 });
  }

  if (body.active) {
    await prisma.$transaction([
      prisma.tariffVersion.updateMany({ data: { active: false } }),
      prisma.tariffVersion.update({ where: { id: versionId }, data: { active: true } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
