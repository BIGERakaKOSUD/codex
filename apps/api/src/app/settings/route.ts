import { prisma } from "@/lib/db.ts";
import { corsJson, optionsResponse } from "@/lib/http/cors.ts";
import { apiErrorResponse } from "@/lib/http/errors.ts";
import { validateSettingsUpdate } from "@/lib/http/validation.ts";
import { isOzonCredentialsConfigured } from "@/lib/ozon/client.ts";
import type { Prisma } from "@prisma/client";

const settingsKey = "app";

export function OPTIONS(request: Request): Response {
  return optionsResponse(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: settingsKey } });

    return corsJson(request, {
      ok: true,
      service: "ozon-unit-economics-api",
      settings: row?.value ?? {},
      backend: {
        ozonCredentialsConfigured: isOzonCredentialsConfigured(),
        ozonApiBaseUrlConfigured: Boolean(process.env.OZON_API_BASE_URL),
        corsAllowedOrigin: process.env.CORS_ALLOWED_ORIGIN ?? "",
        maxBodyBytes: Number(process.env.MAX_BODY_BYTES ?? 10 * 1024 * 1024),
        rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
        rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
      },
    });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const settings = validateSettingsUpdate(await request.json().catch(() => ({})));
    const value = JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue;

    await prisma.appSetting.upsert({
      where: { key: settingsKey },
      create: { key: settingsKey, value },
      update: { value },
    });

    return corsJson(request, { ok: true, settings });
  } catch (error) {
    return apiErrorResponse(request, error);
  }
}
