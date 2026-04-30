import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { OzonApiClient, chunkDateRange, normalizeMoney } from "./client.ts";
import { mergeByProductId, normalizeProductBundle, type RawProductBundle } from "./normalize.ts";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as JsonObject[]) : [];
}

function iso(date: Date): string {
  return date.toISOString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function syncOzonProducts(client = new OzonApiClient()): Promise<{ products: number }> {
  const listItems = await client.paginateLastId<JsonObject>(
    "/v3/product/list",
    (lastId) => ({
      filter: { visibility: "ALL" },
      limit: 1000,
      last_id: lastId,
    }),
    (response) => {
      const result = asObject(asObject(response).result);
      return {
        items: asArray(result.items),
        lastId: typeof result.last_id === "string" ? result.last_id : null,
        total: typeof result.total === "number" ? result.total : null,
      };
    },
  );

  const productIds = listItems
    .map((item) => item.product_id)
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .map(String);

  const bundles = mergeByProductId(listItems.map((listItem) => ({ listItem })));

  for (const ids of chunk(productIds, 1000)) {
    const response = await client.request<unknown>("/v3/product/info/list", { product_id: ids });
    for (const item of asArray(asObject(response).items ?? asObject(asObject(response).result).items)) {
      const id = String(item.id ?? item.product_id ?? "");
      if (!id) {
        continue;
      }
      bundles.set(id, { ...(bundles.get(id) ?? {}), infoItem: item });
    }
  }

  for (const ids of chunk(productIds, 1000)) {
    const response = await client.request<unknown>("/v5/product/info/prices", {
      filter: { product_id: ids, visibility: "ALL" },
      limit: 1000,
    });
    for (const item of asArray(asObject(asObject(response).result).items ?? asObject(response).items)) {
      const id = String(item.product_id ?? "");
      if (!id) {
        continue;
      }
      bundles.set(id, { ...(bundles.get(id) ?? {}), priceItem: item });
    }
  }

  for (const ids of chunk(productIds, 1000)) {
    const response = await client.request<unknown>("/v4/product/info/attributes", {
      filter: { product_id: ids, visibility: "ALL" },
      limit: 1000,
    });
    for (const item of asArray(asObject(asObject(response).result).items ?? asObject(response).items)) {
      const id = String(item.id ?? item.product_id ?? "");
      if (!id) {
        continue;
      }
      bundles.set(id, { ...(bundles.get(id) ?? {}), attributeItem: item });
    }
  }

  const stockItems = await client.paginateLastId<JsonObject>(
    "/v4/product/info/stocks",
    (lastId) => ({
      filter: { visibility: "ALL" },
      limit: 1000,
      cursor: lastId,
    }),
    (response) => {
      const result = asObject(asObject(response).result);
      return {
        items: asArray(result.items),
        lastId: typeof result.cursor === "string" ? result.cursor : typeof result.last_id === "string" ? result.last_id : null,
      };
    },
  );

  for (const item of stockItems) {
    const id = String(item.product_id ?? "");
    if (!id) {
      continue;
    }
    bundles.set(id, { ...(bundles.get(id) ?? {}), stockItem: item });
  }

  let count = 0;
  for (const bundle of bundles.values()) {
    const normalized = normalizeProductBundle(bundle as RawProductBundle);
    if (!normalized.offerId && !normalized.ozonProductId) {
      continue;
    }

    const where: Prisma.OzonProductWhereUniqueInput = normalized.offerId
      ? { offerId: normalized.offerId }
      : { ozonProductId: normalized.ozonProductId ?? "" };

    await prisma.ozonProduct.upsert({
      where,
      create: {
        ozonProductId: normalized.ozonProductId,
        sku: normalized.sku,
        offerId: normalized.offerId,
        barcode: normalized.barcode,
        name: normalized.name,
        categoryId: normalized.categoryId,
        categoryName: normalized.categoryName,
        rawApiJson: toPrismaJson({
          normalizedApi: normalized.normalizedApi,
          raw: normalized.raw,
        }),
      },
      update: {
        ozonProductId: normalized.ozonProductId,
        sku: normalized.sku,
        barcode: normalized.barcode,
        name: normalized.name,
        categoryId: normalized.categoryId,
        categoryName: normalized.categoryName,
        rawApiJson: toPrismaJson({
          normalizedApi: normalized.normalizedApi,
          raw: normalized.raw,
        }),
      },
    });
    count += 1;
  }

  return { products: count };
}

export async function loadOzonFinanceTransactions(
  periodFrom: Date,
  periodTo: Date,
  client = new OzonApiClient(),
): Promise<{ transactions: number }> {
  let count = 0;

  for (const range of chunkDateRange(periodFrom, periodTo, 31)) {
    let page = 1;
    const pageSize = 1000;

    while (true) {
      const response = await client.request<unknown>("/v3/finance/transaction/list", {
        filter: {
          date: { from: iso(range.from), to: iso(range.to) },
          operation_type: [],
          posting_number: "",
          transaction_type: "all",
        },
        page,
        page_size: pageSize,
      });
      const result = asObject(asObject(response).result);
      const operations = asArray(result.operations);

      for (const operation of operations) {
        const services = asArray(operation.services);
        const products = asArray(operation.items ?? operation.products);
        const amount = normalizeMoney(operation.amount ?? operation.accruals_for_sale ?? operation.sale_commission) ?? 0;
        const posting = asObject(operation.posting);
        const operationId = String(operation.operation_id ?? operation.operation_id_str ?? `${operation.posting_number ?? ""}-${operation.operation_date ?? ""}`);
        const operationDate = new Date(String(operation.operation_date ?? operation.transaction_date ?? range.from.toISOString()));
        const operationType = typeof operation.operation_type === "string" ? operation.operation_type : null;
        const postingNumber = String(operation.posting_number ?? posting.posting_number ?? "");
        const productRows = products.length > 0 ? products : [{}];
        const serviceRows = services.length > 0 ? services : [{ name: operationType, price: amount }];

        for (const product of productRows) {
          for (const service of serviceRows) {
            const serviceName = typeof service.name === "string" ? service.name : typeof service.service_name === "string" ? service.service_name : operationType;
            await prisma.ozonFinanceTransaction.upsert({
              where: {
                operationId_serviceName_offerId_sku: {
                  operationId,
                  serviceName: serviceName ?? "",
                  offerId: typeof product.offer_id === "string" ? product.offer_id : "",
                  sku: product.sku === undefined || product.sku === null ? "" : String(product.sku),
                },
              },
              create: {
                operationId,
                operationType,
                operationDate,
                postingNumber,
                sku: product.sku === undefined || product.sku === null ? null : String(product.sku),
                offerId: typeof product.offer_id === "string" ? product.offer_id : null,
                ozonProductId: product.product_id === undefined || product.product_id === null ? null : String(product.product_id),
                serviceName,
                amount: normalizeMoney(service.price ?? service.amount ?? amount) ?? amount,
                rawApiJson: toPrismaJson(operation),
              },
              update: {
                operationType,
                operationDate,
                postingNumber,
                amount: normalizeMoney(service.price ?? service.amount ?? amount) ?? amount,
                rawApiJson: toPrismaJson(operation),
              },
            });
            count += 1;
          }
        }
      }

      const pageCount = Number(result.page_count ?? 0);
      const hasNext = pageCount > page || operations.length === pageSize;
      if (!hasNext) {
        break;
      }
      page += 1;
    }
  }

  return { transactions: count };
}

export async function loadOzonPostings(
  scheme: "FBS" | "FBO",
  periodFrom: Date,
  periodTo: Date,
  client = new OzonApiClient(),
): Promise<{ postings: number }> {
  const endpoint = scheme === "FBS" ? "/v3/posting/fbs/list" : "/v2/posting/fbo/list";
  const limit = 1000;
  const postings = await client.paginateOffset<JsonObject>(
    endpoint,
    (offset) => ({
      dir: "ASC",
      filter: { since: iso(periodFrom), to: iso(periodTo) },
      limit,
      offset,
      with: {
        analytics_data: true,
        financial_data: true,
        barcodes: true,
      },
    }),
    (response) => {
      const result = asObject(asObject(response).result);
      const items = asArray(result.postings ?? result.items);
      return { items, hasNext: Boolean(result.has_next) || items.length === limit };
    },
    limit,
  );

  let count = 0;
  for (const posting of postings) {
    const products = asArray(posting.products);
    const productRows = products.length > 0 ? products : [{}];

    for (const product of productRows) {
      const postingNumber = String(posting.posting_number ?? "");
      if (!postingNumber) {
        continue;
      }

      await prisma.ozonPosting.upsert({
        where: {
          postingNumber_scheme_offerId_sku: {
            postingNumber,
            scheme,
            offerId: typeof product.offer_id === "string" ? product.offer_id : "",
            sku: product.sku === undefined || product.sku === null ? "" : String(product.sku),
          },
        },
        create: {
          postingNumber,
          scheme,
          status: typeof posting.status === "string" ? posting.status : null,
          createdAt: posting.created_at ? new Date(String(posting.created_at)) : null,
          deliveredAt: posting.delivered_at ? new Date(String(posting.delivered_at)) : null,
          cancelledAt: posting.cancelled_at ? new Date(String(posting.cancelled_at)) : null,
          sku: product.sku === undefined || product.sku === null ? null : String(product.sku),
          offerId: typeof product.offer_id === "string" ? product.offer_id : null,
          quantity: Number(product.quantity ?? 1),
          price: normalizeMoney(product.price),
          rawApiJson: toPrismaJson(posting),
        },
        update: {
          status: typeof posting.status === "string" ? posting.status : null,
          createdAt: posting.created_at ? new Date(String(posting.created_at)) : null,
          deliveredAt: posting.delivered_at ? new Date(String(posting.delivered_at)) : null,
          cancelledAt: posting.cancelled_at ? new Date(String(posting.cancelled_at)) : null,
          quantity: Number(product.quantity ?? 1),
          price: normalizeMoney(product.price),
          rawApiJson: toPrismaJson(posting),
        },
      });
      count += 1;
    }
  }

  return { postings: count };
}
