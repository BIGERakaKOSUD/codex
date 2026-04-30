"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  PlugZap,
  RefreshCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { economicsColumns } from "@ozon-unit-economics/shared";
import { backendFetch, initialApiBaseUrl, saveApiBaseUrl } from "@/lib/apiClient";
import {
  clearStaticStore,
  createBackupJson,
  createExportWorkbook,
  loadBackupJson,
  loadStaticStore,
  parseManualFile,
  saveStaticStore,
  updateManualValue,
  type EconomicsRow,
  type StaticStore,
} from "@/lib/staticEconomics";

type Mode = "static" | "api";
type Source = "api" | "manual" | "imported" | "formula" | "missing";
type UiRow = EconomicsRow | {
  id: number;
  values: Record<string, unknown>;
  sourceMap: Record<string, Source>;
  warnings: string[];
  errors: string[];
};

function format(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  }
  return String(value);
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function SourceBadge({ source }: { source: Source | undefined }) {
  const label = source ?? "missing";
  return <span className={`badge ${label}`}>{label}</span>;
}

function EditableCell({
  row,
  field,
  editable,
  onSave,
}: {
  row: UiRow;
  field: string;
  editable: boolean;
  onSave: (row: UiRow, field: string, value: string | boolean) => void;
}) {
  const value = row.values[field];
  const source = row.sourceMap[field];
  const [draft, setDraft] = useState(format(value));

  useEffect(() => {
    setDraft(format(value));
  }, [value]);

  const danger =
    (field === "gross_profit_rub" || field === "net_profit_per_unit_rub" || field === "roi_ratio") &&
    numeric(value) !== null &&
    numeric(value)! < 0;
  const warning = field === "margin_percent" && numeric(value) !== null && numeric(value)! < 10 && numeric(value)! >= 0;
  const missingCost = field === "cost_price" && source === "missing";
  const missingVolume = field === "product_volume_liters" && source === "missing";
  const priceBelowCost =
    field === "retail_price_rub" &&
    numeric(row.values.retail_price_rub) !== null &&
    numeric(row.values.cost_price) !== null &&
    numeric(row.values.retail_price_rub)! <= numeric(row.values.cost_price)!;

  if (!editable) {
    return (
      <div className="cell">
        <span className={danger || missingCost || priceBelowCost ? "cell-danger" : warning || missingVolume ? "cell-warning" : ""}>
          {format(value)}
        </span>
        <SourceBadge source={source} />
      </div>
    );
  }

  if (field === "free_acceptance") {
    return (
      <div className="cell">
        <select
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(event) => onSave(row, field, event.target.value)}
        >
          <option value=""></option>
          <option value="true">да</option>
          <option value="false">нет</option>
        </select>
        <SourceBadge source={source} />
      </div>
    );
  }

  return (
    <div className="cell">
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onSave(row, field, draft)}
        className={missingCost ? "cell-danger" : missingVolume ? "cell-warning" : ""}
      />
      <SourceBadge source={source} />
    </div>
  );
}

export function EconomicsDashboard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("static");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [rows, setRows] = useState<UiRow[]>([]);
  const [staticStore, setStaticStore] = useState<StaticStore>({ rows: [], lastCalculation: null, lastImport: null });
  const [period, setPeriod] = useState("last30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("GitHub Pages mode: API Ozon недоступен. Для синхронизации с Ozon подключите backend.");
  const [error, setError] = useState("");
  const [backendConnected, setBackendConnected] = useState(false);
  const [ozonStatus, setOzonStatus] = useState("disabled");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [offer, setOffer] = useState("");
  const [sku, setSku] = useState("");
  const [negativeOnly, setNegativeOnly] = useState(false);
  const [missingCostOnly, setMissingCostOnly] = useState(false);
  const [missingVolumeOnly, setMissingVolumeOnly] = useState(false);
  const [missingCommissionOnly, setMissingCommissionOnly] = useState(false);
  const [roiBelow, setRoiBelow] = useState("");
  const [marginBelow, setMarginBelow] = useState("");
  const [lastSyncProducts, setLastSyncProducts] = useState<string | null>(null);
  const [lastSyncFinance, setLastSyncFinance] = useState<string | null>(null);
  const [lastCalculation, setLastCalculation] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return params.toString();
  }, [period, from, to]);

  useEffect(() => {
    const store = loadStaticStore();
    setStaticStore(store);
    setRows(store.rows);
    setLastCalculation(store.lastCalculation);
    setApiBaseUrl(initialApiBaseUrl());
  }, []);

  function persistStatic(nextRows: EconomicsRow[], overrides: Partial<StaticStore> = {}) {
    const next: StaticStore = {
      rows: nextRows,
      lastCalculation: overrides.lastCalculation ?? new Date().toISOString(),
      lastImport: overrides.lastImport ?? staticStore.lastImport,
    };
    setStaticStore(next);
    setRows(next.rows);
    setLastCalculation(next.lastCalculation);
    saveStaticStore(next);
  }

  async function loadApiRows() {
    setLoading(true);
    setError("");
    try {
      const response = await backendFetch(apiBaseUrl, `/economics/products?${query}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
      }
      setRows(payload.rows ?? []);
      setBackendConnected(true);
      setStatus("Backend API: connected");
    } catch (loadError) {
      setBackendConnected(false);
      setRows([]);
      setError(loadError instanceof Error ? loadError.message : "Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "api") {
      void loadApiRows();
    } else {
      setRows(staticStore.rows);
      setOzonStatus("disabled");
      setStatus("GitHub Pages mode: API Ozon недоступен. Для синхронизации с Ozon подключите backend.");
    }
  }, [mode, query]);

  async function runApiAction(label: string, path: string) {
    setLoading(true);
    setStatus(label);
    setError("");
    try {
      const response = await backendFetch(apiBaseUrl, path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? label);
      }
      const now = new Date().toISOString();
      if (path.includes("products") || path.includes("prices") || path.includes("stocks")) {
        setLastSyncProducts(now);
      }
      if (path.includes("finance")) {
        setLastSyncFinance(now);
      }
      if (path.includes("recalculate")) {
        setLastCalculation(now);
        setRows(payload.rows ?? rows);
      } else {
        await loadApiRows();
      }
      setBackendConnected(true);
      setOzonStatus("connected");
      setStatus(`${label}: ${JSON.stringify(payload)}`);
    } catch (actionError) {
      setBackendConnected(false);
      setOzonStatus("error");
      setError(actionError instanceof Error ? actionError.message : "Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
    } finally {
      setLoading(false);
    }
  }

  async function checkConnection() {
    setLoading(true);
    setError("");
    try {
      const normalized = saveApiBaseUrl(apiBaseUrl);
      setApiBaseUrl(normalized);
      const response = await backendFetch(normalized, "/health");
      const payload = await response.json();
      if (!response.ok || payload.ok !== true) {
        throw new Error("Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
      }
      setBackendConnected(true);
      setStatus("Backend API: connected");
    } catch (connectionError) {
      setBackendConnected(false);
      setError(connectionError instanceof Error ? connectionError.message : "Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCell(row: UiRow, field: string, value: string | boolean) {
    if (mode === "static") {
      const nextRows = staticStore.rows.map((item) => (item.id === row.id ? updateManualValue(item, field, value) : item));
      persistStatic(nextRows);
      return;
    }

    const response = await backendFetch(apiBaseUrl, "/economics/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer_id: row.values.offer_id,
        barcode: row.values.barcode,
        field,
        value,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
      return;
    }
    await loadApiRows();
  }

  async function importFile(file: File) {
    setLoading(true);
    setError("");
    try {
      if (mode === "static") {
        const importedRows = await parseManualFile(file);
        persistStatic(importedRows, { lastImport: new Date().toISOString() });
        setStatus(`Imported ${importedRows.length} rows locally. Data was not sent to a server.`);
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const response = await backendFetch(apiBaseUrl, "/import/manual-inputs", { method: "POST", body: formData });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Import failed");
        }
        setStatus(`Import: ${JSON.stringify(payload)}`);
        await loadApiRows();
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setLoading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  }

  async function exportExcel() {
    if (mode === "static") {
      const workbook = createExportWorkbook(staticStore.rows);
      downloadBlob("ozon-unit-economics.xlsx", new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      return;
    }

    const response = await backendFetch(apiBaseUrl, `/export/excel?${query}`);
    if (!response.ok) {
      setError("Backend недоступен. Проверьте NEXT_PUBLIC_API_BASE_URL или адрес API.");
      return;
    }
    downloadBlob("ozon-unit-economics.xlsx", await response.blob());
  }

  function downloadBackup() {
    downloadBlob("ozon-unit-economics-backup.json", new Blob([createBackupJson(staticStore)], { type: "application/json" }));
  }

  async function restoreBackup(file: File) {
    const text = await file.text();
    const next = loadBackupJson(text);
    setStaticStore(next);
    setRows(next.rows);
    saveStaticStore(next);
    if (backupInput.current) {
      backupInput.current.value = "";
    }
  }

  const filteredRows = useMemo(() => {
    const roiLimit = roiBelow === "" ? null : Number(roiBelow);
    const marginLimit = marginBelow === "" ? null : Number(marginBelow);

    return rows.filter((row) => {
      const values = row.values;
      if (category && !String(values.category_name ?? "").toLowerCase().includes(category.toLowerCase())) return false;
      if (offer && !String(values.offer_id ?? "").toLowerCase().includes(offer.toLowerCase())) return false;
      if (sku && !String(values.sku ?? "").toLowerCase().includes(sku.toLowerCase())) return false;
      if (negativeOnly && !(numeric(values.net_profit_per_unit_rub) !== null && numeric(values.net_profit_per_unit_rub)! < 0)) return false;
      if (missingCostOnly && row.sourceMap.cost_price !== "missing") return false;
      if (missingVolumeOnly && row.sourceMap.product_volume_liters !== "missing") return false;
      if (missingCommissionOnly && row.sourceMap.base_commission_percent !== "missing") return false;
      if (roiLimit !== null && !(numeric(values.roi_ratio) !== null && numeric(values.roi_ratio)! < roiLimit)) return false;
      if (marginLimit !== null && !(numeric(values.margin_percent) !== null && numeric(values.margin_percent)! < marginLimit)) return false;
      return true;
    });
  }, [rows, category, offer, sku, negativeOnly, missingCostOnly, missingVolumeOnly, missingCommissionOnly, roiBelow, marginBelow]);

  const metrics = useMemo(() => {
    const sum = (key: string) => filteredRows.reduce((acc, row) => acc + (numeric(row.values[key]) ?? 0), 0);
    const avg = (key: string) => {
      const values = filteredRows.map((row) => numeric(row.values[key])).filter((value): value is number => value !== null);
      return values.length ? values.reduce((acc, value) => acc + value, 0) / values.length : 0;
    };
    const missingCost = filteredRows.filter((row) => row.sourceMap.cost_price === "missing").length;
    const missingVolume = filteredRows.filter((row) => row.sourceMap.product_volume_liters === "missing").length;

    return {
      cards: [
        ["Общая выручка", sum("retail_price_rub")],
        ["Общая чистая прибыль", sum("realized_profit_rub")],
        ["Средняя маржинальность", avg("margin_percent")],
        ["Средний ROI", avg("roi_ratio")],
        ["Убыточных товаров", filteredRows.filter((row) => numeric(row.values.net_profit_per_unit_rub)! < 0).length],
        ["Нет себестоимости", missingCost],
        ["Нет объема", missingVolume],
        ["Реклама", sum("ad_cost_per_buyout_rub")],
        ["Логистика", sum("total_logistics_rub")],
        ["Комиссии", sum("commission_rub")],
        ["Налоги", sum("total_tax_rub")],
      ],
      missingCost,
      missingVolume,
    };
  }, [filteredRows]);

  const columns = useMemo<ColumnDef<UiRow>[]>(
    () =>
      economicsColumns.map((column, index) => ({
        id: column.key,
        header: column.label,
        cell: ({ row }) => (
          <EditableCell row={row.original} field={column.key} editable={column.editable} onSave={saveCell} />
        ),
        meta: { sticky: index === 1 },
      })),
    [mode, rows, staticStore, apiBaseUrl],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="page">
      <div className="mode-panel">
        <div className="segmented">
          <button className={mode === "static" ? "btn primary" : "btn"} onClick={() => setMode("static")}>Static / GitHub Pages</button>
          <button className={mode === "api" ? "btn primary" : "btn"} onClick={() => setMode("api")}>API / Backend</button>
        </div>
        {mode === "static" ? (
          <div className="notice">GitHub Pages mode: API Ozon недоступен. Для синхронизации с Ozon подключите backend.</div>
        ) : (
          <div className="api-url">
            <input value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} placeholder="https://your-backend-domain.com" />
            <button className="btn" disabled={loading} onClick={checkConnection}>
              <PlugZap size={16} />
              Проверить подключение
            </button>
          </div>
        )}
      </div>

      <div className="connection-status">
        {mode === "static" ? (
          <>
            <span>GitHub Pages mode</span>
            <span>Ozon API: disabled</span>
            <span>Import Excel: enabled</span>
            <span>Export Excel: enabled</span>
          </>
        ) : (
          <>
            <span>Backend API: {backendConnected ? "connected" : "disconnected"}</span>
            <span>Ozon API: {ozonStatus}</span>
            <span>Last sync products: {lastSyncProducts ?? "-"}</span>
            <span>Last sync finance: {lastSyncFinance ?? "-"}</span>
            <span>Last calculation: {lastCalculation ?? "-"}</span>
          </>
        )}
      </div>

      <div className="toolbar">
        <select value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="last7">последние 7 дней</option>
          <option value="last30">последние 30 дней</option>
          <option value="currentMonth">текущий месяц</option>
          <option value="previousMonth">прошлый месяц</option>
          <option value="custom">кастомный период</option>
        </select>
        {period === "custom" ? (
          <>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </>
        ) : null}

        {mode === "api" ? (
          <>
            <button className="btn primary" disabled={loading} onClick={() => runApiAction("Синхронизация товаров", "/ozon/products/sync")}>
              <RefreshCcw size={16} />
              Синхронизировать товары Ozon
            </button>
            <button className="btn" disabled={loading} onClick={() => runApiAction("Синхронизация цен", "/ozon/prices/sync")}>Цены</button>
            <button className="btn" disabled={loading} onClick={() => runApiAction("Синхронизация остатков", "/ozon/stocks/sync")}>Остатки</button>
            <button className="btn" disabled={loading} onClick={() => runApiAction("Синхронизация финансов", "/ozon/finance/sync")}>Финансы</button>
            <button className="btn" disabled={loading} onClick={() => runApiAction("Пересчет", "/economics/recalculate")}>
              <RotateCw size={16} />
              Пересчитать
            </button>
          </>
        ) : null}

        <label className="file-label">
          <FileSpreadsheet size={16} />
          Импорт Excel/CSV
          <input ref={fileInput} hidden type="file" accept=".xlsx,.xls,.csv,.tsv" onChange={(event) => event.target.files?.[0] && void importFile(event.target.files[0])} />
        </label>
        <button className="btn" onClick={exportExcel}>
          <Download size={16} />
          Экспорт Excel
        </button>
        {mode === "static" ? (
          <>
            <button className="btn" onClick={() => { clearStaticStore(); persistStatic([], { lastCalculation: null, lastImport: null }); }}>
              <Trash2 size={16} />
              Очистить локальные данные
            </button>
            <button className="btn" onClick={downloadBackup}>
              <FileJson size={16} />
              Скачать backup JSON
            </button>
            <label className="file-label">
              <Upload size={16} />
              Загрузить backup JSON
              <input ref={backupInput} hidden type="file" accept=".json" onChange={(event) => event.target.files?.[0] && void restoreBackup(event.target.files[0])} />
            </label>
          </>
        ) : null}
      </div>

      <div className="filters">
        <Search size={16} />
        <input placeholder="категория" value={category} onChange={(event) => setCategory(event.target.value)} />
        <input placeholder="артикул" value={offer} onChange={(event) => setOffer(event.target.value)} />
        <input placeholder="SKU" value={sku} onChange={(event) => setSku(event.target.value)} />
        <label><input type="checkbox" checked={negativeOnly} onChange={(event) => setNegativeOnly(event.target.checked)} /> прибыль &lt; 0</label>
        <label><input type="checkbox" checked={missingCostOnly} onChange={(event) => setMissingCostOnly(event.target.checked)} /> нет себестоимости</label>
        <label><input type="checkbox" checked={missingVolumeOnly} onChange={(event) => setMissingVolumeOnly(event.target.checked)} /> нет объема</label>
        <label><input type="checkbox" checked={missingCommissionOnly} onChange={(event) => setMissingCommissionOnly(event.target.checked)} /> нет комиссии</label>
        <SlidersHorizontal size={16} />
        <input placeholder="ROI ниже X" value={roiBelow} onChange={(event) => setRoiBelow(event.target.value)} />
        <input placeholder="маржа ниже X" value={marginBelow} onChange={(event) => setMarginBelow(event.target.value)} />
      </div>

      <div className="metrics">
        {metrics.cards.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{format(value)}</strong>
          </div>
        ))}
      </div>

      {metrics.missingCost > 0 ? <div className="status-line error-line">Не хватает себестоимости по {metrics.missingCost} товарам.</div> : null}
      {metrics.missingVolume > 0 ? <div className="status-line error-line">Не хватает объема по {metrics.missingVolume} товарам.</div> : null}
      <div className={error ? "status-line error-line" : "status-line"}>{error || status}</div>

      <div className="table-wrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => (
                  <th key={header.id} className={index === 1 ? "sticky" : ""}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={numeric(row.original.values.net_profit_per_unit_rub)! < 0 ? "row-negative" : ""}>
                {row.getVisibleCells().map((cell, index) => (
                  <td key={cell.id} className={index === 1 ? "sticky" : ""}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
