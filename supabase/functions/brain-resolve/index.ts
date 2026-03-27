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
    proposicoes: ["proposicao", "proposicoes", "monitorad", "pl ", "pec", "projeto de lei", "legislat", "tramita", "votacao", "plenario", "camara", "senado"],
    eventos: ["evento", "eventos", "inscricao", "checkin", "check-in", "agenda", "reuniao", "encontro", "proximo", "proximos"],
    liderancas: ["lider", "lideres", "lideranca", "liderancas", "coordenador", "base eleitoral", "apoiador", "apoiadores"],
    contatos: ["contato", "contatos", "telefone", "email", "whatsapp", "numero"],
    campanhas: ["campanha", "campanhas", "marketing", "propaganda", "panfleto", "santinho"],
    materiais: ["material", "materiais", "documento", "documentos", "arquivo", "pdf", "download"],
    pesquisas: ["pesquisa", "pesquisas", "enquete", "survey", "opiniao", "resultado"],
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

// ─── ENRIQUECER CONTEXTO COM DADOS REAIS DO TENANT ────────────
async function enriquecerContexto(
  supabase: any,
  tenantId: string,
  intencao: string | null,
  mensagem: string
): Promise<string | null> {
  if (!intencao) return null;

  try {
    switch (intencao) {
      case "eventos": {
        const { data: eventos } = await supabase
          .from("events")
          .select("id, name, date, time, location, address, status")
          .eq("tenant_id", tenantId)
          .in("status", ["active", "published"])
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date", { ascending: true })
          .limit(10);

        if (eventos && eventos.length > 0) {
          const lista = eventos.map((e: any) => {
            const data = e.date ? new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR") : "";
            return `- ${e.name} | ${data}${e.time ? " às " + e.time : ""} | ${e.location || ""}${e.address ? " — " + e.address : ""}`;
          }).join("\n");
          return `EVENTOS AGENDADOS (dados reais do banco de dados):\n${lista}\n\nIMPORTANTE: Esses dados são REAIS e ATUALIZADOS. Use-os para responder sobre eventos. Liste os eventos disponíveis quando perguntarem.`;
        }
        return "Não há eventos futuros cadastrados no momento. Informe ao usuário que o calendário será atualizado em breve e pergunte se pode ajudar com outra coisa.";
      }

      case "liderancas": {
        const { data: lideres, count } = await supabase
          .from("lideres")
          .select("id, nome_completo, localidade, is_coordinator, status", { count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(5);

        if (count && count > 0) {
          return `LIDERANÇAS: ${count} líderes cadastrados ativos. Exemplos: ${(lideres || []).map((l: any) => `${l.nome_completo} (${l.localidade || "sem localidade"})`).join(", ")}. Pergunte ao usuário de qual região ou líder específico precisa informação.`;
        }
        return null;
      }

      case "proposicoes": {
        const { data: props } = await supabase
          .from("proposicoes_monitoradas")
          .select("sigla_tipo, numero, ano, ementa, descricao_situacao")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .order("updated_at", { ascending: false })
          .limit(5);

        if (props && props.length > 0) {
          const lista = props.map((p: any) =>
            `- ${p.sigla_tipo} ${p.numero}/${p.ano}: ${(p.ementa || "").substring(0, 100)} [${p.descricao_situacao || "Em tramitação"}]`
          ).join("\n");
          return `PROPOSIÇÕES MONITORADAS (dados reais):\n${lista}\n\nUse esses dados para responder. São reais e atualizados.`;
        }
        return null;
      }

      case "contatos": {
        const { count } = await supabase
          .from("office_contacts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

        if (count && count > 0) {
          return `O gabinete possui ${count} contatos cadastrados. Pergunte ao usuário qual contato específico ou de qual região precisa informação.`;
        }
        return null;
      }

      case "campanhas": {
        const { data: campanhas } = await supabase
          .from("campaigns")
          .select("id, nome, status")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (campanhas && campanhas.length > 0) {
          const lista = campanhas.map((c: any) => `- ${c.nome} (${c.status})`).join("\n");
          return `CAMPANHAS RECENTES:\n${lista}`;
        }
        return null;
      }

      case "materiais": {
        const { data: materiais } = await supabase
          .from("campaign_materials")
          .select("id, nome, tipo, estoque_atual")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(5);

        if (materiais && materiais.length > 0) {
          const lista = materiais.map((m: any) => `- ${m.nome} (${m.tipo}) — estoque: ${m.estoque_atual}`).join("\n");
          return `MATERIAIS DISPONÍVEIS:\n${lista}`;
        }
        return null;
      }

      default:
        return null;
    }
  } catch (err) {
    console.error(`[brain-resolve] Error enriching context for ${intencao}:`, err);
    return null;
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

    // ─── PASSO 4.5: Enriquecer contexto com dados reais do banco ──
    const dadosReais = await enriquecerContexto(supabase, tenantId, intencao, message);

    // ─── PASSO 5: Montar contexto para a IA ──────────────────
    const contextoPartes: string[] = [];
    if (cacheResult.contexto) contextoPartes.push(cacheResult.contexto);
    if (kbResult.contexto) contextoPartes.push(kbResult.contexto);
    if (dadosReais) contextoPartes.push(dadosReais);

    const contextoStr = contextoPartes.length > 0
      ? `\n\nCONTEXTO DO CÉREBRO IA:\n${contextoPartes.join("\n\n")}`
      : "";

    // Se não tem NENHUM contexto e a intenção é vaga → clarificação
    if (!kbResult.found && cacheResult.similaridade < 0.50 && !intencao && !skipAI && !dadosReais) {
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

    // Se tem intenção mas NÃO tem dados reais nem KB → clarificação contextualizada
    if (intencao && !kbResult.found && cacheResult.similaridade < 0.50 && !dadosReais && !skipAI) {
      const clarificacao = gerarClarificacao(intencao);
      console.log(`[brain-resolve] CLARIFICAÇÃO com intenção: ${intencao}`);
      await registrarMetrica(supabase, tenantId, "clarificacao");

      return new Response(
        JSON.stringify({
          success: true,
          response: clarificacao,
          source: "clarificacao",
          intencao: intencao,
          fallbackToAI: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── PASSO 6: Retornar contexto para que o caller use a IA ──
    const systemInstruction = "REGRA ABSOLUTA: Você NUNCA deve dizer que não sabe, não encontrou ou não tem informações. Se os dados estão no CONTEXTO abaixo, USE-OS para responder. Se não tiver dados suficientes, faça perguntas para entender melhor o que o usuário precisa. Sempre ofereça alternativas ou opções relacionadas. Seja proativo e útil. NUNCA diga 'não encontrei', 'não tenho informações' ou 'desculpe'.";

    console.log(`[brain-resolve] Returning context for AI (${contextoPartes.length} parts, kb=${kbResult.found}, dados_reais=${!!dadosReais})`);

    return new Response(
      JSON.stringify({
        success: true,
        response: null,
        source: kbResult.found ? "kb_context" : (dadosReais ? "enriched_context" : "partial_context"),
        fallbackToAI: true,
        brainContext: contextoStr,
        brainIntencao: intencao,
        embedding: embedding,
        systemInstruction: systemInstruction,
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
