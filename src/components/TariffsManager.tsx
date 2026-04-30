"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, RefreshCcw } from "lucide-react";

interface TariffRule {
  id: number;
  categoryId: string | null;
  categoryName: string | null;
  commissionPercent: number | null;
  directLogisticsCost: number | null;
  reverseLogisticsCost: number | null;
  acceptanceCost: number | null;
  storageCostPerDay: number | null;
  pickupDeliveryCost: number | null;
}

interface TariffVersion {
  id: number;
  name: string;
  active: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sourceUrl: string | null;
  rules: TariffRule[];
}

const ruleFields: Array<{ key: keyof TariffRule; label: string; editable: boolean }> = [
  { key: "categoryId", label: "category_id", editable: false },
  { key: "categoryName", label: "Категория", editable: false },
  { key: "commissionPercent", label: "Комиссия, %", editable: true },
  { key: "directLogisticsCost", label: "Прямая логистика", editable: true },
  { key: "reverseLogisticsCost", label: "Обратная логистика", editable: true },
  { key: "acceptanceCost", label: "Приемка", editable: true },
  { key: "storageCostPerDay", label: "Хранение/день", editable: true },
  { key: "pickupDeliveryCost", label: "Доставка до ПВЗ", editable: true },
];

function format(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function TariffsManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [versions, setVersions] = useState<TariffVersion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("https://seller-edu.ozon.ru/libra/commissions-tariffs");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [activate, setActivate] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    const response = await fetch("/api/tariffs");
    const payload = await response.json();
    setVersions(payload.versions ?? []);
    const active = payload.versions?.find((version: TariffVersion) => version.active) ?? payload.versions?.[0];
    setSelectedId(active?.id ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = versions.find((version) => version.id === selectedId) ?? null;

  async function importTariff(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("name", name || file.name);
    form.append("sourceUrl", sourceUrl);
    form.append("effectiveFrom", effectiveFrom);
    form.append("effectiveTo", effectiveTo);
    form.append("activate", String(activate));
    const response = await fetch("/api/tariffs", { method: "POST", body: form });
    const payload = await response.json();
    setStatus(JSON.stringify(payload));
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    await load();
  }

  async function activateVersion(id: number) {
    await fetch(`/api/tariffs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    await load();
  }

  async function updateRule(ruleId: number, field: keyof TariffRule, value: string) {
    await fetch(`/api/tariffs/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value }),
    });
    await load();
  }

  return (
    <section className="page tariff-grid">
      <aside className="panel">
        <h2>Версии</h2>
        <div className="toolbar">
          <button className="btn" onClick={load}>
            <RefreshCcw size={16} />
            Обновить
          </button>
        </div>
        <div className="toolbar">
          <input placeholder="Название версии" value={name} onChange={(event) => setName(event.target.value)} />
          <input placeholder="source_url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
          <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          <input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} />
          <label>
            <input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} /> активная
          </label>
          <label className="file-label">
            <FileSpreadsheet size={16} />
            Импорт JSON/CSV/XLSX
            <input ref={fileRef} hidden type="file" accept=".json,.csv,.tsv,.xlsx,.xls" onChange={(event) => event.target.files?.[0] && void importTariff(event.target.files[0])} />
          </label>
        </div>
        <div className="status-line">{status}</div>
        {versions.map((version) => (
          <button key={version.id} className={version.id === selectedId ? "btn primary" : "btn"} onClick={() => setSelectedId(version.id)}>
            {version.active ? "● " : ""}
            {version.name}
          </button>
        ))}
      </aside>

      <section className="panel">
        <div className="toolbar">
          <h2>{selected?.name ?? "Нет тарифов"}</h2>
          {selected && !selected.active ? (
            <button className="btn primary" onClick={() => activateVersion(selected.id)}>
              Сделать активной
            </button>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {ruleFields.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected?.rules.map((rule) => (
                <tr key={rule.id}>
                  {ruleFields.map((field) => (
                    <td key={field.key}>
                      {field.editable ? (
                        <input
                          defaultValue={format(rule[field.key])}
                          onBlur={(event) => void updateRule(rule.id, field.key, event.target.value)}
                        />
                      ) : (
                        format(rule[field.key])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
