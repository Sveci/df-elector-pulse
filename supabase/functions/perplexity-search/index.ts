import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SearchType =
  | "general"         // Busca geral
  | "news_clipping"   // Clipping de notícias sobre entidade
  | "legislation"     // Monitoramento legislativo
  | "public_opinion"  // Contexto para opinião pública
  | "whatsapp_fallback"; // Fallback do chatbot

interface SearchRequest {
  type: SearchType;
  query: string;
  entity_name?: string;
  tenant_id?: string;
  options?: {
    lang?: string;
    country?: string;
    recency?: "day" | "week" | "month" | "year";
    max_tokens?: number;
  };
}

function buildSystemPrompt(type: SearchType, entityName?: string): string {
  const base = "Responda sempre em português brasileiro. Seja preciso e factual. Cite as fontes quando possível.";

  switch (type) {
    case "news_clipping":
      return `${base}\nVocê está monitorando notícias sobre "${entityName || "a entidade"}". Retorne um resumo estruturado das notícias mais recentes e relevantes. Para cada notícia, indique: título, fonte, data aproximada e resumo. Foque em notícias políticas, legislativas e de interesse público.`;

    case "legislation":
      return `${base}\nVocê é um assistente especializado em legislação brasileira. Busque informações sobre projetos de lei, votações, comissões parlamentares e atividades legislativas. Seja preciso com números de PLs, datas e status.`;

    case "public_opinion":
      return `${base}\nVocê está analisando a percepção pública sobre "${entityName || "a entidade"}". Busque análises, comentários de especialistas, editoriais e matérias de opinião. Identifique tendências de sentimento (positivo/negativo/neutro) e os principais temas em discussão.`;

    case "whatsapp_fallback":
      return `${base}\nVocê é um assistente virtual de um gabinete parlamentar. Responda de forma breve (máximo 500 caracteres), amigável e informativa. Use emojis moderadamente. Se não encontrar informação confiável, diga que não tem dados suficientes.`;

    default:
      return `${base}\nResponda de forma clara e concisa.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ success: false, error: "PERPLEXITY_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SearchRequest = await req.json();
    const { type = "general", query, entity_name, options } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: "query é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[perplexity-search] type=${type}, query="${query.substring(0, 80)}..."`);

    const systemPrompt = buildSystemPrompt(type, entity_name);

    // Choose model based on use case
    const model = type === "whatsapp_fallback" ? "sonar" : "sonar-pro";

    const perplexityBody: any = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      max_tokens: options?.max_tokens || (type === "whatsapp_fallback" ? 300 : 1000),
    };

    // Add recency filter for time-sensitive searches
    if (options?.recency) {
      perplexityBody.search_recency_filter = options.recency;
    } else if (type === "news_clipping") {
      perplexityBody.search_recency_filter = "week";
    } else if (type === "public_opinion") {
      perplexityBody.search_recency_filter = "month";
    }

    // Add language preference
    if (options?.lang || options?.country) {
      perplexityBody.search_domain_filter = [];
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(perplexityBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[perplexity-search] API error ${response.status}:`, errText);

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos do Perplexity insuficientes. Verifique sua assinatura." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `Perplexity API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    console.log(`[perplexity-search] Success: ${answer.length} chars, ${citations.length} citations`);

    return new Response(
      JSON.stringify({
        success: true,
        answer,
        citations,
        model: data.model,
        type,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[perplexity-search] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
