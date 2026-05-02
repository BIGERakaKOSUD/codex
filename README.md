# Ozon Unit Economics Calculator

Калькулятор юнит-экономики Ozon: импортирует ручные данные из Excel/CSV, подтягивает данные Ozon через backend, считает прибыль, ROI, маржинальность, налоги и долю расходов по SKU.

Структура:

- `apps/web` - frontend, статический export для GitHub Pages.
- `apps/api` - backend REST API для локального запуска и VPS через Docker Compose.
- `packages/unit-economics` - расчетный engine без зависимости от frontend/backend.
- `packages/shared` - общие типы, DTO и описания колонок.

## Как открыть frontend

GitHub Pages:

```text
https://bigerakakosud.github.io/codex/
https://bigerakakosud.github.io/codex/ozon-unit-economics/
```

Локально:

```bash
npm install
npm run dev:web
```

Открыть:

```text
http://localhost:3000/ozon-unit-economics/
```

## Static Mode

Static Mode работает без backend:

- импорт Excel/CSV;
- ручное редактирование;
- расчет прямо в браузере;
- экспорт Excel;
- backup JSON;
- данные хранятся локально в браузере.

В Static Mode синхронизация с Ozon API недоступна.

## API Mode

API Mode работает через backend URL:

```text
http://localhost:3001
https://api.example.ru
```

Frontend хранит только backend URL. Он не принимает, не хранит и не отправляет `OZON_CLIENT_ID` и `OZON_API_KEY`.

## Почему нельзя вставлять Ozon keys во frontend

GitHub Pages - публичный статический хостинг. Любые `NEXT_PUBLIC_*` переменные попадают в browser bundle. Если положить туда `OZON_API_KEY`, его можно будет увидеть в DevTools, network requests или исходниках сайта.

Правильная схема:

```text
browser -> backend -> Ozon Seller API
```

Ozon credentials должны быть только в backend env.

## Локальный backend

Backend слушает `http://localhost:3001`.

Создать env:

```bash
copy apps\api\.env.example apps\api\.env.local
```

Для локальной БД используйте PostgreSQL. Можно поднять тот же stack через Docker Compose:

```bash
copy .env.production.example .env.production
notepad .env.production
docker compose up -d --build
```

Проверить:

```bash
curl http://localhost:3001/health
```

Ожидаемый ответ:

```json
{"ok":true,"service":"ozon-unit-economics-api"}
```

Если backend запускается без Docker:

```bash
npm run prisma:generate
npm run dev:api
```

## Ozon API keys

Получите `Client-Id` и `Api-Key` в кабинете продавца Ozon.

Ключи вставляются только в backend env:

```env
OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
```

Не добавляйте эти значения в `NEXT_PUBLIC_*`, frontend, localStorage или GitHub Secrets для Pages build.

## Подключить frontend к backend

1. Откройте `/ozon-unit-economics/`.
2. Выберите `API / Backend`.
3. Введите backend URL:

```text
http://localhost:3001
```

или production:

```text
https://api.example.ru
```

4. Нажмите "Проверить подключение".
5. После статуса `connected` станут доступны кнопки синхронизации Ozon.

## Backend endpoints

```text
GET  /health
GET  /settings
PUT  /settings
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

Если Ozon credentials пустые, sync endpoints возвращают понятную ошибку и backend не падает.

## VPS backend

Основной production вариант: Ubuntu VPS + Docker Compose + PostgreSQL + Nginx + HTTPS.

```bash
git clone https://github.com/BIGERakaKOSUD/codex.git
cd codex
cp .env.production.example .env.production
nano .env.production
docker compose up -d --build
curl http://localhost:3001/health
```

Важно для GitHub Pages:

```env
CORS_ALLOWED_ORIGIN=https://bigerakakosud.github.io
```

Не используйте `/codex` в `CORS_ALLOWED_ORIGIN`: browser Origin не содержит path.

Подробно: [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md).

## GitHub Pages build

Workflow `.github/workflows/deploy-pages.yml` собирает только frontend и публикует `apps/web/out`.

Pages env:

```env
NEXT_PUBLIC_BASE_PATH=/codex
NEXT_PUBLIC_API_BASE_URL=
```

Можно задать постоянный backend:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.ru
```

Нельзя задавать во frontend:

```env
OZON_CLIENT_ID
OZON_API_KEY
DATABASE_URL
```

## Импорт Excel/CSV

Основной ключ сопоставления:

```text
Артикул = offer_id
```

Второй ключ:

```text
ШК = barcode
```

Если товар из файла не найден в Ozon-данных, он добавляется как manual-only строка.

## Экспорт Excel

Кнопка "Экспорт в Excel" выгружает ручные, импортированные, API и расчетные поля.

## Команды

```bash
npm install
npm run dev:web
npm run dev:api
npm run build:web
npm run build:api
npm run build:pages
npm run lint
npm run typecheck
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
```

## Типичные ошибки

- `Backend недоступен` - проверьте backend URL и `/health`.
- `CORS` error - проверьте `CORS_ALLOWED_ORIGIN`; для Pages нужно `https://bigerakakosud.github.io`.
- `Ozon API credentials are missing on backend` - заполните `OZON_CLIENT_ID` и `OZON_API_KEY` на backend.
- `docker compose up` не стартует - проверьте `POSTGRES_PASSWORD` и `DATABASE_URL`.
- На GitHub Pages виден Static Mode - это нормально, если backend URL не задан.
