import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { entity_id, period_days = 7 } = await req.json();
    if (!entity_id) throw new Error("entity_id is required");

    const since = new Date();
    since.setDate(since.getDate() - period_days);

    // Fetch ALL recent analyses with pagination
    let analyses: any[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("po_sentiment_analyses")
        .select("sentiment, sentiment_score, category, topics, emotions, ai_summary, is_about_adversary")
        .eq("entity_id", entity_id)
        .gte("analyzed_at", since.toISOString())
        .order("analyzed_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      analyses = analyses.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Fetch entity
    const { data: entity } = await supabase
      .from("po_monitored_entities")
      .select("nome, tipo, partido, cargo, tenant_id")
      .eq("id", entity_id)
      .single();

    // Fetch snapshots
    const { data: snapshots } = await supabase
      .from("po_daily_snapshots")
      .select("*")
      .eq("entity_id", entity_id)
      .gte("snapshot_date", since.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true });

    if (!analyses?.length) {
      return new Response(JSON.stringify({ 
        success: true, insights: [], 
        message: "Sem dados suficientes para gerar insights." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build summary stats
    const total = analyses.length;
    const positive = analyses.filter(a => a.sentiment === "positivo").length;
    const negative = analyses.filter(a => a.sentiment === "negativo").length;
    const neutral = analyses.filter(a => a.sentiment === "neutro").length;
    const avgScore = analyses.reduce((s, a) => s + (a.sentiment_score || 0), 0) / total;
    
    const topicCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const emotionCounts: Record<string, number> = {};
    
    for (const a of analyses) {
      for (const t of (a.topics || [])) topicCounts[t] = (topicCounts[t] || 0) + 1;
      if (a.category) categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
      for (const e of (a.emotions || [])) emotionCounts[e] = (emotionCounts[e] || 0) + 1;
    }

    const summaries = analyses.slice(0, 30).map(a => a.ai_summary).filter(Boolean).join("\n");

    const prompt = `Você é um consultor político estratégico. Analise os dados de opinião pública e gere insights acionáveis.

ENTIDADE: ${entity?.nome} (${entity?.partido || "Sem partido"}, ${entity?.cargo || ""})
PERÍODO: últimos ${period_days} dias

DADOS AGREGADOS:
- Total de menções analisadas: ${total}
- Positivas: ${positive} (${(positive/total*100).toFixed(1)}%)
- Negativas: ${negative} (${(negative/total*100).toFixed(1)}%)
- Neutras: ${neutral} (${(neutral/total*100).toFixed(1)}%)
- Score médio: ${avgScore.toFixed(3)}

TEMAS MAIS CITADOS: ${Object.entries(topicCounts).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k,v]) => `${k}(${v})`).join(", ")}
CATEGORIAS: ${Object.entries(categoryCounts).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k}(${v})`).join(", ")}
EMOÇÕES: ${Object.entries(emotionCounts).sort((a,b) => b[1]-a[1]).slice(0,8).map(([k,v]) => `${k}(${v})`).join(", ")}

RESUMOS RECENTES:
${summaries}

TENDÊNCIA (snapshots diários): ${JSON.stringify(snapshots?.map(s => ({ date: s.snapshot_date, mentions: s.total_mentions, pos: s.positive_count, neg: s.negative_count })) || [])}

Gere de 4 a 8 insights estratégicos para o político. Cada insight deve ter:
- Tipo: "oportunidade", "alerta", "tendência" ou "recomendação"
- Prioridade: "alta", "média" ou "baixa"
- Confiança: 0.00 a 1.00
- Título curto e impactante
- Descrição detalhada com ação recomendada
- Temas relacionados`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um estrategista político e de comunicação. Responda APENAS com o JSON estruturado." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_insights",
            description: "Save generated insights",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["oportunidade", "alerta", "tendência", "recomendação"] },
                      priority: { type: "string", enum: ["alta", "média", "baixa"] },
                      confidence: { type: "number" },
                      title: { type: "string" },
                      description: { type: "string" },
                      topics: { type: "array", items: { type: "string" } },
                    },
                    required: ["type", "priority", "confidence", "title", "description"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const { insights } = JSON.parse(toolCall.function.arguments);

    const statsObj = { total, positive, negative, neutral, avgScore: Number(avgScore.toFixed(3)) };

    // Persist insights to database
    const { error: insertError } = await supabase
      .from("po_insights")
      .insert({
        entity_id,
        tenant_id: entity?.tenant_id,
        period_days,
        insights,
        stats: statsObj,
        generated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error persisting insights:", insertError);
    }

    return new Response(JSON.stringify({
      success: true,
      insights,
      stats: statsObj,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("po-generate-insights error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
