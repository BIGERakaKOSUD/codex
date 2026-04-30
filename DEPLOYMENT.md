# Deployment Guide

## 1. Frontend On GitHub Pages

1. Create or open the GitHub repository.
2. Push this project to `main`.
3. Open repository `Settings -> Pages`.
4. Set `Source` to `GitHub Actions`.
5. Confirm that `.github/workflows/deploy-pages.yml` exists.
6. For a repository URL like `https://username.github.io/repository-name/`, set:

```env
NEXT_PUBLIC_BASE_PATH=/repository-name
```

For `BIGERakaKOSUD/codex`, the workflow uses:

```env
NEXT_PUBLIC_BASE_PATH=/codex
```

7. Push to `main`.
8. Wait for the `Deploy GitHub Pages` workflow.
9. Open the Pages URL.

Static mode works immediately after deploy. Ozon API sync is disabled until a backend URL is configured.

## 2. Backend On Vercel

1. Import the GitHub repository into Vercel.
2. Set Root Directory to `apps/api`.
3. Build command:

```bash
npm install && npm run prisma:generate && npm run build
```

4. Start command is handled by Vercel Functions.
5. Add environment variables:

```env
OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
DATABASE_URL=
CORS_ALLOWED_ORIGIN=https://username.github.io/repository-name
```

6. Deploy.
7. Copy the backend URL, for example:

```text
https://your-backend-domain.vercel.app
```

8. Open the frontend, switch to `API / Backend`, paste the backend URL, and click `Проверить подключение`.

## 3. Backend On Render Or Railway

Use the whole repository or `apps/api` as the service root.

Build command:

```bash
npm install && npm run prisma:generate && npm run build -w apps/api
```

Start command:

```bash
npm run start -w apps/api
```

Environment variables:

```env
OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
DATABASE_URL=
CORS_ALLOWED_ORIGIN=https://username.github.io/repository-name
```

For production, use PostgreSQL for `DATABASE_URL`. SQLite is intended for local development.

## 4. Verification

1. Open the frontend Pages URL.
2. Confirm Static mode status:
   - `GitHub Pages mode`
   - `Ozon API: disabled`
   - `Import Excel: enabled`
   - `Export Excel: enabled`
3. Import Excel/CSV and confirm calculations appear.
4. Export Excel.
5. Switch to `API / Backend`.
6. Paste backend URL.
7. Click `Проверить подключение`.
8. Click `Синхронизировать товары Ozon`.

If the backend is unavailable, the frontend will show:

```text
Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.
```

If Ozon credentials are wrong, the backend will return:

```text
Ozon API returned an authorization error. Check OZON_CLIENT_ID and OZON_API_KEY on the backend.
```

## 5. Security Checklist

- Do not commit `.env`.
- Do not put `OZON_API_KEY` into frontend code.
- Do not use `localStorage` for Ozon credentials.
- Do not set production CORS to `*`.
- Set `CORS_ALLOWED_ORIGIN` to the exact frontend URL.
- Keep Ozon requests inside `apps/api`.
