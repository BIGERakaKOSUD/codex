# Backend на VPS через Docker Compose

Эта инструкция разворачивает только backend. Frontend остается на GitHub Pages.

## 1. Купить VPS Ubuntu

Подойдет Ubuntu 22.04/24.04 с 1-2 CPU, 1-2 GB RAM и публичным IPv4. Для production лучше 2 GB RAM и swap.

## 2. Установить Docker и Docker Compose

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Перелогиньтесь в SSH, затем проверьте:

```bash
docker --version
docker compose version
```

## 3. Клонировать репозиторий

```bash
git clone https://github.com/BIGERakaKOSUD/codex.git
cd codex
```

## 4. Создать `.env.production`

```bash
cp .env.production.example .env.production
nano .env.production
```

Заполните:

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://ozon_user:strong_password@postgres:5432/ozon_unit_economics
OZON_CLIENT_ID=
OZON_API_KEY=
OZON_API_BASE_URL=https://api-seller.ozon.ru
CORS_ALLOWED_ORIGIN=https://bigerakakosud.github.io/codex
MAX_BODY_BYTES=10485760
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

POSTGRES_USER=ozon_user
POSTGRES_PASSWORD=strong_password
POSTGRES_DB=ozon_unit_economics
```

`POSTGRES_PASSWORD` должен совпадать с паролем в `DATABASE_URL`.

## 5. Запустить backend и PostgreSQL

```bash
docker compose up -d
docker compose ps
```

Compose поднимает:

- `postgres` с volume `postgres_data`;
- `api` на `127.0.0.1:3001`;
- healthchecks для PostgreSQL и API;
- внутреннюю Docker network `codex_backend`.

## 6. Проверить backend локально на VPS

```bash
curl http://localhost:3001/health
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "service": "ozon-unit-economics-api"
}
```

Логи:

```bash
docker compose logs -f api
docker compose logs -f postgres
```

## 7. Настроить Nginx

Установите Nginx:

```bash
sudo apt install -y nginx
```

Скопируйте пример:

```bash
sudo cp nginx.example.conf /etc/nginx/sites-available/ozon-unit-economics-api
sudo nano /etc/nginx/sites-available/ozon-unit-economics-api
```

Замените `api.your-domain.ru` на ваш домен.

Включите сайт:

```bash
sudo ln -s /etc/nginx/sites-available/ozon-unit-economics-api /etc/nginx/sites-enabled/ozon-unit-economics-api
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Подключить домен

В DNS добавьте `A` record:

```text
api.your-domain.ru -> VPS_IP
```

Проверьте:

```bash
curl http://api.your-domain.ru/health
```

## 9. Выпустить SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.ru
```

Проверьте автообновление:

```bash
sudo certbot renew --dry-run
```

## 10. Проверить HTTPS

```bash
curl https://api.your-domain.ru/health
```

## 11. Подключить backend к frontend

В GitHub Pages frontend:

1. Откройте `https://bigerakakosud.github.io/codex/ozon-unit-economics/`.
2. Переключите режим на `API / Backend`.
3. Введите:

```text
https://api.your-domain.ru
```

4. Нажмите "Проверить подключение".
5. Нажмите "Синхронизировать товары Ozon".

Для build-time значения можно задать в workflow:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.ru
```

после чего пересобрать GitHub Pages push'ем в `main`.

## 12. Обновление backend

```bash
git pull
docker compose up -d --build
docker compose logs -f api
```

## 13. Backup PostgreSQL

```bash
docker compose exec postgres pg_dump -U ozon_user ozon_unit_economics > backup.sql
```

Восстановление:

```bash
cat backup.sql | docker compose exec -T postgres psql -U ozon_user ozon_unit_economics
```

## 14. Security checklist

- `.env.production` не коммитится.
- API контейнер открыт только на `127.0.0.1:3001`.
- Снаружи backend доступен только через Nginx и HTTPS.
- `CORS_ALLOWED_ORIGIN` равен точному URL GitHub Pages.
- `OZON_API_KEY` хранится только на VPS.
- `client_max_body_size` в Nginx совпадает с `MAX_BODY_BYTES`.
