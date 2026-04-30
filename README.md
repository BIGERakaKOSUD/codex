# Ozon Unit Economics

Local Ozon Seller API unit-economics calculator for products, prices, stocks, postings, finance operations, manual costs, tariff versions, and XLSX export.

## Install

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open `http://localhost:3000`.

## Environment

```env
DATABASE_URL="file:./dev.db"
OZON_CLIENT_ID="..."
OZON_API_KEY="..."
OZON_API_BASE_URL="https://api-seller.ozon.ru"
```

API keys are used only in server route handlers and are never sent to the frontend.

## Ozon Sync

On the `Ozon Unit Economics` page, click `Sync products from Ozon`.

The client in `src/lib/ozon/client.ts` sends all Ozon requests with:

- `Client-Id`
- `Api-Key`
- `Content-Type: application/json`

It supports retry for `429/5xx`, simple rate-limit protection, `last_id` and `offset` pagination, and period chunking for finance operations.

Implemented endpoints are in `src/lib/ozon/sync.ts`:

- `/v3/product/list`
- `/v3/product/info/list`
- `/v4/product/info/attributes`
- `/v4/product/info/stocks`
- `/v5/product/info/prices`
- `/v2/posting/fbo/list`
- `/v3/posting/fbs/list`
- `/v3/finance/transaction/list`

If Ozon does not return a field, the value remains `null` and the source map marks it as `missing`.

## Manual Excel/CSV Import

Click `Import manual data from Excel/CSV` on the calculator page.

Primary match key: `Artikul` / `Артикул` -> `offer_id`.
Secondary match key: `Barcode` / `ШК` -> `barcode`.

If a row is not found in API products, the app creates a manual-only product row. If several products match, the import returns a conflict.

## Calculation

Calculation engine:

```text
src/lib/unitEconomics/calculateOzonUnitEconomics.ts
```

It accepts normalized product data, manual inputs, tariff rule, actual finance aggregates, and settings. It returns:

- all calculated fields;
- warnings;
- errors;
- source map per field.

Settings:

- `use_actual_finance_data`
- `tax_mode`
- `vat_mode`
- `calculation_basis`
- `include_express_in_logistics`
- `include_storage_in_marketplace_expenses`
- `include_reviews_in_total_expenses`
- `include_self_purchase_in_total_expenses`

## Tariffs

The `Tariffs` page supports JSON/CSV/XLSX import, active version selection, and manual editing for:

- commission;
- direct logistics;
- reverse logistics;
- storage;
- acceptance;
- pickup-point delivery.

Tariffs are not hardcoded in formulas. Active tariff versions are stored in `tariff_versions` and `tariff_rules`.

## Field Sources

Every field has one source:

- `api` - returned by Ozon API;
- `manual` - edited in the table;
- `imported` - imported from Excel/CSV;
- `formula` - calculated;
- `missing` - not available.

## Export

Click `Export to Excel` to download all manual and calculated columns as `.xlsx`.

## Tests

```bash
npm test
```

Formula tests cover:

- 100% buyout;
- 70% buyout with returns;
- negative profit;
- missing cost price;
- missing volume;
- `buyout_percent = 0`;
- promo discount;
- USN income;
- USN income minus expenses;
- VAT included in price;
- annual ROI;
- no double-counted expenses.

## API And Tariff Notes

Public Ozon documentation was checked before implementation:

- Seller API uses `Client-Id` and `Api-Key`.
- FBS postings are available through `POST /v3/posting/fbs/list`.
- `POST /v3/finance/transaction/list` returns accrual operations and should be requested in period chunks.
- Ozon tariffs change by effective dates, so tariffs are imported as versions instead of being hardcoded.
