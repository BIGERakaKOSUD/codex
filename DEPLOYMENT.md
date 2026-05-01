# Deployment

Проект деплоится двумя независимыми частями:

- frontend: GitHub Pages, только статические файлы из `apps/web/out`;
- backend: VPS + Docker Compose + PostgreSQL + Nginx.

Frontend никогда не обращается напрямую к Ozon Seller API и не содержит `OZON_CLIENT_ID` / `OZON_API_KEY`.

## 1. Frontend на GitHub Pages

1. Откройте GitHub repository `BIGERakaKOSUD/codex`.
2. Перейдите в `Settings -> Pages`.
3. В `Source` выберите `GitHub Actions`.
4. Проверьте, что workflow `.github/workflows/deploy-pages.yml` есть в ветке `main`.
5. Сделайте push в `main`.
6. Дождитесь workflow `Deploy GitHub Pages`.
7. Откройте:

```text
https://bigerakakosud.github.io/codex/
```

Страница калькулятора:

```text
https://bigerakakosud.github.io/codex/ozon-unit-economics/
```

Для GitHub Pages workflow использует:

```text
NEXT_PUBLIC_BASE_PATH=/codex
NEXT_PUBLIC_API_BASE_URL=
```

С пустым `NEXT_PUBLIC_API_BASE_URL` приложение стартует в Static Mode.

## 2. Backend на VPS

Основной backend deployment описан в [DEPLOYMENT_VPS.md](DEPLOYMENT_VPS.md).

Короткая схема:

```bash
git clone https://github.com/BIGERakaKOSUD/codex.git
cd codex
cp .env.production.example .env.production
nano .env.production
docker compose up -d
curl http://localhost:3001/health
```

После настройки Nginx и HTTPS backend будет доступен, например:

```text
https://api.your-domain.ru
```

## 3. Подключение frontend к backend

Есть два варианта:

1. Runtime: открыть GitHub Pages, выбрать `API / Backend`, ввести `https://api.your-domain.ru`, нажать "Проверить подключение". URL сохранится в браузере.
2. Build-time: задать `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.ru` в GitHub Actions env и пересобрать Pages.

Backend должен разрешать origin:

```text
CORS_ALLOWED_ORIGIN=https://bigerakakosud.github.io/codex
```

## 4. Проверка

Frontend:

```text
https://bigerakakosud.github.io/codex/ozon-unit-economics/
```

Backend:

```bash
curl https://api.your-domain.ru/health
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "service": "ozon-unit-economics-api"
}
```

## 5. Что нельзя делать

- Нельзя публиковать `OZON_API_KEY` во frontend env.
- Нельзя вводить Ozon ключи в браузере.
- Нельзя ставить `CORS_ALLOWED_ORIGIN=*` в production.
- Нельзя коммитить `.env.production`.
