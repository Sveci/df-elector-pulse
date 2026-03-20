import * as XLSX from '@/lib/xlsx-compat';
import jsPDF from "jspdf";
import { format } from "date-fns";
import { EventDetailedReport } from "@/hooks/reports/useEventDetailedReport";

interface EventExportData {
  events: any[];
  leadersRanking: any[];
  citiesStats: any[];
  categoryStats: any[];
  stats: any;
}

export function exportEventsToExcel(data: EventExportData) {
  const workbook = XLSX.utils.book_new();

  // Aba 1: Resumo Geral
  const summaryData = [
    ["Métrica", "Valor"],
    ["Total de Eventos", data.stats.totalEvents],
    ["Eventos Ativos", data.stats.activeEvents],
    ["Total de Inscrições", data.stats.totalRegistrations],
    ["Total de Check-ins", data.stats.totalCheckins],
    ["Taxa de Conversão Geral", `${data.stats.overallConversionRate.toFixed(1)}%`],
    ["Utilização de Capacidade", `${data.stats.averageCapacityUtilization.toFixed(1)}%`],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo Geral");

  // Aba 2: Eventos
  const eventsData = data.events.map((event) => ({
    Nome: event.name,
    Data: format(new Date(event.date + "T00:00:00"), "dd/MM/yyyy"),
    Categoria: event.category,
    Região: event.region,
    Inscrições: event.registrations_count || 0,
    "Check-ins": event.checkedin_count || 0,
    "Taxa de Conversão": `${
      event.registrations_count > 0
        ? ((event.checkedin_count || 0) / event.registrations_count * 100).toFixed(1)
        : 0
    }%`,
    Capacidade: event.capacity || 0,
    Status: event.status,
  }));
  const eventsSheet = XLSX.utils.json_to_sheet(eventsData);
  XLSX.utils.book_append_sheet(workbook, eventsSheet, "Eventos");

  // Aba 3: Ranking de Líderes
  const leadersData = data.leadersRanking.map((leader) => ({
    Nome: leader.leaderName,
    Cidade: leader.cityName || "N/A",
    Inscrições: leader.registrations,
    "Check-ins": leader.checkins,
    "Taxa de Conversão": `${leader.conversionRate.toFixed(1)}%`,
  }));
  const leadersSheet = XLSX.utils.json_to_sheet(leadersData);
  XLSX.utils.book_append_sheet(workbook, leadersSheet, "Ranking de Líderes");

  // Aba 4: Distribuição por Cidade
  const citiesData = data.citiesStats.map((city) => ({
    Cidade: city.cityName,
    Inscrições: city.registrations,
    "Check-ins": city.checkins,
    "Taxa de Conversão": `${city.conversionRate.toFixed(1)}%`,
  }));
  const citiesSheet = XLSX.utils.json_to_sheet(citiesData);
  XLSX.utils.book_append_sheet(workbook, citiesSheet, "Cidades");

  // Aba 5: Métricas por Categoria
  const categoriesData = data.categoryStats.map((cat) => ({
    Categoria: cat.categoryLabel,
    Eventos: cat.totalEvents,
    Inscrições: cat.totalRegistrations,
    "Check-ins": cat.totalCheckins,
    "Taxa de Conversão": `${cat.conversionRate.toFixed(1)}%`,
    "Média por Evento": cat.averageRegistrationsPerEvent.toFixed(1),
  }));
  const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
  XLSX.utils.book_append_sheet(workbook, categoriesSheet, "Categorias");

  // Download
  const fileName = `relatorio-eventos-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportReportsToPdf(data: {
  stats: any;
  events: any[];
  leadersRanking: any[];
}) {
  const doc = new jsPDF();
  let yPos = 20;

  // Cabeçalho
  doc.setFontSize(18);
  doc.text("Relatório de Eventos", 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, yPos);
  yPos += 15;

  // KPIs Principais
  doc.setFontSize(14);
  doc.text("Métricas Principais", 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  const kpis = [
    `Total de Eventos: ${data.stats.totalEvents}`,
    `Eventos Ativos: ${data.stats.activeEvents}`,
    `Total de Inscrições: ${data.stats.totalRegistrations}`,
    `Total de Check-ins: ${data.stats.totalCheckins}`,
    `Taxa de Conversão Geral: ${data.stats.overallConversionRate.toFixed(1)}%`,
    `Utilização de Capacidade: ${data.stats.averageCapacityUtilization.toFixed(1)}%`,
  ];

  kpis.forEach((kpi) => {
    doc.text(kpi, 14, yPos);
    yPos += 6;
  });

  yPos += 10;

  // Top 5 Eventos (simplificado)
  doc.setFontSize(14);
  doc.text("Top 5 Eventos (Por Inscrições)", 14, yPos);
  yPos += 8;

  doc.setFontSize(9);
  const topEvents = data.events
    .sort((a, b) => (b.registrations_count || 0) - (a.registrations_count || 0))
    .slice(0, 5);

  topEvents.forEach((event, idx) => {
    const rate = event.registrations_count > 0
      ? ((event.checkedin_count || 0) / event.registrations_count * 100).toFixed(1)
      : 0;

    const text = `${idx + 1}. ${event.name} - ${format(new Date(event.date + "T00:00:00"), "dd/MM/yyyy")}`;
    doc.text(text, 14, yPos);
    yPos += 5;

    const details = `   Inscrições: ${event.registrations_count || 0} | Check-ins: ${event.checkedin_count || 0} | Taxa: ${rate}%`;
    doc.text(details, 14, yPos);
    yPos += 7;

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

  yPos += 5;

  // Ranking de Líderes (top 5)
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(14);
  doc.text("Top 5 Líderes por Inscrições", 14, yPos);
  yPos += 8;

  doc.setFontSize(9);
  const topLeaders = data.leadersRanking.slice(0, 5);

  topLeaders.forEach((leader, idx) => {
    const text = `${idx + 1}. ${leader.leaderName} - ${leader.cityName || "N/A"}`;
    doc.text(text, 14, yPos);
    yPos += 5;

    const details = `   Inscrições: ${leader.registrations} | Check-ins: ${leader.checkins} | Taxa: ${leader.conversionRate.toFixed(1)}%`;
    doc.text(details, 14, yPos);
    yPos += 7;

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

  // Download
  const fileName = `relatorio-eventos-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}

/**
 * Exporta relatório detalhado de um evento específico
 */
export function exportEventDetailedReport(report: EventDetailedReport, eventName: string) {
  const workbook = XLSX.utils.book_new();
  const safeEventName = eventName.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 20);

  // Aba 1: Resumo
  const summaryData = [
    ["Relatório Detalhado do Evento"],
    ["Evento", eventName],
    ["Gerado em", format(new Date(), "dd/MM/yyyy HH:mm")],
    [],
    ["Métrica", "Valor"],
    ["Total de Inscritos", report.totalRegistrations],
    ["Total de Check-ins", report.totalCheckins],
    ["Ausentes", report.totalAbsent],
    ["Taxa de Conversão", `${report.conversionRate.toFixed(1)}%`],
    [],
    ["Perfil dos Participantes"],
    ["Contatos", report.profileBreakdown.contacts],
    ["Líderes", report.profileBreakdown.leaders],
    ["Coordenadores", report.profileBreakdown.coordinators],
    [],
    ["Recorrência"],
    ["Primeira vez no sistema", report.recurrenceStats.firstTimers],
    ["Participaram de outros eventos", report.recurrenceStats.recurring],
    ["Média de eventos por participante", report.recurrenceStats.averageEventsPerParticipant.toFixed(1)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  // Aba 2: Por Cidade
  const citiesData = report.citiesBreakdown.map((city) => ({
    Cidade: city.cityName,
    Inscritos: city.registrations,
    "Check-ins": city.checkins,
    Ausentes: city.absents,
    "Taxa de Conversão": `${city.conversionRate.toFixed(1)}%`,
  }));
  const citiesSheet = XLSX.utils.json_to_sheet(citiesData);
  XLSX.utils.book_append_sheet(workbook, citiesSheet, "Por Cidade");

  // Aba 3: Lista Completa
  const registrationsData = report.registrations.map((reg) => ({
    Nome: reg.nome,
    Email: reg.email,
    WhatsApp: reg.whatsapp,
    Cidade: reg.cityName || "Não informada",
    Status: reg.checkedIn ? "Check-in realizado" : "Ausente",
    "Check-in em": reg.checkedInAt ? format(new Date(reg.checkedInAt), "dd/MM/yyyy HH:mm") : "",
    Perfil: reg.profileType === 'coordinator' ? 'Coordenador' : reg.profileType === 'leader' ? 'Líder' : 'Contato',
    "Líder Superior": reg.parentLeaderName || "-",
    "Outros Eventos": reg.otherEventsCount,
    "Nomes dos Eventos": reg.otherEventNames.join("; "),
    "Inscrito em": reg.createdAt ? format(new Date(reg.createdAt), "dd/MM/yyyy HH:mm") : "",
  }));
  const registrationsSheet = XLSX.utils.json_to_sheet(registrationsData);
  XLSX.utils.book_append_sheet(workbook, registrationsSheet, "Lista Completa");

  // Aba 4: Top Recorrentes
  if (report.recurrenceStats.topRecurring.length > 0) {
    const recurringData = report.recurrenceStats.topRecurring.map((p, idx) => ({
      Posição: idx + 1,
      Nome: p.nome,
      Email: p.email,
      "Total de Eventos": p.eventsCount,
      "Eventos Anteriores": p.eventNames.join("; "),
    }));
    const recurringSheet = XLSX.utils.json_to_sheet(recurringData);
    XLSX.utils.book_append_sheet(workbook, recurringSheet, "Top Recorrentes");
  }

  // Download
  const fileName = `relatorio-${safeEventName}-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
