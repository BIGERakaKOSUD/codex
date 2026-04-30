import { OzonApiClient } from "./client.ts";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ReportLoaderOptions {
  createEndpoint: string;
  statusEndpoint: string;
  downloadEndpoint?: string;
  body: Record<string, unknown>;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export async function loadOzonReport(
  options: ReportLoaderOptions,
  client = new OzonApiClient(),
): Promise<{ reportCode: string; fileUrl: string | null; content: string | null }> {
  const createResponse = asObject(await client.request<unknown>(options.createEndpoint, options.body));
  const reportCode = String(asObject(createResponse.result).code ?? createResponse.code ?? "");
  if (!reportCode) {
    throw new Error("Ozon report code was not returned");
  }

  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pollIntervalMs = options.pollIntervalMs ?? 3_000;

  while (Date.now() - startedAt < timeoutMs) {
    const statusResponse = asObject(await client.request<unknown>(options.statusEndpoint, { code: reportCode }));
    const result = asObject(statusResponse.result);
    const status = String(result.status ?? statusResponse.status ?? "").toLowerCase();
    const fileUrl = typeof result.file === "string" ? result.file : typeof result.file_url === "string" ? result.file_url : null;

    if (status === "success" || status === "done" || fileUrl) {
      if (!options.downloadEndpoint || fileUrl?.startsWith("http")) {
        const content = fileUrl ? await fetch(fileUrl).then((response) => response.text()) : null;
        return { reportCode, fileUrl, content };
      }

      const downloadResponse = asObject(await client.request<unknown>(options.downloadEndpoint, { code: reportCode }));
      return {
        reportCode,
        fileUrl,
        content: typeof downloadResponse.content === "string" ? downloadResponse.content : JSON.stringify(downloadResponse),
      };
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Ozon report failed: ${reportCode}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Ozon report polling timed out: ${reportCode}`);
}
