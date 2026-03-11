import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Allow specifying a date, default to yesterday
    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body.date || getYesterdayDate();
    } catch {
      targetDate = getYesterdayDate();
    }

    console.log(`po-aggregate-daily: aggregating for date ${targetDate}`);

    // Get all active entities
    const { data: entities, error: entErr } = await supabase
      .from("po_monitored_entities")
      .select("id, nome, tenant_id")
      .eq("is_active", true);

    if (entErr) throw entErr;
    if (!entities || entities.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active entities" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;
    let aggregated = 0;

    for (const entity of entities) {
      // Get all sentiment analyses for this entity on the target date
      const { data: analyses, error: aErr } = await supabase
        .from("po_sentiment_analyses")
        .select("sentiment, sentiment_score, topics, emotions, category")
        .eq("entity_id", entity.id)
        .gte("analyzed_at", startOfDay)
        .lte("analyzed_at", endOfDay);

      if (aErr) {
        console.error(`Error fetching analyses for ${entity.nome}:`, aErr);
        continue;
      }

      // Get mentions for source breakdown
      const { data: mentions, error: mErr } = await supabase
        .from("po_mentions")
        .select("source")
        .eq("entity_id", entity.id)
        .gte("collected_at", startOfDay)
        .lte("collected_at", endOfDay);

      if (mErr) {
        console.error(`Error fetching mentions for ${entity.nome}:`, mErr);
        continue;
      }

      const total = analyses?.length || 0;
      if (total === 0 && (!mentions || mentions.length === 0)) {
        console.log(`po-aggregate-daily: no data for ${entity.nome} on ${targetDate}`);
        continue;
      }

      // Calculate sentiment counts
      let positiveCount = 0, negativeCount = 0, neutralCount = 0;
      let totalScore = 0;
      const topicsMap = new Map<string, number>();
      const emotionsMap = new Map<string, number>();

      for (const a of (analyses || [])) {
        if (a.sentiment === "positivo") positiveCount++;
        else if (a.sentiment === "negativo") negativeCount++;
        else neutralCount++;

        if (a.sentiment_score != null) totalScore += Number(a.sentiment_score);

        for (const t of (a.topics || [])) {
          topicsMap.set(t, (topicsMap.get(t) || 0) + 1);
        }
        for (const e of (a.emotions || [])) {
          emotionsMap.set(e, (emotionsMap.get(e) || 0) + 1);
        }
      }

      // Source breakdown
      const sourceMap = new Map<string, number>();
      for (const m of (mentions || [])) {
        sourceMap.set(m.source, (sourceMap.get(m.source) || 0) + 1);
      }

      const totalMentions = mentions?.length || total;
      const avgScore = total > 0 ? totalScore / total : 0;

      // Top topics (sorted by count)
      const topTopics = [...topicsMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Top emotions
      const topEmotions = [...emotionsMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Source breakdown
      const sourceBreakdown = [...sourceMap.entries()]
        .map(([name, count]) => ({ name, count }));

      // Upsert into po_daily_snapshots
      const { error: upsertErr } = await supabase
        .from("po_daily_snapshots")
        .upsert({
          entity_id: entity.id,
          snapshot_date: targetDate,
          total_mentions: totalMentions,
          positive_count: positiveCount,
          negative_count: negativeCount,
          neutral_count: neutralCount,
          avg_sentiment_score: Math.round(avgScore * 1000) / 1000,
          top_topics: topTopics,
          top_emotions: topEmotions,
          source_breakdown: sourceBreakdown,
        }, {
          onConflict: "entity_id,snapshot_date",
        });

      if (upsertErr) {
        console.error(`Upsert error for ${entity.nome}:`, upsertErr);
      } else {
        aggregated++;
        console.log(`po-aggregate-daily: aggregated ${entity.nome} - ${totalMentions} mentions, score ${avgScore.toFixed(2)}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: targetDate,
      entities_aggregated: aggregated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("po-aggregate-daily error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}
