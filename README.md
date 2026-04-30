# Ozon Unit Economics

Локальный калькулятор юнит-экономики Ozon Seller API: товары, цены, остатки, отправления, финансовые операции, ручные расходы, тарифные версии и экспорт итоговой таблицы.

## Установка

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Откройте `http://localhost:3000`.

## Переменные окружения

```env
DATABASE_URL="file:./dev.db"
OZON_CLIENT_ID="..."
OZON_API_KEY="..."
OZON_API_BASE_URL="https://api-seller.ozon.ru"
```

API-ключи используются только в серверных route handlers. На фронт они не передаются.

## Как синхронизировать товары

На странице `Ozon Unit Economics` нажмите `Синхронизировать товары из Ozon`.

Слой `src/lib/ozon/client.ts` отправляет запросы с заголовками:

- `Client-Id`
- `Api-Key`
- `Content-Type: application/json`

Поддержаны retry для `429/5xx`, простая защита rate limit, пагинация `last_id` и `offset`, chunking периодов для финансовых операций.

Используемые методы вынесены в `src/lib/ozon/sync.ts`:

- `/v3/product/list`
- `/v3/product/info/list`
- `/v4/product/info/attributes`
- `/v4/product/info/stocks`
- `/v5/product/info/prices`
- `/v2/posting/fbo/list`
- `/v3/posting/fbs/list`
- `/v3/finance/transaction/list`

Если API не возвращает поле, значение остается `null`, а source map показывает `missing`.

## Импорт Excel/CSV

На странице калькулятора нажмите `Импорт ручных данных из Excel/CSV`.

Основной ключ сопоставления: `Артикул` -> `offer_id`.
Второй ключ: `ШК` -> `barcode`.

Если товар есть в файле, но не найден среди API-товаров, создается manual-only строка. Если найдено несколько совпадений, импорт возвращает конфликт.

## Пересчет

Расчетный модуль находится в:

```text
src/lib/unitEconomics/calculateOzonUnitEconomics.ts
```

Он принимает normalized product, manual inputs, tariff rule, actual finance aggregates и settings. Возвращает:

- все расчетные поля;
- `warnings`;
- `errors`;
- `sourceMap` по каждому полю.

Настройки:

- `use_actual_finance_data`
- `tax_mode`
- `vat_mode`
- `calculation_basis`
- `include_express_in_logistics`
- `include_storage_in_marketplace_expenses`
- `include_reviews_in_total_expenses`
- `include_self_purchase_in_total_expenses`

## Тарифы

Страница `Tariffs` поддерживает импорт JSON/CSV/XLSX, активацию версии и ручное редактирование правил:

- комиссия;
- прямая логистика;
- обратная логистика;
- хранение;
- приемка;
- доставка до ПВЗ.

Тарифы не захардкожены в формулах. Активная версия хранится в таблицах `tariff_versions` и `tariff_rules`.

## Источники полей

Каждое поле получает один из источников:

- `api` — пришло из Ozon API;
- `manual` — введено в таблице;
- `imported` — импортировано из Excel/CSV;
- `formula` — рассчитано;
- `missing` — данных нет.

Ручные поля: себестоимость, логистика до склада, базовая комиссия override, объем override, проценты выкупа/возврата/отмен, реклама, налоги, партия и продажи за месяц.

API-поля: идентификаторы, название, категория, цена, старая цена, маркетинговая цена/СПП, габариты, вес, остатки, отправления и финансовые начисления, если метод их возвращает.

## Экспорт

Кнопка `Экспорт в Excel` выгружает все ручные и расчетные колонки в `.xlsx`.

## Проверки

```bash
npm test
```

Тесты покрывают:

- 100% выкуп;
- 70% выкуп и возвраты;
- отрицательную прибыль;
- отсутствие себестоимости;
- отсутствие объема;
- `buyout_percent = 0`;
- скидку в акции;
- УСН Доходы;
- УСН Доходы-Расходы;
- НДС в цене;
- ROI годовых;
- отсутствие задвоения расходов.

## Актуализация API и тарифов

Перед реализацией проверены публичные источники Ozon:

- Seller API требует `Client-Id` и `Api-Key`, а FBS отправления доступны через `POST /v3/posting/fbs/list`.
- `POST /v3/finance/transaction/list` возвращает начисления и ограничивает один запрос периодом до 1 месяца.
- Тарифы меняются по датам действия, поэтому они импортируются как версии, а не хранятся константами в коде.
