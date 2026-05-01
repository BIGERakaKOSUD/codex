import { NextResponse, type NextRequest } from "next/server";
import { defaultMaxBodyBytes } from "./lib/http/bodyLimit.ts";
import { clientIpFromRequest, isWildcardCorsOrigin } from "./lib/http/security.ts";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimitWindowMs(): number {
  const value = Number(process.env.RATE_LIMIT_WINDOW_MS);
  return Number.isFinite(value) && value > 0 ? value : 60_000;
}

function rateLimitMaxRequests(): number {
  const value = Number(process.env.RATE_LIMIT_MAX_REQUESTS);
  return Number.isFinite(value) && value > 0 ? value : 120;
}

function maxBodyBytes(): number {
  const value = Number(process.env.MAX_BODY_BYTES);
  return Number.isFinite(value) && value > 0 ? value : defaultMaxBodyBytes;
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function middleware(request: NextRequest): NextResponse {
  if (process.env.NODE_ENV === "production" && isWildcardCorsOrigin(process.env.CORS_ALLOWED_ORIGIN)) {
    return jsonError("CORS wildcard is not allowed in production.", 500);
  }

  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes()) {
      return jsonError("Request body is too large.", 413);
    }
  }

  const now = Date.now();
  const ip = clientIpFromRequest(request);
  const key = `${ip}:${request.nextUrl.pathname}`;
  const current = rateBuckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : {
          count: 0,
          resetAt: now + rateLimitWindowMs(),
        };

  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (bucket.count > rateLimitMaxRequests()) {
    return jsonError("Too many requests. Try again later.", 429);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
