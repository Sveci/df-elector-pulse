import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDailySnapshots, useMentions } from "./usePublicOpinion";

export type AlertLevel = "critical" | "warning" | "info";

export interface PoAlert {
  id: string;
  level: AlertLevel;
  type: "sentiment_drop" | "mention_spike" | "viral_content" | "negative_spike" | "positive_surge" | "low_activity";
  title: string;
  description: string;
  value?: number;
  threshold?: number;
  source?: string;
  sourceUrl?: string;
  detectedAt: string;
}

/**
 * Generates real-time alerts from daily snapshots and recent mentions.
 * Detects: sentiment drops, mention spikes, viral content, extended inactivity.
 */
export function usePoAlerts(entityId?: string) {
  const { data: snapshots } = useDailySnapshots(entityId, 14);
  const { data: mentions } = useMentions(entityId, undefined, 200);

  return useQuery({
    queryKey: ["po_alerts", entityId, snapshots?.length, mentions?.length],
    enabled: !!entityId && !!snapshots,
    queryFn: async (): Promise<PoAlert[]> => {
      const alerts: PoAlert[] = [];
      if (!snapshots || snapshots.length < 2) return alerts;

      // Find the most recent mention with a URL to use as fallback link
      const latestMentionUrl = mentions?.find(m => m.source_url)?.source_url || undefined;

      const sorted = [...snapshots].sort(
        (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
      );
      const last = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];

      // ── Sentiment Drop ──────────────────────────────────────────
      if (last && prev && prev.total_mentions > 0 && last.total_mentions > 0) {
        const lastPositivePct = last.total_mentions > 0 ? (last.positive_count / last.total_mentions) * 100 : 0;
        const prevPositivePct = prev.total_mentions > 0 ? (prev.positive_count / prev.total_mentions) * 100 : 0;
        const drop = prevPositivePct - lastPositivePct;

        if (drop > 20) {
          alerts.push({
            id: "sentiment-drop",
            level: "critical",
            type: "sentiment_drop",
            title: "Queda brusca no sentimento positivo",
            description: `O sentimento positivo caiu ${drop.toFixed(0)}pp em relação ao dia anterior (de ${prevPositivePct.toFixed(0)}% para ${lastPositivePct.toFixed(0)}%). Verifique as menções recentes.`,
            value: Math.round(drop),
            threshold: 20,
            sourceUrl: latestMentionUrl,
            detectedAt: last.snapshot_date,
          });
        } else if (drop > 10) {
          alerts.push({
            id: "sentiment-warning",
            level: "warning",
            type: "sentiment_drop",
            title: "Sentimento positivo em declínio",
            description: `Queda de ${drop.toFixed(0)}pp no sentimento positivo. Acompanhe a tendência.`,
            value: Math.round(drop),
            threshold: 10,
            sourceUrl: latestMentionUrl,
            detectedAt: last.snapshot_date,
          });
        }

        // ── Negative Spike ───────────────────────────────────────
        const lastNegPct = last.total_mentions > 0 ? (last.negative_count / last.total_mentions) * 100 : 0;
        const prevNegPct = prev.total_mentions > 0 ? (prev.negative_count / prev.total_mentions) * 100 : 0;
        const negRise = lastNegPct - prevNegPct;

        if (negRise > 25) {
          alerts.push({
            id: "negative-spike",
            level: "critical",
            type: "negative_spike",
            title: "Pico de menções negativas detectado",
            description: `Menções negativas aumentaram ${negRise.toFixed(0)}pp — agora em ${lastNegPct.toFixed(0)}% do total. Ação imediata recomendada.`,
            value: Math.round(lastNegPct),
            sourceUrl: latestMentionUrl,
            detectedAt: last.snapshot_date,
          });
        }

        // ── Mention Spike ────────────────────────────────────────
        const mentionRatio = prev.total_mentions > 0 ? last.total_mentions / prev.total_mentions : 0;
        if (mentionRatio > 3) {
          alerts.push({
            id: "mention-spike",
            level: "warning",
            type: "mention_spike",
            title: "Volume de menções muito acima do normal",
            description: `${last.total_mentions} menções hoje — ${mentionRatio.toFixed(1)}x a mais que ontem (${prev.total_mentions}). Evento viral em andamento?`,
            value: last.total_mentions,
            sourceUrl: latestMentionUrl,
            detectedAt: last.snapshot_date,
          });
        }

        // ── Positive Surge ──────────────────────────────────────
        const posRise = lastPositivePct - prevPositivePct;
        if (posRise > 20 && lastPositivePct > 60) {
          alerts.push({
            id: "positive-surge",
            level: "info",
            type: "positive_surge",
            title: "Onda positiva detectada!",
            description: `Sentimento positivo subiu ${posRise.toFixed(0)}pp para ${lastPositivePct.toFixed(0)}%. Ótimo momento para ampliar o engajamento.`,
            value: Math.round(lastPositivePct),
            sourceUrl: latestMentionUrl,
            detectedAt: last.snapshot_date,
          });
        }
      }

      // ── Low Activity ────────────────────────────────────────────
      const recentSnapshots = sorted.slice(-7);
      const avgMentions = recentSnapshots.reduce((s, sn) => s + sn.total_mentions, 0) / recentSnapshots.length;
      if (avgMentions < 5 && recentSnapshots.length >= 3) {
        alerts.push({
          id: "low-activity",
          level: "info",
          type: "low_activity",
          title: "Baixa atividade de menções",
          description: `Média de apenas ${avgMentions.toFixed(0)} menções/dia nos últimos ${recentSnapshots.length} dias. Considere aumentar a frequência de coleta.`,
          value: Math.round(avgMentions),
          sourceUrl: latestMentionUrl,
          detectedAt: new Date().toISOString(),
        });
      }

      // ── Viral content from mentions ─────────────────────────────
      if (mentions && mentions.length > 0) {
        const highEngagement = mentions.filter((m) => {
          const eng = m.engagement as Record<string, number> | null;
          if (!eng) return false;
          const total = Object.values(eng).reduce((s, v) => s + v, 0);
          return total > 500;
        });

        if (highEngagement.length > 0) {
          const top = highEngagement[0];
          const eng = top.engagement as Record<string, number>;
          const total = Object.values(eng).reduce((s, v) => s + v, 0);
          alerts.push({
            id: `viral-${top.id}`,
            level: "info",
            type: "viral_content",
            title: "Conteúdo viral identificado",
            description: `Post de @${top.author_handle || top.author_name || "usuário"} no ${top.source} com ${total.toLocaleString()} interações.`,
            value: total,
            source: top.source,
            sourceUrl: top.source_url || undefined,
            detectedAt: top.collected_at,
          });
        }
      }

      return alerts;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/**
 * Returns the trend delta comparing last 7 days vs previous 7 days.
 * Returns { positiveDelta, negativeDelta, mentionsDelta } in percentage points.
 */
export function usePoTrendDelta(entityId?: string) {
  const { data: snapshots } = useDailySnapshots(entityId, 14);

  return useQuery({
    queryKey: ["po_trend_delta", entityId, snapshots?.length],
    enabled: !!entityId && !!snapshots && snapshots.length >= 7,
    queryFn: async () => {
      if (!snapshots || snapshots.length < 7) return null;

      const sorted = [...snapshots].sort(
        (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
      );

      const last7 = sorted.slice(-7);
      const prev7 = sorted.slice(-14, -7);

      const agg = (arr: typeof sorted) => {
        const total = arr.reduce((s, sn) => s + sn.total_mentions, 0);
        const pos = arr.reduce((s, sn) => s + sn.positive_count, 0);
        const neg = arr.reduce((s, sn) => s + sn.negative_count, 0);
        return {
          mentions: total,
          positivePct: total > 0 ? (pos / total) * 100 : 0,
          negativePct: total > 0 ? (neg / total) * 100 : 0,
          avgScore: arr.reduce((s, sn) => s + sn.avg_sentiment_score, 0) / Math.max(1, arr.length),
        };
      };

      const current = agg(last7);
      const previous = prev7.length >= 3 ? agg(prev7) : null;

      return {
        current,
        previous,
        positiveDelta: previous ? current.positivePct - previous.positivePct : null,
        negativeDelta: previous ? current.negativePct - previous.negativePct : null,
        mentionsDelta: previous && previous.mentions > 0 ? ((current.mentions - previous.mentions) / previous.mentions) * 100 : null,
        scoreDelta: previous ? current.avgScore - previous.avgScore : null,
      };
    },
    staleTime: 60_000,
  });
}
