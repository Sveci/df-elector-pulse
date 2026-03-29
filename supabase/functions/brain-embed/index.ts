import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIMENSIONS = 1536;

/**
 * Generates a deterministic semantic embedding using word-level n-gram hashing.
 * Uses character trigrams + word bigrams for better semantic capture.
 * Not as powerful as a real embedding model, but consistent and fast.
 */
function generateLocalEmbedding(text: string): number[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const vec = new Float64Array(DIMENSIONS);

  // Character trigrams
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.substring(i, i + 3);
    const h = hashString(trigram);
    const idx = Math.abs(h) % DIMENSIONS;
    vec[idx] += (h & 1) ? 1.0 : -1.0;
  }

  // Word unigrams with higher weight
  const words = normalized.split(" ").filter(w => w.length > 1);
  for (const word of words) {
    const h = hashString("w_" + word);
    const idx = Math.abs(h) % DIMENSIONS;
    vec[idx] += ((h & 1) ? 2.0 : -2.0);
  }

  // Word bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + "_" + words[i + 1];
    const h = hashString("b_" + bigram);
    const idx = Math.abs(h) % DIMENSIONS;
    vec[idx] += ((h & 1) ? 1.5 : -1.5);
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < DIMENSIONS; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const result: number[] = new Array(DIMENSIONS);
  for (let i = 0; i < DIMENSIONS; i++) {
    result[i] = Math.round((vec[i] / norm) * 1e6) / 1e6;
  }
  return result;
}

/** FNV-1a hash */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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
        dimensions: DIMENSIONS,
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
