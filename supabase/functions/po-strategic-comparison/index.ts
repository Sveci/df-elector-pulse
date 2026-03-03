import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { entities } = await req.json();
    if (!entities || entities.length < 2) {
      throw new Error("At least 2 entities with stats are required");
    }

    const aspects = [
      "Conexão Popular e Carisma",
      "Posicionamento em Segurança Pública",
      "Associação Política (Centrão)",
      "Entrega de Resultados (Saúde/Infraestrutura)",
      "Reconhecimento de Atuação Federal",
      "Apoio à Cultura Local",
    ];

    const prompt = `Você é um estrategista político de alto nível. Analise os dados comparativos entre entidades políticas e gere uma análise estratégica completa.

ENTIDADES MONITORADAS:
${entities.map((e: any, i: number) => `${i + 1}. ${e.nome} (${e.partido || 'Sem partido'})${e.is_principal ? ' [PRINCIPAL]' : ' [ADVERSÁRIO]'}
   - Menções: ${e.mentions}
   - Sentimento: ${e.sentiment_score}/10
   - Positivo: ${e.positive_pct}% | Negativo: ${e.negative_pct}% | Neutro: ${e.neutral_pct}%
   - Engajamento Total: ${e.engagement_total}
   - Eng. Médio por menção: ${e.engagement_rate}
   - Temas principais: ${(e.top_topics || []).join(', ') || 'N/A'}`).join('\n\n')}

ASPECTOS A AVALIAR (escala 0-100 para cada entidade):
${aspects.map((a, i) => `${i + 1}. ${a}`).join('\n')}

INSTRUÇÕES:
1. Atribua uma nota de 0 a 100 para CADA entidade em CADA aspecto, baseado nos dados reais fornecidos.
2. MUITO IMPORTANTE: No campo entity_name do radar_scores, use EXATAMENTE o nome da entidade como fornecido acima, sem abreviar ou alterar. Exemplo: se o nome é "${entities[0]?.nome}", use exatamente "${entities[0]?.nome}".
3. Identifique fraquezas do principal (aspectos onde perde para adversários).
4. Identifique forças do principal (aspectos onde supera adversários).
5. Gere oportunidades estratégicas baseadas nos gaps.
6. Crie um plano de cobertura com EXATAMENTE 14 entradas no cronograma_14_dias, uma para cada dia (dia 1 a dia 14, sem pular nenhum). Inclua também mensagens recomendadas e mensagens a evitar.

Seja realista e baseie-se nos dados fornecidos. Se os dados são limitados, indique baixa confiança.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um estrategista político de comunicação. Responda APENAS com a chamada de função estruturada." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_strategic_analysis",
            description: "Save the complete strategic comparison analysis",
            parameters: {
              type: "object",
              properties: {
                radar_scores: {
                  type: "array",
                  description: "Scores for each entity across all aspects",
                  items: {
                    type: "object",
                    properties: {
                      entity_name: { type: "string" },
                      scores: {
                        type: "object",
                        properties: {
                          conexao_popular: { type: "number" },
                          causas_especificas: { type: "number" },
                          associacao_politica: { type: "number" },
                          entrega_resultados: { type: "number" },
                          atuacao_federal: { type: "number" },
                          cultura_local: { type: "number" },
                        },
                      },
                    },
                  },
                },
                fraquezas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      aspecto: { type: "string" },
                      definicao: { type: "string" },
                      por_que_fraqueza: { type: "string" },
                      impacto: { type: "string", enum: ["alto", "medio", "baixo"] },
                      score_principal: { type: "number" },
                      score_melhor_adversario: { type: "number" },
                      adversario_referencia: { type: "string" },
                    },
                    required: ["aspecto", "definicao", "por_que_fraqueza", "impacto"],
                  },
                },
                forcas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      aspecto: { type: "string" },
                      definicao: { type: "string" },
                      por_que_forca: { type: "string" },
                      impacto: { type: "string", enum: ["alto", "medio", "baixo"] },
                      score_principal: { type: "number" },
                      score_melhor_adversario: { type: "number" },
                    },
                    required: ["aspecto", "definicao", "por_que_forca", "impacto"],
                  },
                },
                oportunidades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      titulo: { type: "string" },
                      descricao: { type: "string" },
                      prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
                      aspecto_relacionado: { type: "string" },
                    },
                    required: ["titulo", "descricao", "prioridade"],
                  },
                },
                plano_cobertura: {
                  type: "object",
                  properties: {
                    mensagens_recomendadas: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          mensagem: { type: "string" },
                          canal: { type: "string" },
                          objetivo: { type: "string" },
                        },
                      },
                    },
                    mensagens_evitar: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          mensagem: { type: "string" },
                          motivo: { type: "string" },
                        },
                      },
                    },
                    cronograma_14_dias: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          dia: { type: "number" },
                          acao: { type: "string" },
                          canal: { type: "string" },
                          aspecto_foco: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
              required: ["radar_scores", "fraquezas", "forcas", "oportunidades", "plano_cobertura"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_strategic_analysis" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in po-strategic-comparison:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
