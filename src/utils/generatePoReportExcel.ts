import * as XLSX from '@/lib/xlsx-compat';
import { format } from "date-fns";
import type { DemographicReportData } from "@/hooks/public-opinion/usePoReportData";

export function generateDemographicExcel(data: DemographicReportData) {
  const exportData = data.sources.map((s) => ({
    "Fonte": s.source,
    "Total Menções": s.total,
    "Positivas": s.positive,
    "% Positivo": `${s.positivePct}%`,
    "Negativas": s.negative,
    "% Negativo": `${s.negativePct}%`,
    "Neutras": s.neutral,
    "% Neutro": `${s.neutralPct}%`,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Demográfico por Fonte");

  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];

  const fileName = `relatorio-demografico-${data.entityName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
