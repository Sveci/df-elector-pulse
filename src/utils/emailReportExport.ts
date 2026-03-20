import * as XLSX from '@/lib/xlsx-compat';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { EmailReportItem } from "@/hooks/useEmailReport";

export function exportEmailReportToExcel(
  data: EmailReportItem[],
  templateName: string
) {
  const exportData = data.map((item) => ({
    "Nome": item.leader_nome || item.contact_nome || item.to_name || "-",
    "Email": item.to_email,
    "Telefone": item.leader_telefone || item.contact_telefone || "-",
    "Cidade/RA": item.leader_cidade || item.contact_cidade || "-",
    "Tipo": item.leader_id ? "Líder" : item.contact_id ? "Contato" : "-",
    "Status": getStatusLabel(item.status),
    "Erro": item.error_message || "-",
    "Data Envio": item.sent_at
      ? format(new Date(item.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
      : "-",
    "Data Criação": format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    "Assunto": item.subject,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");

  // Auto-size columns
  const colWidths = [
    { wch: 30 }, // Nome
    { wch: 35 }, // Email
    { wch: 18 }, // Telefone
    { wch: 20 }, // Cidade
    { wch: 10 }, // Tipo
    { wch: 12 }, // Status
    { wch: 40 }, // Erro
    { wch: 18 }, // Data Envio
    { wch: 18 }, // Data Criação
    { wch: 50 }, // Assunto
  ];
  worksheet["!cols"] = colWidths;

  const fileName = `relatorio-email-${templateName.toLowerCase().replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "sent":
      return "Enviado";
    case "pending":
      return "Pendente";
    case "failed":
      return "Falha";
    default:
      return status;
  }
}
