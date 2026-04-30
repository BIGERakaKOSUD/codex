export type EconomicsColumnKind = "identity" | "manual" | "calculated" | "api";

export interface EconomicsColumn {
  key: string;
  label: string;
  kind: EconomicsColumnKind;
  editable: boolean;
}

export const manualInputColumns: EconomicsColumn[] = [
  { key: "barcode", label: "ШК", kind: "identity", editable: false },
  { key: "offer_id", label: "Артикул", kind: "identity", editable: false },
  { key: "category_name", label: "Категория", kind: "identity", editable: false },
  { key: "cost_price", label: "Себестоимость, руб.", kind: "manual", editable: true },
  { key: "inbound_logistics_to_warehouse", label: "Логистика ДО склада, руб. (кросс-докинг)", kind: "manual", editable: true },
  { key: "base_commission_percent", label: "Базовая комиссия, %", kind: "manual", editable: true },
  { key: "product_volume_liters", label: "Объем товара, литр", kind: "manual", editable: true },
  { key: "free_acceptance", label: "Условия бесплатной приемки (да/нет)", kind: "manual", editable: true },
  { key: "buyout_percent", label: "Процент выкупа", kind: "manual", editable: true },
  { key: "non_buyout_percent", label: "Процент невыкупа", kind: "manual", editable: true },
  { key: "return_percent", label: "Процент возвратов", kind: "manual", editable: true },
  { key: "cancel_percent", label: "Процент отмен", kind: "manual", editable: true },
  { key: "delivery_to_pickup_point_cost", label: "Доставка до места выдачи", kind: "manual", editable: true },
  { key: "express_cost", label: "Затраты на Express", kind: "manual", editable: true },
  { key: "self_purchase_cost", label: "Затраты на самовыкупы", kind: "manual", editable: true },
  { key: "review_points_cost", label: "Затраты на \"Отзывы за баллы\"", kind: "manual", editable: true },
  { key: "paid_storage_cost", label: "Платное хранение", kind: "manual", editable: true },
  { key: "other_expenses", label: "Прочие расходы", kind: "manual", editable: true },
  { key: "confirmed_other_expenses", label: "Прочие расходы (подтвержденные)", kind: "manual", editable: true },
  { key: "total_drr_percent", label: "Общий ДРР от заказа", kind: "manual", editable: true },
  { key: "retail_price_without_promo", label: "Розничная цена без акции, руб.", kind: "manual", editable: true },
  { key: "promo_name", label: "Акция", kind: "manual", editable: true },
  { key: "promo_discount_percent", label: "Скидка в акции", kind: "manual", editable: true },
  { key: "coinvest_acquiring_percent", label: "Соинвест Эквайринг, %", kind: "manual", editable: true },
  { key: "tax_usn_income_percent", label: "Ставка налога (УСН Доходы)", kind: "manual", editable: true },
  { key: "tax_usn_income_minus_expenses_percent", label: "Ставка налога (УСН Доходы-Расходы)", kind: "manual", editable: true },
  { key: "vat_percent", label: "НДС", kind: "manual", editable: true },
  { key: "manufacturer_logistics_lead_weeks", label: "Логистическое плечо от производителя (недель)", kind: "manual", editable: true },
  { key: "batch_qty", label: "Привезенная партия", kind: "manual", editable: true },
  { key: "sold_qty_month", label: "Продано штук за месяц", kind: "manual", editable: true },
];

export const calculatedColumns: EconomicsColumn[] = [
  { key: "commission_rub", label: "Комиссия в руб.", kind: "calculated", editable: false },
  { key: "calculated_marker", label: "Расчетная", kind: "calculated", editable: false },
  { key: "acquiring_rub", label: "Эквайринг, руб.", kind: "calculated", editable: false },
  { key: "ozon_direct_base_logistics_rub", label: "Логистика OZON прямая базовая, руб.", kind: "calculated", editable: false },
  { key: "nonlocal_logistics_markup_rub", label: "Надбавка к логистике за нелокальность", kind: "calculated", editable: false },
  { key: "forecast_direct_logistics_rub", label: "Прогнозная стоимость прямой логистики", kind: "calculated", editable: false },
  { key: "forecast_reverse_logistics_rub", label: "Прогнозная стоимость обратной логистики", kind: "calculated", editable: false },
  { key: "acceptance_cost_rub", label: "Стоимость приемки", kind: "calculated", editable: false },
  { key: "pickup_delivery_service_rub", label: "Услуга доставки товара до места выдачи, руб.", kind: "calculated", editable: false },
  { key: "total_logistics_rub", label: "Общая логистика, руб.", kind: "calculated", editable: false },
  { key: "ad_cost_per_order_rub", label: "Стоимость рекламы на один заказ, руб.", kind: "calculated", editable: false },
  { key: "ad_cost_per_buyout_rub", label: "Рекламные расходы на выкуп, руб.", kind: "calculated", editable: false },
  { key: "tacos_percent", label: "ДРР (общий от всех продаж) (TACoS)", kind: "calculated", editable: false },
  { key: "total_expenses_rub", label: "ИТОГО РАСХОДОВ, руб.", kind: "calculated", editable: false },
  { key: "confirmed_total_expenses_rub", label: "ИТОГО РАСХОДОВ (подтвержденных)", kind: "calculated", editable: false },
  { key: "marketplace_expense_share_percent", label: "Доля расходов на Маркетплейс", kind: "calculated", editable: false },
  { key: "retail_price_rub", label: "Розничная цена, руб.", kind: "calculated", editable: false },
  { key: "retail_price_with_spp_rub", label: "Розничная цена с СПП, руб.", kind: "calculated", editable: false },
  { key: "gross_profit_rub", label: "Прибыль, руб.", kind: "calculated", editable: false },
  { key: "taxable_profit_for_15_percent_rub", label: "Прибыль (для расчета налогов 15%)", kind: "calculated", editable: false },
  { key: "tax_usn_income_rub", label: "Налог, руб. (УСН Доходы)", kind: "calculated", editable: false },
  { key: "tax_usn_income_minus_expenses_rub", label: "Налог, руб. (УСН Доходы-Расходы)", kind: "calculated", editable: false },
  { key: "vat_rub", label: "НДС", kind: "calculated", editable: false },
  { key: "total_tax_rub", label: "Итого налог", kind: "calculated", editable: false },
  { key: "net_profit_per_unit_rub", label: "Чистая прибыль на единицу товара, руб.", kind: "calculated", editable: false },
  { key: "realized_profit_rub", label: "Прибыль от реализованного, руб.", kind: "calculated", editable: false },
  { key: "roi_ratio", label: "ROI", kind: "calculated", editable: false },
  { key: "annual_roi_percent", label: "ROI в процентах годовых", kind: "calculated", editable: false },
  { key: "margin_percent", label: "Маржинальность", kind: "calculated", editable: false },
  { key: "cost_price_share_percent", label: "Доля себестоимости в цене", kind: "calculated", editable: false },
];

export const economicsColumns = [...manualInputColumns, ...calculatedColumns];

export const importColumnMap: Record<string, string> = Object.fromEntries(
  manualInputColumns.map((column) => [column.label.toLowerCase().trim(), column.key]),
);

export const editableManualKeys = new Set(
  manualInputColumns.filter((column) => column.editable).map((column) => column.key),
);
