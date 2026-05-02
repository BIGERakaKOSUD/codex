import test from "node:test";
import assert from "node:assert/strict";

import { economicsColumns, importColumnMap } from "../../packages/shared/src/fields.ts";

test("economics table uses Russian column labels", () => {
  const labels = economicsColumns.map((column) => column.label);

  assert.ok(labels.includes("ШК"));
  assert.ok(labels.includes("Артикул"));
  assert.ok(labels.includes("Себестоимость, руб."));
  assert.ok(labels.includes("Комиссия, руб."));
  assert.ok(labels.includes("Чистая прибыль на единицу товара, руб."));
  assert.equal(labels.includes("Barcode"), false);
  assert.equal(labels.includes("Cost price, RUB"), false);
});

test("Russian import aliases are readable UTF-8 strings", () => {
  assert.equal(importColumnMap["шк"], "barcode");
  assert.equal(importColumnMap["артикул"], "offer_id");
  assert.equal(importColumnMap["себестоимость, руб."], "cost_price");
  assert.equal(importColumnMap["розничная цена без акции, руб."], "retail_price_without_promo");
});
