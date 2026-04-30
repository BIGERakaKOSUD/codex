# Ozon Unit Economics Calculator

Marketplace unit-economics calculator for Ozon sellers. It calculates profit, ROI, margin, taxes, marketplace expense share, logistics, acquiring, advertising, and missing-data warnings per SKU.

## Project Structure

```text
apps/web                 Frontend, GitHub Pages compatible static export
apps/api                 Backend API/proxy, Ozon Seller API access, DB access
packages/unit-economics  Shared calculation engine and formulas
packages/shared          Shared DTOs, field sources, column definitions
```

## Two Runtime Modes

### 1. GitHub Pages / Static Mode

Static mode works without a backend:

- import Excel/CSV in the browser;
- edit manual fields in the table;
- calculate unit economics locally;
- persist data in `localStorage`;
- export result to Excel;
- download/upload backup JSON.

Ozon API sync is disabled in this mode. The browser never calls `https://api-seller.ozon.ru`.

### 2. Backend API Mode

The frontend can still be hosted on GitHub Pages, but it talks only to your backend:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-domain.com
```

The backend stores secrets and calls Ozon:

```env
OZON_CLIENT_ID=
OZON_API_KEY=
DATABASE_URL=
CORS_ALLOWED_ORIGIN=https://bigerakakosud.github.io/codex
```

Never put `OZON_CLIENT_ID` or `OZON_API_KEY` into frontend code, localStorage, GitHub Pages output, or a public repository.

## What The Calculator Does

- Loads products, prices, stocks, postings, and finance operations from Ozon through the backend.
- Imports manual costs from Excel/CSV.
- Matches imported data by `offer_id` first and `barcode` second.
- Keeps source map per field: `api`, `manual`, `imported`, `formula`, `missing`.
- Highlights negative profit, missing cost price, missing volume, missing commission, and low margin.
- Exports the final table to Excel.

## Local Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev:web
npm run dev:api
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:3001`

## Ozon API Setup

Set backend-only variables:

```env
OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
DATABASE_URL=file:./dev.db
CORS_ALLOWED_ORIGIN=http://localhost:3000
```

All Ozon requests are made by `apps/api` with:

- `Client-Id`
- `Api-Key`
- `Content-Type: application/json`

The frontend never receives these values.

## Backend Endpoints

```text
GET  /health
POST /ozon/products/sync
POST /ozon/prices/sync
POST /ozon/stocks/sync
POST /ozon/finance/sync
POST /ozon/postings/sync
GET  /economics/products
PUT  /economics/products
POST /economics/recalculate
POST /import/manual-inputs
GET  /export/excel
```

`GET /health` returns:

```json
{
  "ok": true,
  "service": "ozon-unit-economics-api"
}
```

## Fields From API

When available through Ozon Seller API:

- `offer_id`, `product_id`, `sku`, `barcode`, product name;
- category/category id;
- current price, old price, marketing/SPP price, min price;
- VAT when returned by API;
- dimensions, weight, calculated volume;
- stock and reserved stock;
- postings and statuses;
- finance service operations: commissions, acquiring, logistics, storage, advertising/marketing, adjustments.

If Ozon does not return a value, the app keeps it empty and marks the field as `missing`.

## Manual Fields

Fill these manually or import from Excel/CSV:

- cost price;
- inbound logistics;
- base commission override;
- product volume override;
- buyout, non-buyout, returns, cancellations;
- pickup delivery, Express, self-purchase, review points, storage;
- other and confirmed expenses;
- total DRR;
- retail price without promo;
- promo and discount;
- acquiring/co-invest percent;
- USN and VAT settings;
- manufacturer lead time, batch quantity, monthly sold quantity.

## Excel/CSV Import

Static mode imports locally in the browser. API mode uploads the file to backend endpoint `/import/manual-inputs`.

Match order:

1. `Артикул` / `Offer ID` -> `offer_id`
2. `ШК` / `Barcode` -> `barcode`

Rows not found in API products become manual-only rows.

## Export

Static mode exports from browser memory.
API mode downloads from backend endpoint `/export/excel`.

## GitHub Pages Deploy

The workflow `.github/workflows/deploy-pages.yml` runs on push to `main`:

1. installs dependencies;
2. runs lint;
3. runs typecheck;
4. runs tests;
5. builds `apps/web` as static output;
6. deploys `apps/web/out` to GitHub Pages.

For this repository the base path is:

```env
NEXT_PUBLIC_BASE_PATH=/codex
```

## Backend Deploy

Use Vercel, Render, Railway, Fly.io, or a VPS. Backend deployment details are in `DEPLOYMENT.md`.

## Why Browser Cannot Call Ozon Directly

Ozon Seller API requires `Client-Id` and `Api-Key`. If the browser calls Ozon directly, those secrets must be shipped to public frontend code or stored in localStorage. That exposes the seller account. For this reason, Ozon calls are allowed only from the backend/proxy.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build:pages
```
