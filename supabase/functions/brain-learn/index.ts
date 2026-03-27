import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Called AFTER the AI responds to save the Q&A pair into the brain cache */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { tenantId, pergunta, resposta, embedding, intencao, origem } = await req.json();

    if (!tenantId || !pergunta || !resposta || !embedding) {
      throw new Error("tenantId, pergunta, resposta, and embedding are required");
    }

    // Normalize
    const perguntaNorm = pergunta
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Don't cache very short or error responses
    if (resposta.length < 20 || resposta.includes("AJUDA") || resposta.includes("Não consegui processar")) {
      return new Response(
        JSON.stringify({ success: true, cached: false, reason: "response_too_short_or_error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("brain_cache").insert({
      tenant_id: tenantId,
      pergunta_original: pergunta,
      pergunta_normalizada: perguntaNorm,
      embedding: JSON.stringify(embedding),
      resposta: resposta,
      categoria: intencao || "geral",
      intencao: intencao,
      origem: origem || "ai",
      score_confianca: 0.75,
    });

    console.log(`[brain-learn] Cached: "${pergunta.substring(0, 40)}..." → "${resposta.substring(0, 40)}..."`);

    return new Response(
      JSON.stringify({ success: true, cached: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[brain-learn] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
