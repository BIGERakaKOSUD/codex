import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const editable = new Set([
  "commissionPercent",
  "directLogisticsCost",
  "reverseLogisticsCost",
  "acceptanceCost",
  "storageCostPerDay",
  "pickupDeliveryCost",
  "minVolumeLiters",
  "maxVolumeLiters",
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const body = (await request.json()) as { field?: string; value?: unknown };
  const ruleId = Number(id);
  if (!Number.isFinite(ruleId) || !body.field || !editable.has(body.field)) {
    return NextResponse.json({ error: "Invalid tariff rule update" }, { status: 400 });
  }

  const parsedValue = body.value === "" || body.value === null ? null : Number(String(body.value).replace(",", "."));
  const value = typeof parsedValue === "number" && Number.isFinite(parsedValue) ? parsedValue : null;
  const data: Prisma.TariffRuleUpdateInput = {};
  (data as Record<string, unknown>)[body.field] = value;
  await prisma.tariffRule.update({
    where: { id: ruleId },
    data,
  });
  return NextResponse.json({ ok: true });
}
