import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 25;

async function analyzeBatch(
  supabase: any,
  mentions: any[],
  entity: any,
  adversaries: any[],
  entityId: string,
  lovableApiKey: string,
): Promise<number> {
  const adversaryNames = adversaries.map(a => a.nome);
  const adversaryMap = adversaries.reduce((acc: Record<string, string>, a) => {
    acc[a.nome] = a.id;
    return acc;
  }, {});

  const systemPrompt = `Você é um analista especializado em opinião pública e comunicação política brasileira.
Analise cada menção e retorne um JSON com a análise de sentimento e categorização.

Contexto:
- Entidade principal: ${entity?.nome || "Desconhecida"} (${entity?.tipo || "político"}, ${entity?.partido || ""}, ${entity?.cargo || ""})
- Adversários conhecidos: ${adversaryNames.join(", ") || "Nenhum cadastrado"}

Para cada menção, determine:
1. sentiment: "positivo", "negativo" ou "neutro"
2. sentiment_score: número de -1.000 (muito negativo) a 1.000 (muito positivo)
3. category: uma de: "elogio", "reclamação", "dúvida", "sugestão", "notícia", "ataque", "defesa", "humor", "fake_news"
4. subcategory: detalhamento livre da categoria
5. topics: array de temas (saúde, segurança, educação, transporte, meio_ambiente, economia, infraestrutura, política, social, cultura, esporte)
6. emotions: array de emoções detectadas (raiva, esperança, medo, alegria, tristeza, indignação, orgulho, deboche, ironia)
7. is_about_adversary: boolean se menciona adversário
8. adversary_entity_id: UUID do adversário se aplicável, ou null
9. confidence: 0.00 a 1.00
10. ai_summary: resumo de 1 linha do sentimento

IMPORTANTE: Se a menção NÃO é sobre a entidade principal (ex: é sobre uma cidade homônima, conteúdo genérico de entretenimento, etc.), marque confidence como 0.00 e ai_summary começando com "Menção irrelevante:".`;

  const mentionsText = mentions.map((m, i) =>
    `[${i}] ID: ${m.id}\nFonte: ${m.source}\nAutor: ${m.author_name || "Anônimo"}\nConteúdo: ${m.content}\nHashtags: ${(m.hashtags || []).join(", ")}`
  ).join("\n\n---\n\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analise as seguintes ${mentions.length} menções e retorne APENAS um JSON array com os resultados:\n\n${mentionsText}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "save_sentiment_analyses",
          description: "Save sentiment analysis results for mentions",
          parameters: {
            type: "object",
            properties: {
              analyses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    mention_index: { type: "number" },
                    sentiment: { type: "string", enum: ["positivo", "negativo", "neutro"] },
                    sentiment_score: { type: "number" },
                    category: { type: "string" },
                    subcategory: { type: "string" },
                    topics: { type: "array", items: { type: "string" } },
                    emotions: { type: "array", items: { type: "string" } },
                    is_about_adversary: { type: "boolean" },
                    adversary_name: { type: "string" },
                    confidence: { type: "number" },
                    ai_summary: { type: "string" },
                  },
                  required: ["mention_index", "sentiment", "sentiment_score", "category", "confidence", "ai_summary"],
                },
              },
            },
            required: ["analyses"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "save_sentiment_analyses" } },
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error(`AI gateway error: ${response.status}`, t);
    if (response.status === 429) throw new Error("Rate limit exceeded");
    if (response.status === 402) throw new Error("Créditos insuficientes");
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const aiResult = await response.json();
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const { analyses } = JSON.parse(toolCall.function.arguments);

  const records = analyses.map((a: any) => {
    const mention = mentions[a.mention_index];
    if (!mention) return null;
    return {
      mention_id: mention.id,
      entity_id: entityId,
      tenant_id: tenantId,
      sentiment: a.sentiment,
      sentiment_score: a.sentiment_score,
      category: a.category,
      subcategory: a.subcategory || null,
      topics: a.topics || [],
      emotions: a.emotions || [],
      is_about_adversary: a.is_about_adversary || false,
      adversary_entity_id: a.adversary_name ? (adversaryMap[a.adversary_name] || null) : null,
      confidence: a.confidence,
      ai_summary: a.ai_summary,
      ai_model: "google/gemini-3-flash-preview",
    };
  }).filter(Boolean);

  if (records.length === 0) return 0;

  const { data: inserted, error: insertError } = await supabase
    .from("po_sentiment_analyses")
    .insert(records)
    .select("id");

  if (insertError) {
    console.error("Insert error:", insertError);
    throw insertError;
  }

  return inserted?.length || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mention_ids, entity_id, analyze_pending } = await req.json();

    if (!entity_id) throw new Error("entity_id is required");

    let mentionIdsToAnalyze = mention_ids || [];

    // If analyze_pending=true OR no mention_ids provided, find unanalyzed mentions
    if ((analyze_pending || !mentionIdsToAnalyze.length) && entity_id) {
      const { data: unanalyzed } = await supabase.rpc("get_unanalyzed_mention_ids", {
        _entity_id: entity_id,
        _limit: 200,
      });
      mentionIdsToAnalyze = unanalyzed?.map((r: any) => r.id) || [];
      console.log(`Found ${mentionIdsToAnalyze.length} unanalyzed mentions`);
    }

    if (!mentionIdsToAnalyze.length) {
      return new Response(JSON.stringify({ success: true, analyzed: 0, message: "Nenhuma menção pendente." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all mentions
    const { data: allMentions, error: fetchError } = await supabase
      .from("po_mentions")
      .select("id, content, source, author_name, hashtags")
      .in("id", mentionIdsToAnalyze);

    if (fetchError) throw fetchError;
    if (!allMentions?.length) throw new Error("No mentions found");

    // Fetch entity and adversaries
    const { data: entity } = await supabase
      .from("po_monitored_entities")
      .select("nome, tipo, partido, cargo, palavras_chave")
      .eq("id", entity_id)
      .single();

    const { data: adversaries } = await supabase
      .from("po_monitored_entities")
      .select("id, nome, partido")
      .eq("tipo", "adversario")
      .eq("is_active", true);

    // Process in batches in the background to avoid timeout
    const batches: any[][] = [];
    for (let i = 0; i < allMentions.length; i += BATCH_SIZE) {
      batches.push(allMentions.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${allMentions.length} mentions in ${batches.length} batches of ${BATCH_SIZE} (background)`);

    const backgroundTask = (async () => {
      let totalAnalyzed = 0;
      for (const batch of batches) {
        try {
          const count = await analyzeBatch(supabase, batch, entity, adversaries || [], entity_id, LOVABLE_API_KEY);
          totalAnalyzed += count;
          console.log(`Batch done: ${count} analyzed (total: ${totalAnalyzed})`);
        } catch (err) {
          console.error(`Batch error (${batch.length} mentions):`, err);
          // Continue with next batch even if one fails
        }
      }
      console.log(`Background processing complete: ${totalAnalyzed} analyzed out of ${allMentions.length}`);

      // Trigger daily snapshot aggregation for today
      try {
        const today = new Date().toISOString().split("T")[0];
        const aggRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/po-aggregate-daily`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ date: today }),
        });
        console.log(`Aggregation triggered for ${today}: status ${aggRes.status}`);
      } catch (aggErr) {
        console.error("Failed to trigger aggregation:", aggErr);
      }
    })();

    // Use EdgeRuntime.waitUntil to keep processing after response
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask);
    }

    return new Response(JSON.stringify({
      success: true,
      background: true,
      total_mentions: allMentions.length,
      batches: batches.length,
      message: `Processando ${allMentions.length} menções em segundo plano.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-sentiment error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
