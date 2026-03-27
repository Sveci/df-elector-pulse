import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Thresholds de similaridade
const CACHE_THRESHOLD_HIGH = 0.85;
const CACHE_THRESHOLD_MEDIUM = 0.70;
const KB_THRESHOLD = 0.75;

// ─── NORMALIZAR TEXTO ─────────────────────────────────────────────
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── DETECTAR INTENÇÃO POR KEYWORDS ──────────────────────────────
function detectarIntencao(texto: string): string | null {
  const norm = normalizar(texto);
  const mapa: Record<string, string[]> = {
    proposicoes: ["proposicao", "pl ", "pec", "projeto de lei", "legislat", "tramita", "votacao", "plenario", "camara", "senado"],
    eventos: ["evento", "inscricao", "checkin", "check-in", "agenda", "reuniao", "encontro"],
    liderancas: ["lider", "lideranca", "coordenador", "base eleitoral", "apoiador"],
    contatos: ["contato", "telefone", "email", "whatsapp", "numero"],
    campanhas: ["campanha", "marketing", "propaganda", "material", "panfleto", "santinho"],
    materiais: ["material", "documento", "arquivo", "pdf", "download"],
    pesquisas: ["pesquisa", "enquete", "survey", "opiniao", "resultado"],
  };
  for (const [cat, keywords] of Object.entries(mapa)) {
    if (keywords.some(kw => norm.includes(kw))) return cat;
  }
  return null;
}

// ─── GERAR EMBEDDING ─────────────────────────────────────────────
async function gerarEmbedding(supabaseUrl: string, serviceKey: string, texto: string): Promise<number[]> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/brain-embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ text: texto }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error("Embedding failed: " + data.error);
  return data.embeddings;
}

// ─── BUSCAR NO CACHE ─────────────────────────────────────────────
async function buscarCache(
  supabase: any,
  tenantId: string,
  embedding: number[]
): Promise<{ hit: boolean; resposta?: string; tipo?: string; cacheId?: string; similaridade: number; contexto?: string }> {
  const { data, error } = await supabase.rpc("brain_search_cache", {
    p_tenant_id: tenantId,
    p_embedding: JSON.stringify(embedding),
    p_limit: 3,
    p_threshold: CACHE_THRESHOLD_MEDIUM,
  });

  if (error || !data || data.length === 0) {
    return { hit: false, similaridade: 0 };
  }

  const melhor = data[0];

  if (melhor.similaridade >= CACHE_THRESHOLD_HIGH && melhor.score_confianca >= 0.7) {
    // HIT! Resposta direta do cache
    try { await supabase.rpc("brain_cache_hit", { p_cache_id: melhor.id }); } catch { /* ignore */ }
    return {
      hit: true,
      resposta: melhor.resposta,
      tipo: melhor.resposta_tipo,
      cacheId: melhor.id,
      similaridade: melhor.similaridade,
    };
  }

  // Similaridade média — usar como contexto
  return {
    hit: false,
    similaridade: melhor.similaridade,
    contexto: `Perguntas similares anteriores:\n${data.map((d: any) =>
      `- "${d.pergunta_original}" → ${d.resposta.substring(0, 200)}`
    ).join("\n")}`,
  };
}

// ─── BUSCAR NO KB ────────────────────────────────────────────────
async function buscarKB(
  supabase: any,
  tenantId: string,
  embedding: number[]
): Promise<{ found: boolean; chunks?: string; contexto?: string }> {
  const { data, error } = await supabase.rpc("brain_search_kb", {
    p_tenant_id: tenantId,
    p_embedding: JSON.stringify(embedding),
    p_limit: 5,
    p_threshold: KB_THRESHOLD - 0.10,
  });

  if (error || !data || data.length === 0) {
    return { found: false };
  }

  const topMatch = data[0];

  if (topMatch.similaridade >= KB_THRESHOLD && topMatch.resumo) {
    return {
      found: true,
      chunks: data.map((d: any) => d.content).join("\n---\n"),
      contexto: `Informações relevantes da base de conhecimento:\n${data.map((d: any) =>
        d.resumo || d.content.substring(0, 300)
      ).join("\n\n")}`,
    };
  }

  if (data.length > 0) {
    return {
      found: false,
      contexto: `Informações parcialmente relevantes da base de conhecimento:\n${data.map((d: any) =>
        (d.resumo || d.content.substring(0, 200))
      ).join("\n\n")}`,
    };
  }

  return { found: false };
}

// ─── GERAR CLARIFICAÇÃO ──────────────────────────────────────────
function gerarClarificacao(intencao: string | null): string {
  if (intencao) {
    const mapaClarificacao: Record<string, string> = {
      proposicoes: "Sobre proposições legislativas, você gostaria de saber:\n\n1️⃣ Status de uma proposição específica\n2️⃣ Últimas tramitações\n3️⃣ Proposições do parlamentar\n\nEscolha uma opção ou me dê mais detalhes!",
      eventos: "Sobre eventos, posso ajudar com:\n\n1️⃣ Próximos eventos agendados\n2️⃣ Inscrição em evento\n3️⃣ Detalhes de um evento específico\n\nQual dessas opções?",
      liderancas: "Sobre lideranças, posso consultar:\n\n1️⃣ Lista de líderes por região\n2️⃣ Informações de um líder específico\n3️⃣ Ranking de lideranças\n\nO que precisa?",
      contatos: "Sobre contatos, posso ajudar com:\n\n1️⃣ Buscar um contato\n2️⃣ Atualizar dados de contato\n3️⃣ Lista de contatos por região\n\nComo posso ajudar?",
      campanhas: "Sobre campanhas e materiais, posso ajudar com:\n\n1️⃣ Materiais disponíveis\n2️⃣ Status de campanha em andamento\n3️⃣ Solicitar material\n\nQual opção?",
    };
    if (mapaClarificacao[intencao]) return mapaClarificacao[intencao];
  }

  return "Posso ajudar com várias coisas! Me diga sobre o que precisa:\n\n" +
    "📋 *Proposições* — Acompanhamento legislativo\n" +
    "📅 *Eventos* — Agenda e inscrições\n" +
    "👥 *Lideranças* — Rede de apoio\n" +
    "📊 *Pesquisas* — Resultados e análises\n" +
    "📢 *Campanhas* — Materiais e ações\n\n" +
    "Pode também me fazer uma pergunta direta que eu encontro a resposta!";
}

// ─── SALVAR NO CACHE (APRENDIZADO) ──────────────────────────────
async function salvarNoCache(
  supabase: any,
  tenantId: string,
  pergunta: string,
  resposta: string,
  embedding: number[],
  categoria: string | null,
  intencao: string | null,
  origem: string
) {
  try {
    await supabase.from("brain_cache").insert({
      tenant_id: tenantId,
      pergunta_original: pergunta,
      pergunta_normalizada: normalizar(pergunta),
      embedding: JSON.stringify(embedding),
      resposta: resposta,
      categoria: categoria || "geral",
      intencao: intencao,
      origem: origem,
      score_confianca: 0.8,
    });
  } catch (err) {
    console.error("[brain-resolve] Error saving to cache:", err);
  }
}

// ─── REGISTRAR MÉTRICA ──────────────────────────────────────────
async function registrarMetrica(supabase: any, tenantId: string, camada: string) {
  try {
    await supabase.rpc("brain_record_metric", {
      p_tenant_id: tenantId,
      p_camada: camada,
    });
  } catch (err) {
    console.error("[brain-resolve] Error recording metric:", err);
  }
}

// ─── HANDLER PRINCIPAL ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { message, phone, tenantId, conversationHistory, skipAI } = await req.json();

    if (!message || !tenantId) {
      throw new Error("message and tenantId are required");
    }

    console.log(`[brain-resolve] tenant=${tenantId} phone=${phone} msg="${message.substring(0, 50)}..."`);

    // ─── PASSO 1: Detectar intenção por keywords ─────────────
    const intencao = detectarIntencao(message);

    // ─── PASSO 2: Gerar embedding da mensagem ────────────────
    let embedding: number[];
    try {
      embedding = await gerarEmbedding(supabaseUrl, serviceKey, message);
    } catch (err) {
      console.error("[brain-resolve] Embedding failed, falling back to AI:", err);
      // If embedding fails, return null so the caller falls back to AI
      return new Response(
        JSON.stringify({
          success: true,
          response: null,
          source: "embedding_failed",
          fallbackToAI: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASSO 3: Buscar no cache semântico ──────────────────
    const cacheResult = await buscarCache(supabase, tenantId, embedding);

    if (cacheResult.hit) {
      console.log(`[brain-resolve] CACHE HIT (${cacheResult.similaridade.toFixed(2)})`);
      await registrarMetrica(supabase, tenantId, "cache");

      return new Response(
        JSON.stringify({
          success: true,
          response: cacheResult.resposta,
          source: "cache",
          similaridade: cacheResult.similaridade,
          cacheId: cacheResult.cacheId,
          fallbackToAI: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASSO 4: Buscar no KB ───────────────────────────────
    const kbResult = await buscarKB(supabase, tenantId, embedding);

    // ─── PASSO 5: Montar contexto para a IA ──────────────────
    const contextoPartes: string[] = [];
    if (cacheResult.contexto) contextoPartes.push(cacheResult.contexto);
    if (kbResult.contexto) contextoPartes.push(kbResult.contexto);

    const contextoStr = contextoPartes.length > 0
      ? `\n\nCONTEXTO DO CÉREBRO IA:\n${contextoPartes.join("\n\n")}`
      : "";

    // Se não tem NENHUM contexto e a intenção é vaga → clarificação
    if (!kbResult.found && cacheResult.similaridade < 0.50 && !intencao && !skipAI) {
      const clarificacao = gerarClarificacao(null);
      console.log(`[brain-resolve] CLARIFICAÇÃO (sem contexto)`);
      await registrarMetrica(supabase, tenantId, "clarificacao");

      return new Response(
        JSON.stringify({
          success: true,
          response: clarificacao,
          source: "clarificacao",
          intencao: null,
          fallbackToAI: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASSO 6: Retornar contexto para que o caller use a IA ──
    // O brain-resolve NÃO chama a IA diretamente — ele retorna o contexto
    // enriquecido para que o whatsapp-chatbot use no generateAIResponse
    console.log(`[brain-resolve] Returning context for AI (${contextoPartes.length} parts, kb=${kbResult.found})`);

    return new Response(
      JSON.stringify({
        success: true,
        response: null,
        source: kbResult.found ? "kb_context" : "partial_context",
        fallbackToAI: true,
        brainContext: contextoStr,
        brainIntencao: intencao,
        embedding: embedding, // Return for caching after AI responds
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[brain-resolve] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message, fallbackToAI: true }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
