import * as XLSX from "xlsx";
import { economicsColumns } from "@/lib/unitEconomics/fields.ts";
import type { EconomicsRow } from "@/lib/unitEconomics/economicsService.ts";

export function createEconomicsWorkbook(rows: EconomicsRow[]): Buffer {
  const exportRows = rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const column of economicsColumns) {
      record[column.label] = row.values[column.key] ?? null;
    }
    record["Ошибки"] = row.errors.join(", ");
    record["Предупреждения"] = row.warnings.join(", ");
    return record;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ozon Unit Economics");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
