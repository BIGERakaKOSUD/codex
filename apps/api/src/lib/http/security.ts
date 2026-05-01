const secretKeyPattern = /(api[-_]?key|secret|token|password|authorization|cookie)/i;
const clientIdKeyPattern = /^(client[-_]?id|clientid|Client-Id)$/i;

export function maskSecret(value: unknown): string {
  if (typeof value !== "string" || value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[truncated]";
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (secretKeyPattern.test(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }

    if (clientIdKeyPattern.test(key)) {
      sanitized[key] = maskSecret(child);
      continue;
    }

    sanitized[key] = sanitizeLogValue(child, depth + 1);
  }

  return sanitized;
}

export function isWildcardCorsOrigin(value: string | null | undefined): boolean {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .some((origin) => origin === "*");
}

export function normalizeCorsOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

export function clientIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
