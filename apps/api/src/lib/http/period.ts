export interface Period {
  periodFrom: Date;
  periodTo: Date;
}

export function parsePeriod(searchParams: URLSearchParams): Period {
  const now = new Date();
  const preset = searchParams.get("period") ?? "last30";
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");

  if (preset === "custom" && customFrom && customTo) {
    return { periodFrom: new Date(customFrom), periodTo: new Date(customTo) };
  }

  if (preset === "last7") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { periodFrom: from, periodTo: now };
  }

  if (preset === "currentMonth") {
    return { periodFrom: new Date(now.getFullYear(), now.getMonth(), 1), periodTo: now };
  }

  if (preset === "previousMonth") {
    return {
      periodFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      periodTo: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    };
  }

  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return { periodFrom: from, periodTo: now };
}

export function parsePeriodFromBody(body: unknown): Period {
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const from = typeof data.from === "string" ? new Date(data.from) : null;
  const to = typeof data.to === "string" ? new Date(data.to) : null;
  if (from && to && Number.isFinite(from.getTime()) && Number.isFinite(to.getTime())) {
    return { periodFrom: from, periodTo: to };
  }

  const now = new Date();
  const fallbackFrom = new Date(now);
  fallbackFrom.setDate(fallbackFrom.getDate() - 30);
  return { periodFrom: fallbackFrom, periodTo: now };
}
