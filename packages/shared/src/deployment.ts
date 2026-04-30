export function normalizeBackendApiUrl(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export function isForbiddenFrontendOzonUrl(value: string | null | undefined): boolean {
  const normalized = normalizeBackendApiUrl(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return url.hostname === "api-seller.ozon.ru";
  } catch {
    return normalized.includes("api-seller.ozon.ru");
  }
}

export function buildBackendEndpoint(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBackendApiUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!normalizedBase) {
    throw new Error("Backend API URL is empty");
  }

  if (isForbiddenFrontendOzonUrl(normalizedBase)) {
    throw new Error("Direct Ozon Seller API URL is not allowed in frontend mode");
  }

  return `${normalizedBase}${normalizedPath}`;
}
