# Ozon Unit Economics Calculator

Калькулятор юнит-экономики Ozon для расчета прибыли, ROI, маржинальности, налогов и доли расходов по SKU. Проект разделен на frontend, backend и общие пакеты:

- `apps/web` - статический frontend для GitHub Pages.
- `apps/api` - backend API для VPS/Docker Compose.
- `packages/unit-economics` - calculation engine и формулы.
- `packages/shared` - общие DTO, типы, колонки и helpers.

## Режимы работы

### Static Mode

Работает полностью в браузере и подходит для GitHub Pages без backend:

- импорт Excel/CSV с ручными данными;
- расчет юнит-экономики локально;
- ручное редактирование таблицы;
- экспорт результата в Excel;
- backup JSON и восстановление backup;
- данные хранятся в `localStorage`;
- Ozon API недоступен.

В этом режиме приложение не отправляет данные на сервер и не знает `OZON_CLIENT_ID` / `OZON_API_KEY`.

### API Mode

Frontend обращается только к вашему backend URL:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.ru
```

Backend уже обращается к Ozon Seller API и хранит credentials только в environment variables на VPS:

```text
OZON_CLIENT_ID=
OZON_API_KEY=
```

Нельзя подключать Ozon API напрямую из браузера: ключи окажутся в публичном bundle, localStorage, DevTools или сетевых запросах. Поэтому GitHub Pages frontend работает либо в Static Mode, либо через backend/proxy.

## GitHub Pages frontend

После деплоя frontend открывается по адресу:

```text
https://bigerakakosud.github.io/codex/
https://bigerakakosud.github.io/codex/ozon-unit-economics/
```

Workflow: `.github/workflows/deploy-pages.yml`.

Он запускает:

```bash
npm install
npm run prisma:generate
npm run lint
npm run typecheck
npm test
npm run build:pages
```

и публикует `apps/web/out`.

## Локальный запуск

Установить зависимости:

```bash
npm install
```

Создать локальный env:

```bash
copy .env.example .env.local
```

Для backend нужен PostgreSQL. Самый простой вариант - поднять его через Docker или использовать тот же compose-файл, что на VPS.

Сгенерировать Prisma Client:

```bash
npm run prisma:generate
```

Запустить frontend:

```bash
npm run dev:web
```

Frontend будет доступен на:

```text
http://localhost:3000/ozon-unit-economics/
```

Запустить backend:

```bash
npm run dev:api
```

Backend healthcheck:

```bash
curl http://localhost:3001/health
```

## Backend на VPS

Основной production deployment: Ubuntu VPS + Docker Compose + PostgreSQL + Nginx reverse proxy + HTTPS.

Минимальные команды на VPS:

```bash
git clone https://github.com/BIGERakaKOSUD/codex.git
cd codex
cp .env.production.example .env.production
nano .env.production
docker compose up -d
curl http://localhost:3001/health
```

Подробно: [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md).

## Backend endpoints

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

## Импорт Excel/CSV

Основной ключ сопоставления: `Артикул` = `offer_id`.

Второй ключ: `ШК` = `barcode`.

Если товар из файла не найден среди Ozon-товаров, он добавляется как manual-only строка. Если товар есть в API, но нет в файле, ручные поля остаются missing.

## Экспорт Excel

Кнопка "Экспорт в Excel" выгружает все API/manual/imported/formula поля, итоговые расходы, налоги, прибыль, ROI и маржинальность.

## Security checklist

- `.env`, `.env.local`, `.env.production` игнорируются Git.
- `OZON_API_KEY` и `OZON_CLIENT_ID` не используются в `apps/web`.
- Frontend хранит только backend URL и локальные строки калькулятора.
- CORS не использует `*` в production.
- Backend ограничивает размер body/import файлов.
- Backend валидирует входящие update-запросы через Zod.
- Ozon client маскирует secrets в logs.
- API контейнер опубликован только на `127.0.0.1:3001`; наружу его открывает Nginx.

## Типичные ошибки

- `Backend недоступен` - проверьте API URL в API Mode и `CORS_ALLOWED_ORIGIN` на backend.
- `Ozon API returned an authorization error` - проверьте `OZON_CLIENT_ID` и `OZON_API_KEY` на VPS.
- GitHub Pages показывает Static Mode - это нормально, если `NEXT_PUBLIC_API_BASE_URL` пустой.
- `docker compose up -d` не стартует - проверьте `.env.production`, пароль PostgreSQL и `DATABASE_URL`.
- Нет расчета прибыли - заполните себестоимость, цену, выкуп и объем вручную или через Excel/CSV.
