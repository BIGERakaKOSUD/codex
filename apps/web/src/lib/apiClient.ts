import { buildBackendEndpoint, isForbiddenFrontendOzonUrl, normalizeBackendApiUrl } from "@ozon-unit-economics/shared";

export const apiBaseStorageKey = "ozon-unit-economics-api-base-url";

export function initialApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(apiBaseStorageKey) ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export function saveApiBaseUrl(value: string): string {
  const normalized = normalizeBackendApiUrl(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(apiBaseStorageKey, normalized);
  }
  return normalized;
}

export async function backendFetch(baseUrl: string, path: string, init?: RequestInit): Promise<Response> {
  const normalized = normalizeBackendApiUrl(baseUrl);
  if (!normalized) {
    throw new Error("Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
  }
  if (isForbiddenFrontendOzonUrl(normalized)) {
    throw new Error("Нельзя указывать Ozon Seller API напрямую. Подключите backend/proxy.");
  }

  return fetch(buildBackendEndpoint(normalized, path), init);
}
