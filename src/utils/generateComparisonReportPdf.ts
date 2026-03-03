import jsPDF from "jspdf";
import { format } from "date-fns";

const PRIMARY = [240, 80, 35] as const;
const GREEN = [22, 163, 74] as const;
const RED = [220, 38, 38] as const;
const AMBER = [217, 119, 6] as const;
const BLUE = [59, 130, 246] as const;
const GRAY = [80, 80, 80] as const;
const LIGHT_BG = [253, 241, 236] as const;

function createDoc() {
  const doc = new jsPDF();
  return { doc, pw: doc.internal.pageSize.getWidth(), ph: doc.internal.pageSize.getHeight() };
}

function check(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 275) { doc.addPage(); return 20; }
  return y;
}

function header(doc: jsPDF, pw: number, title: string, subtitle: string): number {
  let y = 18;
  doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(...PRIMARY);
  doc.text(title, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
  doc.text(subtitle, pw / 2, y, { align: "center" });
  y += 5;
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pw / 2, y, { align: "center" });
  y += 6;
  doc.setDrawColor(...PRIMARY); doc.setLineWidth(0.6);
  doc.line(14, y, pw - 14, y);
  return y + 10;
}

function sectionTitle(doc: jsPDF, y: number, text: string, color: readonly [number, number, number] = PRIMARY): number {
  y = check(doc, y, 12);
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(...color);
  doc.text(text, 14, y);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

function metricRow(doc: jsPDF, y: number, label: string, value: string, labelX = 14, valueX = 80): number {
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(label, labelX, y);
  doc.setFont("helvetica", "normal"); doc.text(value, valueX, y);
  return y + 6;
}

interface ComparisonEntity {
  nome: string; partido: string; mentions: number; positive_pct: number;
  negative_pct: number; neutral_pct: number; sentiment_score: number;
  engagement_total: number; engagement_rate: number; top_topics: string[];
  is_principal: boolean;
}

const ASPECTS = [
  "Conexão Popular e Carisma", "Posicionamento em Segurança Pública",
  "Associação Política (Centrão)", "Entrega de Resultados (Saúde/Infraestrutura)",
  "Reconhecimento de Atuação Federal", "Apoio à Cultura Local",
];
const ASPECT_KEYS = [
  "conexao_popular", "causas_especificas", "associacao_politica",
  "entrega_resultados", "atuacao_federal", "cultura_local",
];

export function generateComparisonPdf(comparisonData: ComparisonEntity[], analysis: any) {
  const { doc, pw } = createDoc();
  const principal = comparisonData.find(c => c.is_principal) || comparisonData[0];
  let y = header(doc, pw, "Relatório Estratégico Comparativo", `${principal.nome} — Últimos 30 dias`);

  // ── Section 1: Entity Summary ──
  y = sectionTitle(doc, y, "Resumo das Entidades");
  
  // Table header
  const cols = [14, 55, 80, 100, 120, 140, 165];
  doc.setFillColor(...PRIMARY);
  doc.rect(14, y - 4, pw - 28, 7, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("Entidade", cols[0] + 2, y);
  doc.text("Partido", cols[1] + 2, y);
  doc.text("Menções", cols[2] + 2, y);
  doc.text("% Positivo", cols[3] + 2, y);
  doc.text("% Negativo", cols[4] + 2, y);
  doc.text("Sentimento", cols[5] + 2, y);
  doc.text("Eng. Total", cols[6] + 2, y);
  doc.setTextColor(0, 0, 0); y += 5;

  comparisonData.forEach((c, i) => {
    y = check(doc, y, 7);
    if (i % 2 === 0) { doc.setFillColor(...LIGHT_BG); doc.rect(14, y - 4, pw - 28, 6, "F"); }
    doc.setFontSize(7); doc.setFont("helvetica", c.is_principal ? "bold" : "normal");
    const name = c.nome.length > 22 ? c.nome.substring(0, 20) + "…" : c.nome;
    doc.text(name, cols[0] + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(c.partido, cols[1] + 2, y);
    doc.text(String(c.mentions), cols[2] + 2, y);
    doc.text(`${c.positive_pct}%`, cols[3] + 2, y);
    doc.text(`${c.negative_pct}%`, cols[4] + 2, y);
    doc.text(`${c.sentiment_score}/10`, cols[5] + 2, y);
    doc.text(c.engagement_total.toLocaleString(), cols[6] + 2, y);
    y += 6;
  });
  y += 6;

  if (!analysis) {
    doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(...GRAY);
    doc.text("Análise estratégica não gerada. Clique em 'Gerar Análise IA' primeiro.", 14, y);
    doc.save(`comparativo-estrategico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    return;
  }

  // ── Section 2: Radar Scores Table ──
  if (analysis.radar_scores?.length) {
    y = check(doc, y, 20);
    y = sectionTitle(doc, y, "Radar de Aspectos — Scores");

    const rCols = [14, 70];
    const nameWidth = 56;
    const scoreWidth = 22;

    // Header
    doc.setFillColor(...PRIMARY);
    const headerW = nameWidth + analysis.radar_scores.length * scoreWidth;
    doc.rect(14, y - 4, headerW, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("Aspecto", rCols[0] + 2, y);
    analysis.radar_scores.forEach((rs: any, idx: number) => {
      const shortName = rs.entity_name.length > 12 ? rs.entity_name.substring(0, 10) + "…" : rs.entity_name;
      doc.text(shortName, rCols[0] + nameWidth + idx * scoreWidth + 2, y);
    });
    doc.setTextColor(0, 0, 0); y += 5;

    ASPECTS.forEach((aspect, ai) => {
      y = check(doc, y, 7);
      if (ai % 2 === 0) { doc.setFillColor(...LIGHT_BG); doc.rect(14, y - 4, headerW, 6, "F"); }
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      const aLabel = aspect.length > 35 ? aspect.substring(0, 32) + "…" : aspect;
      doc.text(aLabel, rCols[0] + 2, y);
      analysis.radar_scores.forEach((rs: any, idx: number) => {
        const score = rs.scores?.[ASPECT_KEYS[ai]] || 0;
        doc.setFont("helvetica", "bold");
        doc.text(String(score), rCols[0] + nameWidth + idx * scoreWidth + 2, y);
        doc.setFont("helvetica", "normal");
      });
      y += 6;
    });
    y += 6;
  }

  // ── Section 3: Fraquezas ──
  if (analysis.fraquezas?.length) {
    y = sectionTitle(doc, y, `Fraquezas (${analysis.fraquezas.length})`, RED);
    analysis.fraquezas.forEach((f: any, i: number) => {
      y = check(doc, y, 22);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...RED);
      doc.text(`${i + 1}. ${f.aspecto}`, 14, y);
      if (f.impacto) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`[Impacto: ${f.impacto}]`, pw - 14, y, { align: "right" });
      }
      doc.setTextColor(0, 0, 0); y += 5;
      if (f.score_principal !== undefined) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`Score: ${f.score_principal} vs ${f.score_melhor_adversario} (${f.adversario_referencia || ""})`, 18, y);
        y += 5;
      }
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      if (f.definicao) {
        const lines = doc.splitTextToSize(`Definição: ${f.definicao}`, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
      }
      if (f.por_que_fraqueza) {
        const lines = doc.splitTextToSize(`Por que é fraqueza: ${f.por_que_fraqueza}`, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
      }
      y += 3;
    });
    y += 4;
  }

  // ── Section 4: Forças ──
  if (analysis.forcas?.length) {
    y = sectionTitle(doc, y, `Forças (${analysis.forcas.length})`, GREEN);
    analysis.forcas.forEach((f: any, i: number) => {
      y = check(doc, y, 22);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
      doc.text(`${i + 1}. ${f.aspecto}`, 14, y);
      if (f.impacto) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`[Impacto: ${f.impacto}]`, pw - 14, y, { align: "right" });
      }
      doc.setTextColor(0, 0, 0); y += 5;
      if (f.score_principal !== undefined) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`Score: ${f.score_principal} vs ${f.score_melhor_adversario}`, 18, y);
        y += 5;
      }
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      if (f.definicao) {
        const lines = doc.splitTextToSize(`Definição: ${f.definicao}`, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
      }
      if (f.por_que_forca) {
        const lines = doc.splitTextToSize(`Por que é força: ${f.por_que_forca}`, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
      }
      y += 3;
    });
    y += 4;
  }

  // ── Section 5: Oportunidades ──
  if (analysis.oportunidades?.length) {
    y = sectionTitle(doc, y, `Oportunidades IA (${analysis.oportunidades.length})`, AMBER);
    analysis.oportunidades.forEach((o: any, i: number) => {
      y = check(doc, y, 16);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...AMBER);
      doc.text(`${i + 1}. ${o.titulo}`, 14, y);
      if (o.prioridade) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`[Prioridade: ${o.prioridade}]`, pw - 14, y, { align: "right" });
      }
      doc.setTextColor(0, 0, 0); y += 5;
      if (o.aspecto_relacionado) {
        doc.setFontSize(8); doc.text(`Aspecto: ${o.aspecto_relacionado}`, 18, y); y += 5;
      }
      if (o.descricao) {
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(o.descricao, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
      }
      y += 3;
    });
    y += 4;
  }

  // ── Section 6: Plano de Cobertura ──
  if (analysis.plano_cobertura) {
    y = sectionTitle(doc, y, "Plano de Cobertura — 14 dias", BLUE);

    // Mensagens Recomendadas
    if (analysis.plano_cobertura.mensagens_recomendadas?.length) {
      y = check(doc, y, 12);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
      doc.text("✓ Mensagens Recomendadas", 14, y);
      doc.setTextColor(0, 0, 0); y += 6;
      analysis.plano_cobertura.mensagens_recomendadas.forEach((m: any) => {
        y = check(doc, y, 12);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        const lines = doc.splitTextToSize(`• ${m.mensagem}`, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
        doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
        doc.text(`Canal: ${m.canal} | Objetivo: ${m.objetivo || "—"}`, 22, y);
        doc.setTextColor(0, 0, 0); y += 5;
      });
      y += 3;
    }

    // Mensagens a Evitar
    if (analysis.plano_cobertura.mensagens_evitar?.length) {
      y = check(doc, y, 12);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...RED);
      doc.text("✗ Mensagens a Evitar", 14, y);
      doc.setTextColor(0, 0, 0); y += 6;
      analysis.plano_cobertura.mensagens_evitar.forEach((m: any) => {
        y = check(doc, y, 12);
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        const lines = doc.splitTextToSize(`• ${m.mensagem}`, pw - 32);
        lines.forEach((l: string) => { y = check(doc, y, 4); doc.text(l, 18, y); y += 4; });
        doc.setFont("helvetica", "normal"); doc.setTextColor(...GRAY);
        doc.text(`Motivo: ${m.motivo || "—"}`, 22, y);
        doc.setTextColor(0, 0, 0); y += 5;
      });
      y += 3;
    }

    // Cronograma 14 dias
    if (analysis.plano_cobertura.cronograma_14_dias?.length) {
      y = check(doc, y, 12);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE);
      doc.text("Cronograma Diário", 14, y);
      doc.setTextColor(0, 0, 0); y += 6;

      const tCols = [14, 30, 55, 155];
      doc.setFillColor(...BLUE);
      doc.rect(14, y - 4, pw - 28, 7, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("Dia", tCols[0] + 2, y);
      doc.text("Canal", tCols[1] + 2, y);
      doc.text("Ação", tCols[2] + 2, y);
      doc.text("Foco", tCols[3] + 2, y);
      doc.setTextColor(0, 0, 0); y += 5;

      analysis.plano_cobertura.cronograma_14_dias.forEach((d: any, i: number) => {
        y = check(doc, y, 7);
        if (i % 2 === 0) { doc.setFillColor(235, 245, 255); doc.rect(14, y - 4, pw - 28, 6, "F"); }
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(String(d.dia), tCols[0] + 2, y);
        doc.setFont("helvetica", "normal");
        doc.text(d.canal || "—", tCols[1] + 2, y);
        const acao = (d.acao || "").length > 65 ? d.acao.substring(0, 62) + "…" : (d.acao || "");
        doc.text(acao, tCols[2] + 2, y);
        const foco = (d.aspecto_foco || "").length > 20 ? d.aspecto_foco.substring(0, 17) + "…" : (d.aspecto_foco || "—");
        doc.text(foco, tCols[3] + 2, y);
        y += 6;
      });
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`Página ${p} de ${totalPages}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }

  doc.save(`comparativo-estrategico-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
