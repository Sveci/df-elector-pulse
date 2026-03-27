import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generates a deterministic pseudo-embedding from text using a hash-based approach.
 * This creates a 1536-dimensional vector that maps similar normalized texts
 * to similar vectors using character n-gram frequency distributions.
 */
function generateLocalEmbedding(text: string): number[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dim = 1536;
  const vector = new Float64Array(dim);

  // Use character n-grams (2,3,4) to populate dimensions
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i <= normalized.length - n; i++) {
      const gram = normalized.substring(i, i + n);
      let hash = 0;
      for (let j = 0; j < gram.length; j++) {
        hash = ((hash << 5) - hash + gram.charCodeAt(j)) | 0;
      }
      const idx = ((hash % dim) + dim) % dim;
      vector[idx] += 1.0;
    }
  }

  // Also add word-level signals
  const words = normalized.split(" ").filter(w => w.length > 0);
  for (const word of words) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 7) - hash + word.charCodeAt(j)) | 0;
    }
    const idx = ((hash % dim) + dim) % dim;
    vector[idx] += 2.0;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vector[i] /= norm;
  }

  return Array.from(vector);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, texts } = await req.json();

    const inputTexts: string[] = texts || [text];
    if (!inputTexts || inputTexts.length === 0 || !inputTexts[0]) {
      throw new Error("No text provided");
    }

    const embeddings = inputTexts.map((t: string) => generateLocalEmbedding(t));

    return new Response(
      JSON.stringify({
        success: true,
        embeddings: texts ? embeddings : embeddings[0],
        dimensions: 1536,
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
