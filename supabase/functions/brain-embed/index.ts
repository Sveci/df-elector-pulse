import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, texts } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const inputTexts: string[] = texts || [text];
    if (!inputTexts || inputTexts.length === 0 || !inputTexts[0]) {
      throw new Error("No text provided");
    }

    // Normalizar textos
    const normalized = inputTexts.map((t: string) =>
      t.toLowerCase().trim().replace(/\s+/g, " ")
    );

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: normalized,
      }),
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`Embedding API error: ${resp.status} - ${error}`);
    }

    const data = await resp.json();
    const embeddings = data.data.map((d: any) => d.embedding);

    return new Response(
      JSON.stringify({
        success: true,
        embeddings: texts ? embeddings : embeddings[0],
        dimensions: embeddings[0]?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[brain-embed]", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
