import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authentication ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ─────────────────────────────────────────────────────────────────────

  try {
    const { survey, questions, responses } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt with survey data
    const questionsSummary = questions.map((q: any, i: number) => {
      let stats = "";
      const questionResponses = responses
        .map((r: any) => r.respostas[q.id])
        .filter((r: any) => r !== undefined && r !== null && r !== "");

      if (q.tipo === "multipla_escolha" && q.opcoes) {
        const counts: Record<string, number> = {};
        q.opcoes.forEach((opt: string) => counts[opt] = 0);
        questionResponses.forEach((r: string) => {
          if (counts[r] !== undefined) counts[r]++;
        });
        stats = Object.entries(counts)
          .map(([opt, count]) => `${opt}: ${count}`)
          .join(", ");
      } else if (q.tipo === "sim_nao") {
        const sim = questionResponses.filter((r: any) => r === true || r === "sim" || r === "Sim").length;
        const nao = questionResponses.length - sim;
        stats = `Sim: ${sim}, Não: ${nao}`;
      } else if (q.tipo === "escala" || q.tipo === "nps") {
        const nums = questionResponses.map((r: any) => parseInt(String(r))).filter((n: number) => !isNaN(n));
        if (nums.length > 0) {
          const avg = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
          stats = `Média: ${avg.toFixed(1)}, Total respostas: ${nums.length}`;
        }
      } else if (q.tipo === "texto_curto" || q.tipo === "texto_longo") {
        stats = `${questionResponses.length} respostas em texto`;
        if (questionResponses.length > 0 && questionResponses.length <= 5) {
          stats += ": " + questionResponses.slice(0, 3).join(" | ");
        }
      }

      return `${i + 1}. ${q.pergunta} (${q.tipo})\n   Resultados: ${stats}`;
    }).join("\n\n");

    const leaderCount = responses.filter((r: any) => r.is_leader).length;
    const referredCount = responses.filter((r: any) => r.has_referrer).length;
    const directCount = responses.length - leaderCount - referredCount;

    const systemPrompt = `Você é um analista político especializado em pesquisas eleitorais no Brasil. 
Analise os dados da pesquisa fornecida e gere insights estratégicos em português brasileiro.

Sua análise deve incluir:
1. **Resumo Executivo**: Visão geral dos principais achados (2-3 parágrafos)
2. **Principais Insights**: Pontos-chave identificados nas respostas
3. **Análise de Segmentos**: Diferenças entre líderes e contatos gerais
4. **Oportunidades Identificadas**: Onde há espaço para atuação
5. **Recomendações Estratégicas**: Ações concretas baseadas nos dados
6. **Alertas e Riscos**: Pontos de atenção que merecem monitoramento

Use formatação Markdown com cabeçalhos, listas e negrito para destacar pontos importantes.
Seja objetivo, estratégico e forneça insights acionáveis.`;

    const userPrompt = `Analise a seguinte pesquisa eleitoral:

**Título**: ${survey.titulo}
**Descrição**: ${survey.descricao || "Não informada"}
**Total de Respostas**: ${responses.length}
- Respostas de Líderes: ${leaderCount}
- Respostas via Indicação: ${referredCount}  
- Respostas Diretas: ${directCount}

**Perguntas e Resultados**:

${questionsSummary}

Por favor, forneça uma análise completa seguindo a estrutura solicitada.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("analyze-survey error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
