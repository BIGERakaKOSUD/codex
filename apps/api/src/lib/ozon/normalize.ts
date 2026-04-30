import { normalizeMoney } from "./client.ts";
import type { NormalizedOzonProductApiData } from "@ozon-unit-economics/shared";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = normalizeMoney(value);
    if (number !== null) {
      return number;
    }
  }
  return null;
}

export interface RawProductBundle {
  listItem?: JsonObject;
  infoItem?: JsonObject;
  priceItem?: JsonObject;
  attributeItem?: JsonObject;
  stockItem?: JsonObject;
}

export interface NormalizedProductRecord {
  ozonProductId: string | null;
  sku: string | null;
  offerId: string | null;
  barcode: string | null;
  name: string | null;
  categoryId: string | null;
  categoryName: string | null;
  normalizedApi: NormalizedOzonProductApiData;
  raw: RawProductBundle;
}

export function normalizeProductBundle(bundle: RawProductBundle): NormalizedProductRecord {
  const list = bundle.listItem ?? {};
  const info = bundle.infoItem ?? {};
  const price = bundle.priceItem ?? {};
  const attrs = bundle.attributeItem ?? {};
  const stocks = bundle.stockItem ?? {};
  const dimensions = asObject(info.dimensions ?? attrs.dimensions);
  const priceInfo = asObject(price.price ?? price);
  const commissions = asObject(price.commissions);
  const stockInfo = asObject(stocks.stocks ?? stocks);
  const barcodeArray = asArray(info.barcodes ?? attrs.barcodes ?? info.barcode);
  const firstBarcode = firstString(info.barcode, attrs.barcode, barcodeArray[0]);

  return {
    ozonProductId: firstString(info.id, info.product_id, list.product_id, price.product_id, attrs.product_id, stocks.product_id),
    sku: firstString(info.sku, list.sku, price.sku, stocks.sku),
    offerId: firstString(info.offer_id, list.offer_id, price.offer_id, attrs.offer_id, stocks.offer_id),
    barcode: firstBarcode,
    name: firstString(info.name, attrs.name, list.name),
    categoryId: firstString(
      info.category_id,
      info.description_category_id,
      attrs.category_id,
      attrs.description_category_id,
      list.category_id,
    ),
    categoryName: firstString(info.category_name, attrs.category_name, attrs.type_name),
    normalizedApi: {
      current_price: firstNumber(priceInfo.price, price.price, info.price),
      old_price: firstNumber(priceInfo.old_price, price.old_price, info.old_price),
      marketing_price: firstNumber(priceInfo.marketing_price, price.marketing_price, priceInfo.marketing_seller_price),
      min_price: firstNumber(priceInfo.min_price, price.min_price),
      price_index: firstString(price.price_index, priceInfo.price_index),
      vat_percent: firstNumber(price.vat, price.vat_percent, info.vat, commissions.vat),
      width_mm: firstNumber(dimensions.width, info.width, attrs.width),
      height_mm: firstNumber(dimensions.height, info.height, attrs.height),
      depth_mm: firstNumber(dimensions.depth, dimensions.length, info.depth, attrs.depth),
      weight_g: firstNumber(dimensions.weight, info.weight, attrs.weight),
      volume_liters: firstNumber(dimensions.volume_liters, info.volume_liters, attrs.volume_liters),
      stock_total: firstNumber(stockInfo.present, stockInfo.available_stock_count, stocks.present, stocks.available_stock_count),
      stock_reserved: firstNumber(stockInfo.reserved, stocks.reserved),
    },
    raw: bundle,
  };
}

export function mergeByProductId(items: RawProductBundle[]): Map<string, RawProductBundle> {
  const map = new Map<string, RawProductBundle>();

  for (const item of items) {
    const id = firstString(
      item.listItem?.product_id,
      item.infoItem?.id,
      item.infoItem?.product_id,
      item.priceItem?.product_id,
      item.attributeItem?.product_id,
      item.stockItem?.product_id,
    );
    if (!id) {
      continue;
    }

    const current = map.get(id) ?? {};
    map.set(id, { ...current, ...item });
  }

  return map;
}
