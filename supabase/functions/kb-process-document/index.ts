import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { document_id, content, tenant_id } = await req.json();

    if (!document_id || !content) {
      throw new Error("document_id and content are required");
    }

    console.log(`[kb-process] Processing document ${document_id}, content length: ${content.length}`);

    // Update status to processing
    await supabase
      .from("kb_documents")
      .update({ status: "processing" })
      .eq("id", document_id);

    // Step 1: Use AI to analyze and chunk the document intelligently
    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Você é um processador de documentos. Sua tarefa é:
1. Analisar o documento fornecido
2. Dividir em chunks semânticos (trechos com significado completo)
3. Cada chunk deve ter entre 200-800 palavras
4. Cada chunk deve ser auto-contido e fazer sentido isoladamente
5. Preservar contexto adicionando um breve cabeçalho contextual se necessário

REGRA ESPECIAL PARA ARQUIVOS SQL:
Se o documento contiver código SQL (CREATE TABLE, INSERT, SELECT, etc.):
- NÃO retorne o SQL bruto. Abstraia e descreva as informações em linguagem natural.
- Para CREATE TABLE: descreva a entidade, seus campos e o que cada campo representa.
- Para INSERT/dados: extraia os dados concretos e descreva-os como informações úteis (ex: "A cidade X tem população Y", "O programa Z atende a comunidade W").
- Para views/queries complexas: explique o que a consulta revela sobre os dados.
- Agrupe informações relacionadas em chunks temáticos coerentes.
- O objetivo é que a IA consiga responder perguntas usando essas informações sem precisar entender SQL.

Retorne um JSON array com os chunks. Cada item deve ter:
- "content": o texto do chunk em linguagem natural (com contexto suficiente para ser entendido isoladamente)
- "topic": o tópico principal do chunk (ex: "Programa Habitacional", "Atuação no Congresso", "Dados Demográficos")
- "summary": resumo de 1 linha do chunk

IMPORTANTE: Retorne APENAS o JSON array, sem markdown, sem code blocks, sem texto adicional.`
          },
          {
            role: "user",
            content: `Processe este documento e divida em chunks semânticos:\n\n${content.substring(0, 50000)}`
          }
        ],
        max_tokens: 8000,
      }),
    });

    if (!analysisResponse.ok) {
      const errText = await analysisResponse.text();
      console.error("[kb-process] AI analysis error:", errText);
      
      // Fallback: simple chunking by paragraphs
      const chunks = simpleChunk(content);
      await saveChunks(supabase, document_id, tenant_id, chunks);
      return new Response(
        JSON.stringify({ success: true, chunks: chunks.length, method: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await analysisResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let parsedChunks: any[];
    try {
      // Clean potential markdown wrapping
      const cleaned = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedChunks = JSON.parse(cleaned);
    } catch {
      console.warn("[kb-process] Failed to parse AI chunks, using fallback");
      const chunks = simpleChunk(content);
      await saveChunks(supabase, document_id, tenant_id, chunks);
      return new Response(
        JSON.stringify({ success: true, chunks: chunks.length, method: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save AI-processed chunks
    const chunkRecords = parsedChunks.map((chunk: any, index: number) => ({
      document_id,
      tenant_id,
      chunk_index: index,
      content: chunk.content || chunk,
      metadata: {
        topic: chunk.topic || null,
        summary: chunk.summary || null,
      },
    }));

    if (chunkRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("kb_chunks")
        .insert(chunkRecords);

      if (insertError) {
        console.error("[kb-process] Error inserting chunks:", insertError);
        throw insertError;
      }
    }

    // Update document status
    await supabase
      .from("kb_documents")
      .update({
        status: "ready",
        total_chunks: chunkRecords.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    console.log(`[kb-process] Document ${document_id} processed: ${chunkRecords.length} chunks`);

    return new Response(
      JSON.stringify({ success: true, chunks: chunkRecords.length, method: "ai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kb-process] Error:", error);

    // Try to mark document as error
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const body = await req.clone().json().catch(() => ({}));
      if (body.document_id) {
        await supabase
          .from("kb_documents")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", body.document_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function simpleChunk(content: string): { content: string; metadata: any }[] {
  const paragraphs = content.split(/\n{2,}/);
  const chunks: { content: string; metadata: any }[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length > 2000 && currentChunk.length > 200) {
      chunks.push({ content: currentChunk.trim(), metadata: {} });
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), metadata: {} });
  }

  return chunks;
}

async function saveChunks(
  supabase: any,
  documentId: string,
  tenantId: string,
  chunks: { content: string; metadata: any }[]
) {
  const records = chunks.map((chunk, index) => ({
    document_id: documentId,
    tenant_id: tenantId,
    chunk_index: index,
    content: chunk.content,
    metadata: chunk.metadata,
  }));

  if (records.length > 0) {
    await supabase.from("kb_chunks").insert(records);
  }

  await supabase
    .from("kb_documents")
    .update({
      status: "ready",
      total_chunks: records.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}
