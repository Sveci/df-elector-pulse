import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_BASE = "https://api.apify.com/v2";

async function testActor(token: string, actorId: string, input: Record<string, any>, timeoutSecs = 22): Promise<{ actor: string; count: number; sample: any; error?: string; raw?: string }> {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&format=json`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), (timeoutSecs + 8) * 1000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const body = await res.text();
      return { actor: actorId, count: 0, sample: null, error: `HTTP ${res.status}: ${body.substring(0, 400)}` };
    }
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    return {
      actor: actorId,
      count: items.length,
      sample: items[0] ? Object.keys(items[0]) : null,
      raw: items[0] ? JSON.stringify(items[0]).substring(0, 600) : undefined,
    };
  } catch (e) {
    return { actor: actorId, count: 0, sample: null, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("APIFY_API_TOKEN")!;
  const query = "Rafael Prudente deputado";
  const pageUrl = "https://www.facebook.com/rafaelprudentedep";

  const [r1, r2, r3, r4] = await Promise.all([
    // Actor 1: scraper_one~facebook-posts-search (keyword search, community)
    testActor(token, "scraper_one~facebook-posts-search", {
      query,
      resultsCount: 15,
    }, 22),
    // Actor 2: powerai~facebook-post-search-scraper
    testActor(token, "powerai~facebook-post-search-scraper", {
      query,
      maxResults: 15,
    }, 22),
    // Actor 3: apify~facebook-posts-scraper na página oficial (não na URL de busca)
    testActor(token, "apify~facebook-posts-scraper", {
      startUrls: [{ url: pageUrl }],
      maxPosts: 15,
    }, 22),
    // Actor 4: microworlds~facebook-groups-scraper (grupos públicos)
    testActor(token, "microworlds~facebook-groups-scraper", {
      startUrls: [{ url: `https://www.facebook.com/search/posts/?q=${encodeURIComponent(query)}` }],
      maxPosts: 15,
    }, 22),
  ]);

  return new Response(JSON.stringify({ scraper_one_search: r1, powerai_search: r2, apify_page_posts: r3, microworlds_groups: r4 }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
