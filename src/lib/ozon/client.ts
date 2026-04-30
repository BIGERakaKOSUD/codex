type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

export interface OzonClientOptions {
  baseUrl?: string;
  clientId?: string;
  apiKey?: string;
  minIntervalMs?: number;
  maxRetries?: number;
}

export class OzonApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    public readonly responseBody: unknown,
  ) {
    super(message);
    this.name = "OzonApiError";
  }
}

let nextAllowedRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeErrorBody(body: unknown): unknown {
  if (!body || typeof body !== "object") {
    return body;
  }

  const clone = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
  for (const key of Object.keys(clone)) {
    if (key.toLowerCase().includes("api") || key.toLowerCase().includes("key") || key.toLowerCase().includes("secret")) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

export function normalizeMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function chunkDateRange(from: Date, to: Date, maxDays = 31): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);

  while (cursor < to) {
    const chunkTo = new Date(cursor);
    chunkTo.setDate(chunkTo.getDate() + maxDays);
    const actualTo = chunkTo < to ? chunkTo : new Date(to);
    chunks.push({ from: new Date(cursor), to: actualTo });
    cursor = new Date(actualTo);
    cursor.setMilliseconds(cursor.getMilliseconds() + 1);
  }

  return chunks;
}

export class OzonApiClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly apiKey: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;

  constructor(options: OzonClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.OZON_API_BASE_URL ?? "https://api-seller.ozon.ru").replace(/\/$/, "");
    this.clientId = options.clientId ?? process.env.OZON_CLIENT_ID ?? "";
    this.apiKey = options.apiKey ?? process.env.OZON_API_KEY ?? "";
    this.minIntervalMs = options.minIntervalMs ?? 150;
    this.maxRetries = options.maxRetries ?? 4;

    if (!this.clientId || !this.apiKey) {
      throw new OzonApiError("Ozon API credentials are missing", 401, "credentials", null);
    }
  }

  async request<T>(endpoint: string, body: JsonObject = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const waitForRateLimit = Math.max(0, nextAllowedRequestAt - Date.now());
      if (waitForRateLimit > 0) {
        await sleep(waitForRateLimit);
      }
      nextAllowedRequestAt = Date.now() + this.minIntervalMs;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Client-Id": this.clientId,
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (response.ok) {
        return payload as T;
      }

      const retriable = response.status === 429 || response.status >= 500;
      if (retriable && attempt < this.maxRetries) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
        console.error("Ozon API retry", {
          endpoint,
          status: response.status,
          attempt: attempt + 1,
          body: sanitizeErrorBody(payload),
        });
        await sleep(delay);
        attempt += 1;
        continue;
      }

      console.error("Ozon API error", {
        endpoint,
        status: response.status,
        body: sanitizeErrorBody(payload),
      });
      throw new OzonApiError(`Ozon API request failed: ${endpoint}`, response.status, endpoint, sanitizeErrorBody(payload));
    }

    throw new OzonApiError(`Ozon API request failed after retries: ${endpoint}`, 500, endpoint, null);
  }

  async paginateLastId<TItem>(
    endpoint: string,
    createBody: (lastId: string) => JsonObject,
    extract: (response: unknown) => { items: TItem[]; lastId: string | null; total?: number | null },
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let lastId = "";

    while (true) {
      const response = await this.request<unknown>(endpoint, createBody(lastId));
      const page = extract(response);
      items.push(...page.items);
      if (!page.lastId || page.lastId === lastId || page.items.length === 0) {
        break;
      }
      lastId = page.lastId;
    }

    return items;
  }

  async paginateOffset<TItem>(
    endpoint: string,
    createBody: (offset: number) => JsonObject,
    extract: (response: unknown) => { items: TItem[]; hasNext: boolean },
    limit: number,
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let offset = 0;

    while (true) {
      const response = await this.request<unknown>(endpoint, createBody(offset));
      const page = extract(response);
      items.push(...page.items);
      if (!page.hasNext || page.items.length === 0) {
        break;
      }
      offset += limit;
    }

    return items;
  }
}
