import { NextResponse } from "next/server";
import { isWildcardCorsOrigin, normalizeCorsOrigin } from "./security.ts";

const localOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"];

function allowedOrigins(): string[] {
  const rawConfigured = process.env.CORS_ALLOWED_ORIGIN ?? "";
  if (isWildcardCorsOrigin(rawConfigured)) {
    console.error("CORS wildcard origin is not allowed. Configure CORS_ALLOWED_ORIGIN with exact frontend URL.");
  }

  const configured = rawConfigured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== "*")
    .map(normalizeCorsOrigin);

  return [...new Set([...localOrigins, ...configured])];
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };

  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function corsJson(request: Request, body: unknown, init: ResponseInit = {}): Response {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...(init.headers ?? {}),
    },
  });
}

export function corsResponse(request: Request, body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...(init.headers ?? {}),
    },
  });
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
