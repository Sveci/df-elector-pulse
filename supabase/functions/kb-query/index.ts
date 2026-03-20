import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authentication ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Não autenticado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAuthClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user }, error: authErr } = await supabaseAuthClient.auth.getUser(token);
  if (authErr || !user) {
    return new Response(
      JSON.stringify({ error: "Token inválido ou expirado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { question, tenant_id, max_chunks = 10, include_sources = true } = await req.json();

    if (!question || !tenant_id) {
      throw new Error("question and tenant_id are required");
    }

    console.log(`[kb-query] Question: "${question.substring(0, 100)}...", tenant: ${tenant_id}`);

    // Step 1: Search for relevant chunks using text search
    // Use trigram similarity for fuzzy matching
    const searchTerms = question
      .toLowerCase()
      .replace(/[^\w\sáéíóúãõâêîôûç]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .slice(0, 8);

    // Build OR conditions for each search term using ILIKE
    let chunks: any[] = [];

    if (searchTerms.length > 0) {
      const ilikeConditions = searchTerms.map((term: string) => `content.ilike.%${term}%`);

      const { data, error } = await supabase
        .from("kb_chunks")
        .select(`
          id, content, metadata, chunk_index,
          document:kb_documents(id, title, category)
        `)
        .eq("tenant_id", tenant_id)
        .or(ilikeConditions.join(","))
        .limit(max_chunks * 3);

      if (error) {
        console.error("[kb-query] Search error:", error);
      } else {
        chunks = data || [];
      }
    }

    // If no results from term search, get all chunks
    if (chunks.length === 0) {
      const { data } = await supabase
        .from("kb_chunks")
        .select(`
          id, content, metadata, chunk_index,
          document:kb_documents(id, title, category)
        `)
        .eq("tenant_id", tenant_id)
        .limit(max_chunks * 2);

      chunks = data || [];
    }

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "Não encontrei informações na base de conhecimento para responder esta pergunta. A base de conhecimento pode estar vazia ou o assunto não foi documentado ainda.",
          sources: [],
          chunks_found: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Use AI to rank and select the most relevant chunks
    const rankResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um ranqueador de relevância. Dada uma pergunta e uma lista de trechos de documentos, retorne os índices dos trechos mais relevantes para responder a pergunta, ordenados por relevância.

Retorne APENAS um JSON array de números (os índices), sem texto adicional. Ex: [0, 3, 1]
Selecione no máximo ${max_chunks} trechos mais relevantes.`
          },
          {
            role: "user",
            content: `Pergunta: ${question}\n\nTrechos:\n${chunks.map((c: any, i: number) => `[${i}] ${c.content.substring(0, 500)}`).join("\n\n")}`
          }
        ],
        max_tokens: 200,
      }),
    });

    let relevantChunks = chunks.slice(0, max_chunks);

    if (rankResponse.ok) {
      try {
        const rankData = await rankResponse.json();
        const rankContent = rankData.choices?.[0]?.message?.content || "";
        const cleaned = rankContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const indices = JSON.parse(cleaned);
        if (Array.isArray(indices)) {
          relevantChunks = indices
            .filter((i: number) => i >= 0 && i < chunks.length)
            .slice(0, max_chunks)
            .map((i: number) => chunks[i]);
        }
      } catch {
        console.warn("[kb-query] Failed to parse rank response, using default order");
      }
    }

    // Step 3: Generate answer using relevant chunks
    const contextText = relevantChunks
      .map((c: any, i: number) => {
        const doc = Array.isArray(c.document) ? c.document[0] : c.document;
        return `[Fonte: ${doc?.title || "Documento"}]\n${c.content}`;
      })
      .join("\n\n---\n\n");

    const answerResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em responder perguntas usando EXCLUSIVAMENTE a base de conhecimento fornecida. 

REGRAS OBRIGATÓRIAS:
1. Responda APENAS com base nos documentos fornecidos abaixo
2. SEMPRE cite a fonte usando o formato: (Fonte: Nome do Documento)
3. Se a informação não estiver nos documentos, diga claramente que não encontrou essa informação na base de conhecimento
4. Seja preciso, detalhado e factual
5. Use linguagem clara e profissional
6. Se houver múltiplas fontes sobre o mesmo tema, mencione todas
7. NUNCA invente informações que não estejam nos documentos`
          },
          {
            role: "user",
            content: `BASE DE CONHECIMENTO:\n\n${contextText}\n\n---\n\nPERGUNTA: ${question}`
          }
        ],
        max_tokens: 1500,
      }),
    });

    if (!answerResponse.ok) {
      const errText = await answerResponse.text();
      console.error("[kb-query] AI answer error:", errText);
      throw new Error("Failed to generate answer");
    }

    const answerData = await answerResponse.json();
    const answer = answerData.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";

    // Build sources list
    const sources = include_sources
      ? [...new Map(
          relevantChunks.map((c: any) => {
            const doc = Array.isArray(c.document) ? c.document[0] : c.document;
            return [doc?.id, { id: doc?.id, title: doc?.title, category: doc?.category }];
          })
        ).values()]
      : [];

    console.log(`[kb-query] Answer generated, ${relevantChunks.length} chunks used, ${sources.length} sources`);

    return new Response(
      JSON.stringify({
        answer,
        sources,
        chunks_found: chunks.length,
        chunks_used: relevantChunks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kb-query] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
