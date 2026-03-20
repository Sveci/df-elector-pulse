import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_BASE = "https://api.apify.com/v2";

async function testActor(token: string, actorId: string, input: Record<string, any>, timeoutSecs = 40): Promise<{ actor: string; count: number; sample: any; error?: string }> {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&format=json`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), (timeoutSecs + 10) * 1000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const body = await res.text();
      return { actor: actorId, count: 0, sample: null, error: `HTTP ${res.status}: ${body.substring(0, 300)}` };
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    return { actor: actorId, count: items.length, sample: items[0] ? Object.keys(items[0]) : null };
  } catch (e) {
    return { actor: actorId, count: 0, sample: null, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("APIFY_API_TOKEN")!;

  // Test with different queries and actors
  const [r1, r2, r3, r4, r5, r6] = await Promise.all([
    // desearch with no language filter
    testActor(token, "desearch~ai-twitter-search", { query: "Rafael Prudente deputado", min_likes: 0 }, 35),
    // desearch with English query
    testActor(token, "desearch~ai-twitter-search", { query: "rafaelprudente_ OR rafaelprudente", min_likes: 0 }, 35),
    // Try handle-based search
    testActor(token, "desearch~ai-twitter-search", { query: "@rafaelprudente_", min_likes: 0 }, 35),
    // Try clockworks~twitter-scraper (different known actor)
    testActor(token, "clockworks~twitter-scraper", { queries: ["Rafael Prudente"], maxTweets: 10 }, 35),
    // Try apidojo~tweet-scraper
    testActor(token, "apidojo~tweet-scraper", { searchTerms: ["Rafael Prudente deputado DF"] }, 35),
    // Try actor using profile URL directly
    testActor(token, "desearch~ai-twitter-search", { query: "Prudente câmara legislativa DF", min_likes: 0 }, 35),
  ]);

  const results = {
    "desearch_pt": r1,
    "desearch_handle": r2,
    "desearch_at": r3,
    "clockworks": r4,
    "apidojo": r5,
    "desearch_alt": r6
  };

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
