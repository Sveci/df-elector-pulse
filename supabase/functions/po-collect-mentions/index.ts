import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";
const SOCIAVAULT_BASE = "https://api.sociavault.com/v1/scrape";

// Map source names to Apify actor IDs
const APIFY_ACTORS: Record<string, string> = {
  // Twitter
  twitter: "apidojo~tweet-scraper",
  twitter_comments: "apidojo~tweet-scraper",
  // Instagram — actors em ordem de preferência
  instagram: "apify~instagram-scraper",
  instagram_search: "apify~instagram-search-scraper",
  instagram_hashtag: "apify~instagram-hashtag-scraper",
  instagram_comments: "apify~instagram-comment-scraper",
  // Facebook — actors em ordem de preferência
  facebook: "apify~facebook-posts-scraper",
  facebook_search: "apify~facebook-search-scraper",
  facebook_page: "apify~facebook-page-scraper",
  facebook_posts: "apify~facebook-posts-scraper",
  facebook_comments: "apify~facebook-comments-scraper",
  // TikTok — múltiplos actors para cobertura máxima
  tiktok_profile: "clockworks~tiktok-profile-scraper",    // perfil oficial (legado)
  tiktok_scraper: "clockworks~tiktok-scraper",             // keyword + hashtag + profile (principal)
  tiktok_apidojo: "apidojo~tiktok-scraper",                // keyword alternativo rápido
  tiktok_keyword: "sociavault~tiktok-keyword-search-scraper", // keyword com filtro de região BR
  tiktok_comments: "apidojo~tiktok-comments-scraper",      // comentários em vídeos (pay-per-result)
  // Outros
  google_news: "dlaf~google-news-free",
  google_search: "apify~google-search-scraper",
  youtube_channel: "scrapesmith~youtube-free-channel-scraper",
  youtube_comments: "crawlerbros~youtube-comment-scraper",
  youtube_search: "bernardo~youtube-scraper",
  threads: "apify~threads-scraper",
  reddit: "trudax~reddit-scraper",
  telegram: "lexer~telegram-channel-post-scraper",
};

// ── Background collection logic ──
async function runCollection(entity_id: string, sources: string[] | undefined, query: string | undefined) {
  const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
  const ZENSCRAPE_API_KEY = Deno.env.get("ZENSCRAPE_API_KEY");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: entity, error: entityError } = await supabase
    .from("po_monitored_entities")
    .select("*")
    .eq("id", entity_id)
    .single();

  if (entityError || !entity) throw new Error("Entity not found");

  const searchQuery = query || `"${entity.nome}"`;
  const targetSources = sources || ["news"];

  console.log(`[BG] Collecting for "${entity.nome}", query: ${searchQuery}, sources: ${targetSources.join(",")}`);

  const collectedMentions: any[] = [];

  // ── 1. Zenscrape - news scraping (Bing + Yahoo) ──
  if (targetSources.includes("news") && ZENSCRAPE_API_KEY) {
    try { collectedMentions.push(...await collectViaZenscrape(ZENSCRAPE_API_KEY, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("news error:", e); }
  }

  // ── 2. Apify - Google News ──
  if (targetSources.includes("google_news") && APIFY_API_TOKEN) {
    try { collectedMentions.push(...await collectGoogleNews(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("google_news error:", e); }
  }

  // ── 3. Apify - Twitter/X ──
  if (targetSources.includes("twitter") && APIFY_API_TOKEN) {
    try {
      const twHandle = entity.redes_sociais?.twitter;
      collectedMentions.push(...await collectTwitter(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id, twHandle || undefined));
    } catch (e) { console.error("twitter error:", e); }
  }

  // ── 4. Apify - Instagram ──
  if (targetSources.includes("instagram") && APIFY_API_TOKEN) {
    try {
      const igHandle = entity.redes_sociais?.instagram;
      collectedMentions.push(...await collectInstagram(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id, igHandle || undefined));
    } catch (e) { console.error("instagram error:", e); }
  }

  // ── 5. Apify - Facebook ──
  if (targetSources.includes("facebook") && APIFY_API_TOKEN) {
    try {
      const fbHandle = entity.redes_sociais?.facebook;
      collectedMentions.push(...await collectFacebook(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id, fbHandle || undefined));
    } catch (e) { console.error("facebook error:", e); }
  }

  // ── 6. Facebook Comments ──
  if (targetSources.includes("facebook_comments") && APIFY_API_TOKEN) {
    try {
      const fbHandle = entity.redes_sociais?.facebook;
      if (fbHandle) collectedMentions.push(...await collectFacebookComments(APIFY_API_TOKEN, fbHandle, entity.nome, entity_id));
    } catch (e) { console.error("facebook_comments error:", e); }
  }

  // ── 7. Instagram Comments ──
  if (targetSources.includes("instagram_comments") && APIFY_API_TOKEN) {
    try {
      const igHandle = entity.redes_sociais?.instagram;
      if (igHandle) collectedMentions.push(...await collectInstagramComments(APIFY_API_TOKEN, igHandle, entity.nome, entity_id));
    } catch (e) { console.error("instagram_comments error:", e); }
  }

  // ── 8. Twitter Replies ──
  if (targetSources.includes("twitter_comments") && APIFY_API_TOKEN) {
    try {
      const twHandle = entity.redes_sociais?.twitter;
      if (twHandle) collectedMentions.push(...await collectTwitterReplies(APIFY_API_TOKEN, twHandle, entity.nome, entity_id));
    } catch (e) { console.error("twitter_comments error:", e); }
  }

  // ── 9a. TikTok ──
  if (targetSources.includes("tiktok") && APIFY_API_TOKEN) {
    try {
      const tkHandle = entity.redes_sociais?.tiktok;
      collectedMentions.push(...await collectTikTok(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id, tkHandle || undefined));
    } catch (e) { console.error("tiktok error:", e); }
  }

  // ── 9b. TikTok Comments ──
  if (targetSources.includes("tiktok_comments") && APIFY_API_TOKEN) {
    try {
      const tkHandle = entity.redes_sociais?.tiktok;
      if (tkHandle) collectedMentions.push(...await collectTikTokComments(APIFY_API_TOKEN, tkHandle, entity.nome, entity_id));
    } catch (e) { console.error("tiktok_comments error:", e); }
  }

  // ── 10. YouTube Comments ──
  if (targetSources.includes("youtube_comments") && APIFY_API_TOKEN) {
    try {
      const ytHandle = entity.redes_sociais?.youtube;
      if (ytHandle) collectedMentions.push(...await collectYouTubeComments(APIFY_API_TOKEN, ytHandle, entity.nome, entity_id));
    } catch (e) { console.error("youtube_comments error:", e); }
  }

  // ── 11. Reddit ──
  if (targetSources.includes("reddit") && APIFY_API_TOKEN) {
    try { collectedMentions.push(...await collectReddit(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("reddit error:", e); }
  }

  // ── 12. Portais DF ──
  if (targetSources.includes("portais_df") && ZENSCRAPE_API_KEY) {
    try { collectedMentions.push(...await collectPortaisDF(ZENSCRAPE_API_KEY, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("portais_df error:", e); }
  }

  // ── 13. Telegram ──
  if (targetSources.includes("telegram") && APIFY_API_TOKEN) {
    try {
      const tgChannels = (entity.redes_sociais as Record<string, any>)?.telegram;
      if (tgChannels) collectedMentions.push(...await collectTelegram(APIFY_API_TOKEN, tgChannels, searchQuery, entity.nome, entity_id));
    } catch (e) { console.error("telegram error:", e); }
  }

  // ── 14. Influencer Comments ──
  if (targetSources.includes("influencer_comments") && APIFY_API_TOKEN) {
    try {
      const influencers = (entity.redes_sociais as Record<string, any>)?.influenciadores_ig;
      if (influencers) collectedMentions.push(...await collectInfluencerComments(APIFY_API_TOKEN, influencers, entity.nome, entity_id));
    } catch (e) { console.error("influencer_comments error:", e); }
  }

  // ── 16. Google Search ──
  if (targetSources.includes("google_search") && APIFY_API_TOKEN) {
    try { collectedMentions.push(...await collectGoogleSearch(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("google_search error:", e); }
  }

  // ── 17. Portais BR ──
  if (targetSources.includes("portais_br") && ZENSCRAPE_API_KEY) {
    try { collectedMentions.push(...await collectPortaisBR(ZENSCRAPE_API_KEY, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("portais_br error:", e); }
  }

  // ── 18. Threads ──
  if (targetSources.includes("threads") && APIFY_API_TOKEN) {
    try {
      const thHandle = entity.redes_sociais?.threads || entity.redes_sociais?.instagram;
      collectedMentions.push(...await collectThreads(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id, thHandle || undefined));
    } catch (e) { console.error("threads error:", e); }
  }

  // ── 19. YouTube Search ──
  if (targetSources.includes("youtube_search") && APIFY_API_TOKEN) {
    try { collectedMentions.push(...await collectYouTubeSearch(APIFY_API_TOKEN, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("youtube_search error:", e); }
  }

  // ── 20. Fontes Oficiais ──
  if (targetSources.includes("fontes_oficiais") && ZENSCRAPE_API_KEY) {
    try { collectedMentions.push(...await collectFontesOficiais(ZENSCRAPE_API_KEY, searchQuery, entity.nome, entity_id)); } catch (e) { console.error("fontes_oficiais error:", e); }
  }

  // ── 15. Custom Sites ──
  if (targetSources.includes("sites_custom") && ZENSCRAPE_API_KEY) {
    try {
      const sites = (entity.redes_sociais as Record<string, any>)?.sites_customizados;
      if (sites) collectedMentions.push(...await collectCustomSites(ZENSCRAPE_API_KEY, sites, entity.nome, entity_id));
    } catch (e) { console.error("sites_custom error:", e); }
  }

  // ── Dedupe & Insert ──
  console.log(`[BG] Total collected: ${collectedMentions.length} mentions`);

  if (collectedMentions.length > 0) {
    const { data: existing } = await supabase
      .from("po_mentions")
      .select("content")
      .eq("entity_id", entity_id)
      .order("created_at", { ascending: false })
      .limit(500);

    const existingSet = new Set(
      (existing || []).map((e: any) => e.content.substring(0, 200))
    );

    const uniqueMentions = collectedMentions.filter(
      m => !existingSet.has(m.content.substring(0, 200))
    );

    const dupeCount = collectedMentions.length - uniqueMentions.length;
    console.log(`[BG] Dedupe: ${dupeCount} duplicates removed, ${uniqueMentions.length} unique`);

    if (uniqueMentions.length === 0) {
      console.log("[BG] All mentions already existed");
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("po_mentions")
      .insert(uniqueMentions)
      .select("id");

    if (insertError) {
      console.error("[BG] Insert error:", insertError);
      return;
    }

    const mentionIds = inserted?.map(m => m.id) || [];
    console.log(`[BG] Inserted ${mentionIds.length} mentions`);

    if (mentionIds.length > 0) {
      fetch(`${supabaseUrl}/functions/v1/analyze-sentiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({ mention_ids: mentionIds, entity_id }),
      }).catch(err => console.error("[BG] Background analysis error:", err));
    }
  } else {
    console.log("[BG] No mentions found");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { entity_id, sources, query } = await req.json();
    if (!entity_id) throw new Error("entity_id is required");

    // Dispatch background processing using EdgeRuntime.waitUntil
    const bgTask = runCollection(entity_id, sources, query).catch(e => {
      console.error("[BG] runCollection fatal error:", e);
    });

    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(bgTask);
    }

    // Return immediately
    return new Response(JSON.stringify({
      success: true,
      message: "Coleta iniciada em segundo plano. Os dados aparecerão em breve.",
      background: true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("po-collect-mentions error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ══════════════════════════════════════════════════
// APIFY HELPERS
// ══════════════════════════════════════════════════

async function runApifyActor(token: string, actorId: string, input: Record<string, any>, timeoutSecs = 120): Promise<any[]> {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSecs}&format=json`;
  console.log(`Apify: running ${actorId}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), (timeoutSecs + 30) * 1000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Apify ${actorId} error ${res.status}: ${errBody.substring(0, 300)}`);
      return [];
    }

    const data = await res.json();
    console.log(`Apify ${actorId}: received ${Array.isArray(data) ? data.length : 0} items`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    clearTimeout(timeout);
    console.error(`Apify ${actorId} error:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// ── Google News via Apify ──
async function collectGoogleNews(token: string, query: string, entityName: string, entityId: string): Promise<any[]> {
  const searchTerm = query.replace(/"/g, "");
  const items = await runApifyActor(token, APIFY_ACTORS.google_news, {
    query: searchTerm,
    language: "pt",
    region: "BR",
    maxArticles: 30,
    timeRange: "7d",
    mode: "lightweight",
    deduplication: true,
  });

  return items.map(item => ({
    entity_id: entityId,
    source: "google_news",
    source_url: item.link || item.url || null,
    author_name: item.source || item.publisher || null,
    author_handle: null,
    content: (item.title ? `${item.title}. ${item.snippet || item.description || ""}` : item.snippet || item.description || "").substring(0, 2000),
    published_at: item.publishedAt || item.date || item.published_date || new Date().toISOString(),
    engagement: {},
    hashtags: [],
    media_urls: item.image ? [item.image] : [],
    raw_data: { source: "apify_google_news" },
  })).filter(m => m.content.length > 10);
}

// ══════════════════════════════════════════════════
// TWITTER/X — Actor principal: apidojo~tweet-scraper
// Busca múltiplas queries em paralelo (nome, handle,
// variações políticas, geolocalização DF/Brasília)
// ══════════════════════════════════════════════════

function mapTwitterItem(item: any, entityId: string, sourceLabel: string): any | null {
  const content = (
    item.fullText || item.text || item.full_text || item.content || item.tweet || ""
  ).substring(0, 2000);
  if (content.length < 5) return null;

  // apidojo fields
  const twitterUrl = item.twitterUrl || item.url || item.tweet_url ||
    (item.id ? `https://x.com/i/web/status/${item.id}` : null);

  return {
    entity_id: entityId,
    source: sourceLabel,
    source_url: twitterUrl,
    author_name: item.author?.name || item.user?.name || item.author_name || item.userName || null,
    author_handle: item.author?.userName || item.user?.screen_name || item.author_handle || item.screen_name || item.username || null,
    content,
    published_at: item.createdAt || item.created_at || item.date || item.timestamp || new Date().toISOString(),
    engagement: {
      likes: item.likeCount || item.like_count || item.likes || item.favoriteCount || 0,
      shares: item.retweetCount || item.retweet_count || item.retweets || 0,
      comments: item.replyCount || item.reply_count || item.replies || 0,
      views: item.viewCount || item.view_count || item.views || 0,
      bookmarks: item.bookmarkCount || item.bookmark_count || 0,
      quotes: item.quoteCount || 0,
    },
    hashtags: item.entities?.hashtags?.map((h: any) => h.tag || h.text) || item.hashtags || [],
    media_urls: item.media?.map((m: any) => m.url || m.mediaUrl || m) || [],
    raw_data: { source: "apify_apidojo_tweet_scraper", lang: item.lang || null },
  };
}

// Roda apidojo~tweet-scraper para uma query específica
async function runApidojoSearch(token: string, query: string, maxItems: number, timeoutSecs: number): Promise<any[]> {
  console.log(`Twitter apidojo: query="${query}"`);
  const items = await runApifyActor(token, "apidojo~tweet-scraper", {
    searchTerms: [query],
    maxItems,
    addUserInfo: true,
    tweetLanguage: "pt",
    onlyVerifiedUsers: false,
  }, timeoutSecs);
  console.log(`Twitter apidojo "${query}": ${items.length} tweets`);
  return items;
}

// ── Orquestrador principal: Twitter/X ──
async function collectTwitter(token: string, query: string, entityName: string, entityId: string, twHandle?: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];
  const handle = (twHandle || "").replace(/^@/, "");

  // Queries diversificadas para máxima cobertura
  const queryGroups = [
    // Grupo 1: nome + cargo + contexto político
    `${firstName} ${lastName} deputado`,
    // Grupo 2: handle ou nome exato
    handle ? `@${handle}` : `"${entityName}"`,
    // Grupo 3: nome + geolocalização
    `${firstName} ${lastName} Brasília OR DF`,
    // Grupo 4: nome + temas legislativos
    `${firstName} ${lastName} câmara OR projeto OR lei`,
    // Grupo 5: menções sem filtro de idioma (para retweets internacionais)
    entityName,
  ];

  console.log(`Twitter: launching ${queryGroups.length} parallel queries via apidojo`);

  // Todas as queries em paralelo — 25 tweets cada, timeout de 50s
  const rawResults = await Promise.all(
    queryGroups.map(q =>
      runApidojoSearch(token, q, 25, 50).catch(e => {
        console.error(`apidojo failed for "${q}":`, e.message);
        return [];
      })
    )
  );

  // Mapeia e deduplica por ID ou URL
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const items of rawResults) {
    for (const item of items) {
      const key = item.id || item.twitterUrl || item.url || item.fullText?.substring(0, 80) || item.text?.substring(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const mapped = mapTwitterItem(item, entityId, "twitter");
      if (mapped) deduped.push(mapped);
    }
  }

  const total = rawResults.reduce((s, r) => s + r.length, 0);
  console.log(`Twitter total: ${deduped.length} únicos de ${total} brutos`);
  return deduped;
}

// ══════════════════════════════════════════════════
// INSTAGRAM — Estratégia multi-actor + queries paralelas
// Actors testados (em ordem de preferência):
//   1. apify~instagram-scraper (scraper geral - busca por hashtag/usuario)
//   2. apify~instagram-search-scraper (busca por keyword)
//   3. apify~instagram-hashtag-scraper (foco em hashtags)
// Queries: nome, @handle, variações políticas, hashtags, cargo
// ══════════════════════════════════════════════════

function mapInstagramItem(item: any, entityId: string, sourceLabel = "instagram"): any | null {
  const content = (item.caption || item.text || item.alt || item.description || item.body || "").substring(0, 2000);
  if (content.length < 5) return null;

  const postUrl = item.url || item.postUrl ||
    (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null) ||
    (item.id ? `https://www.instagram.com/p/${item.id}/` : null);

  return {
    entity_id: entityId,
    source: sourceLabel,
    source_url: postUrl,
    author_name: item.ownerFullName || item.owner?.fullName || item.username || item.authorName || null,
    author_handle: item.ownerUsername || item.owner?.username || item.username || null,
    content,
    published_at: item.timestamp ||
      (item.takenAtTimestamp ? new Date(item.takenAtTimestamp * 1000).toISOString() : null) ||
      (item.taken_at ? new Date(item.taken_at * 1000).toISOString() : null) ||
      new Date().toISOString(),
    engagement: {
      likes: item.likesCount || item.like_count || item.likes || 0,
      comments: item.commentsCount || item.comment_count || item.comments || 0,
      views: item.videoViewCount || item.video_view_count || item.views || item.playCount || 0,
      shares: item.sharesCount || 0,
      saves: item.savedCount || 0,
    },
    hashtags: item.hashtags || [],
    media_urls: item.displayUrl ? [item.displayUrl] : (item.images || item.imageUrl ? [item.imageUrl] : []),
    raw_data: { source: `apify_instagram_${sourceLabel}`, apify_id: item.id },
  };
}

// Busca via apify~instagram-scraper (scraper geral)
async function runIgScraper(token: string, input: Record<string, any>, timeoutSecs = 50): Promise<any[]> {
  return runApifyActor(token, "apify~instagram-scraper", input, timeoutSecs).catch(e => {
    console.error("ig-scraper error:", e.message);
    return [];
  });
}

// Busca via apify~instagram-search-scraper (keyword search)
async function runIgSearchScraper(token: string, query: string, limit: number, timeoutSecs = 50): Promise<any[]> {
  return runApifyActor(token, "apify~instagram-search-scraper", {
    searchQueries: [query],
    searchType: "hashtag",
    resultsLimit: limit,
  }, timeoutSecs).catch(e => {
    console.error("ig-search-scraper error:", e.message);
    return [];
  });
}

// Busca via apify~instagram-hashtag-scraper
async function runIgHashtagScraper(token: string, hashtag: string, limit: number, timeoutSecs = 50): Promise<any[]> {
  const tag = hashtag.replace(/^#/, "");
  return runApifyActor(token, "apify~instagram-hashtag-scraper", {
    hashtags: [tag],
    resultsLimit: limit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  }, timeoutSecs).catch(e => {
    console.error("ig-hashtag-scraper error:", e.message);
    return [];
  });
}

// ── Orquestrador principal: Instagram ──
async function collectInstagram(token: string, query: string, entityName: string, entityId: string, igHandle?: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];
  const handle = (igHandle || "").replace(/^@/, "");

  // 5 queries diversificadas para máxima cobertura
  const queries = [
    // 1. Nome completo como keyword (busca por texto)
    `${firstName} ${lastName} deputado`,
    // 2. @handle direto no perfil oficial
    handle ? handle : `${firstName}${lastName}`,
    // 3. Nome + política + DF
    `${firstName} ${lastName} Brasília política`,
    // 4. Nome + temas legislativos
    `${firstName} ${lastName} câmara lei projeto`,
    // 5. Hashtag derivada do nome
    `${firstName}${lastName}`,
  ];

  const hashtags = [
    `${firstName}${lastName}`.toLowerCase(),
    `deputado${firstName}`.toLowerCase(),
    `${firstName}${lastName}df`.toLowerCase(),
  ];

  console.log(`Instagram: launching parallel queries + hashtag search`);

  // Actor 1: apify~instagram-scraper com busca por keyword (queries 1 e 3)
  const [r1, r2, r3, r4, r5, rH1, rH2] = await Promise.all([
    // Scraper geral — busca por username do handle
    handle ? runIgScraper(token, {
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: "posts",
      resultsLimit: 20,
    }, 45) : Promise.resolve([]),
    // Search scraper — nome + cargo
    runIgSearchScraper(token, queries[0], 20, 45),
    // Search scraper — nome + localização
    runIgSearchScraper(token, queries[2], 20, 45),
    // Search scraper — nome + legislativo
    runIgSearchScraper(token, queries[3], 15, 45),
    // Scraper por hashtag do nome completo sem espaço
    runIgHashtagScraper(token, hashtags[0], 20, 45),
    // Hashtag deputado+nome
    runIgHashtagScraper(token, hashtags[1], 15, 45),
    // Hashtag nome+df
    runIgHashtagScraper(token, hashtags[2], 15, 45),
  ]);

  // Deduplica por shortCode, id ou URL
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const items of [r1, r2, r3, r4, r5, rH1, rH2]) {
    for (const item of items) {
      const key = item.shortCode || item.id || item.url || item.postUrl || (item.caption || "").substring(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const mapped = mapInstagramItem(item, entityId, "instagram");
      if (mapped) deduped.push(mapped);
    }
  }

  const total = [r1, r2, r3, r4, r5, rH1, rH2].reduce((s, r) => s + r.length, 0);
  console.log(`Instagram total: ${deduped.length} únicos de ${total} brutos`);
  return deduped;
}

// ══════════════════════════════════════════════════
// FACEBOOK — Estratégia multi-actor + queries paralelas
// Actors testados (em ordem de preferência):
//   1. apify~facebook-posts-scraper (posts de páginas)
//   2. apify~facebook-search-scraper (busca pública)
//   3. apify~facebook-page-scraper (scraper de página)
// Queries: nome, @handle, variações políticas, cargo, hashtag
// ══════════════════════════════════════════════════

function mapFacebookItem(item: any, entityId: string, sourceLabel = "facebook"): any | null {
  // Suporta múltiplos schemas:
  // apify~facebook-posts-scraper: { text, user, time, likes, shares, comments }
  // powerai~facebook-post-search-scraper: { message, author, author_title, timestamp, reactions_count, comments_count, reshare_count }
  const content = (
    item.text || item.message || item.postText || item.body ||
    item.content || item.full_message || item.story || ""
  ).substring(0, 2000);
  if (content.length < 5) return null;

  // timestamp pode vir como number (unix) ou string ISO
  let publishedAt: string = new Date().toISOString();
  if (item.time) publishedAt = item.time;
  else if (item.timestamp && typeof item.timestamp === "string") publishedAt = item.timestamp;
  else if (item.timestamp && typeof item.timestamp === "number") publishedAt = new Date(item.timestamp * 1000).toISOString();
  else if (item.date || item.postedAt || item.created_time) publishedAt = item.date || item.postedAt || item.created_time;

  return {
    entity_id: entityId,
    source: sourceLabel,
    source_url: item.url || item.postUrl || item.link || null,
    // powerai usa "author" (string), apify usa "user" (object)
    author_name: item.author || item.user?.name || item.pageName || item.authorName || item.name || item.from?.name || null,
    author_handle: item.author_title || item.user?.profileUrl || item.pageUrl || item.user?.url || item.from?.id || null,
    content,
    published_at: publishedAt,
    engagement: {
      likes: item.likes || item.reactions_count || item.reactionsCount || item.reactions || item.likeCount || 0,
      shares: item.shares || item.reshare_count || item.sharesCount || item.share?.share_count || 0,
      comments: item.comments || item.comments_count || item.commentsCount || item.comment_count || 0,
      views: item.views || item.viewCount || 0,
      reaction_types: extractReactionTypes(item),
    },
    hashtags: [],
    media_urls: item.media?.map((m: any) => m.thumbnail || m.url || m) ||
      (item.image ? [item.image] : item.photo ? [item.photo] : []),
    raw_data: { source: `apify_facebook_${sourceLabel}`, apify_id: item.post_id || item.id || item.postId },
  };
}

// ══════════════════════════════════════════════════
// FACEBOOK — Estratégia multi-actor + queries paralelas
// Actors validados e funcionais:
//   1. powerai~facebook-post-search-scraper  → keyword search (15 posts / run)
//   2. apify~facebook-posts-scraper          → posts da página oficial (rápido, ~3 posts)
// Queries: nome+cargo, nome+DF, legislativo, mandato/eleição, página oficial
// ══════════════════════════════════════════════════

// Actor 1: powerai~facebook-post-search-scraper — busca pública por keyword
async function runFbKeywordSearch(token: string, query: string, limit: number, timeoutSecs = 22): Promise<any[]> {
  return runApifyActor(token, "powerai~facebook-post-search-scraper", {
    query,
    maxResults: limit,
  }, timeoutSecs).catch(e => {
    console.error("fb-keyword-search error:", e.message);
    return [];
  });
}

// Actor 2: apify~facebook-posts-scraper — posts diretos da página oficial
async function runFbOfficialPage(token: string, pageUrl: string, limit: number, timeoutSecs = 22): Promise<any[]> {
  return runApifyActor(token, "apify~facebook-posts-scraper", {
    startUrls: [{ url: pageUrl }],
    maxPosts: limit,
  }, timeoutSecs).catch(e => {
    console.error("fb-official-page error:", e.message);
    return [];
  });
}

// ── Orquestrador principal: Facebook ──
async function collectFacebook(token: string, query: string, entityName: string, entityId: string, fbHandle?: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];
  const handle = (fbHandle || "").replace(/^@/, "");

  console.log(`Facebook: launching 5 parallel queries (powerai keyword search + official page)`);

  // 5 queries diversificadas para máxima cobertura
  const searchQueries = [
    `${firstName} ${lastName} deputado`,                           // cargo
    `${firstName} ${lastName} Brasília OR "Distrito Federal"`,    // geolocalização
    `${firstName} ${lastName} câmara OR lei OR projeto OR voto`,  // legislativo
    `${firstName} ${lastName} mandato OR eleição OR candidato`,   // político
    entityName,                                                   // nome puro (amplo)
  ];

  // Todas as queries em paralelo com timeout de 22s cada
  const [r1, r2, r3, r4, r5] = await Promise.all([
    // Queries 1-4: powerai keyword search (busca pública por keyword)
    runFbKeywordSearch(token, searchQueries[0], 15, 22),
    runFbKeywordSearch(token, searchQueries[1], 15, 22),
    runFbKeywordSearch(token, searchQueries[2], 15, 22),
    runFbKeywordSearch(token, searchQueries[3], 15, 22),
    // Query 5: página oficial (posts diretos do perfil)
    handle
      ? runFbOfficialPage(token, `https://www.facebook.com/${handle}`, 20, 22)
      : runFbKeywordSearch(token, searchQueries[4], 15, 22),
  ]);

  // Deduplica por post_id, postId, url ou primeiros 80 chars do conteúdo
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const items of [r1, r2, r3, r4, r5]) {
    for (const item of items) {
      const key = item.post_id || item.id || item.postId || item.url || item.postUrl ||
        (item.message || item.text || "").substring(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const mapped = mapFacebookItem(item, entityId, "facebook");
      if (mapped) deduped.push(mapped);
    }
  }

  const total = [r1, r2, r3, r4, r5].reduce((s, r) => s + r.length, 0);
  console.log(`Facebook total: ${deduped.length} únicos de ${total} brutos`);
  return deduped;
}

// ══════════════════════════════════════════════════
// ZENSCRAPE (kept for Bing/Yahoo news)
// ══════════════════════════════════════════════════
async function collectViaZenscrape(apiKey: string, searchQuery: string, entityName: string, entityId: string): Promise<any[]> {
  const collectedMentions: any[] = [];
  const urls = [
    `https://www.bing.com/news/search?q=${encodeURIComponent(searchQuery)}&setlang=pt-br`,
    `https://search.yahoo.com/search?p=${encodeURIComponent(searchQuery)}&vt=news`,
  ];

  for (const targetUrl of urls) {
    try {
      const zenscrapeUrl = `https://app.zenscrape.com/api/v1/get?url=${encodeURIComponent(targetUrl)}`;
      console.log(`Zenscrape: fetching ${targetUrl}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(zenscrapeUrl, {
        headers: { "apikey": apiKey },
        signal: controller.signal,
      }).catch(e => {
        console.error("Zenscrape fetch error:", e.message);
        return null;
      });

      clearTimeout(timeout);

      if (res?.ok) {
        const html = await res.text();
        console.log(`Zenscrape: received ${html.length} chars`);
        const extracted = extractMentionsFromHTML(html, entityName, "news", entityId);
        collectedMentions.push(...extracted);
        console.log(`Zenscrape: extracted ${extracted.length} mentions`);
      } else if (res) {
        const errBody = await res.text();
        console.error(`Zenscrape error ${res.status}: ${errBody.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Zenscrape error:", e);
    }
  }

  return collectedMentions;
}

function extractMentionsFromHTML(html: string, entityName: string, source: string, entityId: string): any[] {
  const mentions: any[] = [];
  const nameLower = entityName.toLowerCase();

  const cleanText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");

  const nameCount = (cleanText.toLowerCase().match(new RegExp(nameLower.replace(/\s+/g, "\\s+"), "gi")) || []).length;
  if (nameCount === 0) return mentions;

  const regex = new RegExp(`([^.!?]*${nameLower.replace(/\s+/g, "\\s+")}[^.!?]*)`, "gi");
  const matches = cleanText.match(regex) || [];

  const seen = new Set<string>();
  for (const match of matches.slice(0, 30)) {
    const trimmed = match.trim();
    if (trimmed.length < 15) continue;
    const key = trimmed.substring(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({
      entity_id: entityId,
      source,
      source_url: null,
      author_name: null,
      author_handle: null,
      content: trimmed.substring(0, 2000),
      published_at: new Date().toISOString(),
      engagement: {},
      hashtags: [],
      media_urls: [],
      raw_data: { extracted_from: "zenscrape" },
    });
  }
  return mentions;
}

// ══════════════════════════════════════════════════
// FACEBOOK COMMENTS (from entity's own page)
// Single-stage: fetch posts and extract topComments directly from results
// ══════════════════════════════════════════════════

async function collectFacebookComments(token: string, fbHandle: string, entityName: string, entityId: string): Promise<any[]> {
  const handle = fbHandle.replace(/^@/, "");
  const pageUrl = `https://www.facebook.com/${handle}`;
  console.log(`Facebook Comments: Stage 1 - fetching posts from ${pageUrl}`);

   // Stage 1: Get post URLs (limit to 10 to maximize collection within timeout)
  const posts = await runApifyActor(token, APIFY_ACTORS.facebook_posts, {
    startUrls: [{ url: pageUrl }],
    maxPosts: 10,
  }, 40);

  if (!posts.length) {
    console.log("Facebook Comments: no posts found");
    return [];
  }

  const postUrls = posts
    .map(p => p.url || p.postUrl || p.link)
    .filter(Boolean)
    .slice(0, 10);

  console.log(`Facebook Comments: Stage 1 got ${posts.length} posts, ${postUrls.length} URLs`);

  if (postUrls.length === 0) return [];

  // Stage 2: Get comments from those posts
  console.log(`Facebook Comments: Stage 2 - fetching comments from ${postUrls.length} posts`);
  const commentItems = await runApifyActor(token, APIFY_ACTORS.facebook_comments, {
    startUrls: postUrls.map(url => ({ url })),
    resultsLimit: 100,
    includeReplies: false,
  }, 90);

  console.log(`Facebook Comments: Stage 2 got ${commentItems.length} comment items`);
  if (commentItems.length > 0) {
    console.log(`Facebook Comments: comment keys: ${Object.keys(commentItems[0]).join(", ")}`);
    console.log(`Facebook Comments: sample: ${JSON.stringify(commentItems[0]).substring(0, 500)}`);
  }

  const mentions: any[] = [];

  for (const comment of commentItems) {
    const content = (comment.text || comment.comment || comment.body || comment.message || comment.content || "").substring(0, 2000);
    if (content.length < 3) continue;

    const postUrl = comment.postUrl || comment.facebookUrl || comment.url || null;
    mentions.push({
      entity_id: entityId,
      source: "facebook_comments",
      source_url: postUrl,
      author_name: comment.profileName || comment.authorName || comment.name || comment.author?.name || null,
      author_handle: comment.profileUrl || comment.authorUrl || comment.author?.url || null,
      content,
      published_at: comment.date || comment.timestamp || comment.created_time || new Date().toISOString(),
      engagement: {
        likes: comment.likesCount || comment.likes || comment.reactionsCount || 0,
        comments: comment.repliesCount || comment.replyCount || 0,
        shares: 0,
        views: 0,
        reactions: comment.reactions || comment.reactionBreakdown || null,
        reaction_types: extractReactionTypes(comment),
      },
      hashtags: [],
      media_urls: comment.imageUrl ? [comment.imageUrl] : [],
      raw_data: {
        source: "apify_facebook_comments_scraper",
        post_url: postUrl,
        comment_id: comment.id || comment.commentId || null,
      },
    });
  }

  // If no comments were extracted, fallback to posts themselves
  if (mentions.length === 0) {
    console.log("Facebook Comments: no comments found, falling back to post content");
    for (const post of posts) {
      const content = (post.text || post.message || post.postText || "").substring(0, 2000);
      if (content.length < 5) continue;
      const postUrl = post.url || post.postUrl || post.link || null;
      mentions.push({
        entity_id: entityId,
        source: "facebook_comments",
        source_url: postUrl,
        author_name: post.user?.name || post.pageName || entityName,
        author_handle: post.user?.profileUrl || null,
        content,
        published_at: post.time || (post.timestamp ? new Date(post.timestamp * 1000).toISOString() : new Date().toISOString()),
        engagement: {
          likes: post.likes || post.topReactionsCount || 0,
          comments: post.comments || 0,
          shares: post.shares || 0,
          views: 0,
        },
        hashtags: [],
        media_urls: post.media?.map((m: any) => m.thumbnail || m.url || m) || [],
        raw_data: { source: "apify_facebook_posts_fallback" },
      });
    }
  }

  console.log(`Facebook Comments: total ${mentions.length} mentions extracted`);
  return mentions;
}

// ══════════════════════════════════════════════════
// TWITTER REPLIES — usa mesma estratégia abrangente
// (reutiliza os actors já definidos em collectTwitter)
// ══════════════════════════════════════════════════

async function collectTwitterReplies(token: string, twHandle: string, entityName: string, entityId: string): Promise<any[]> {
  console.log(`Twitter Replies: comprehensive collection for @${twHandle} / "${entityName}"`);
  // Reutiliza a função abrangente com source label "twitter_comments"
  const results = await collectTwitter(token, `"${entityName}"`, entityName, entityId, twHandle);
  // Reaplica o source correto para diferenciar no frontend
  return results.map(m => ({ ...m, source: "twitter_comments" }));
}

// ══════════════════════════════════════════════════
// TIKTOK — Busca pública por keyword/hashtag
// Multi-actor: clockworks (keyword/hashtag), apidojo, sociavault
// Estratégia: 6 queries paralelas cobrindo nome, @handle,
// hashtags políticas, cargo, cidade e contexto
// ══════════════════════════════════════════════════

function mapTikTokItem(item: any, entityId: string, source: string): any | null {
  if (!item || typeof item !== "object") return null;
  const content = (
    item.text || item.desc || item.description || item.title || item.caption || ""
  ).substring(0, 2000);
  if (content.length < 5) return null;

  // Defensivo: author pode ser null mesmo com authorMeta definido
  const authorName =
    (item.authorMeta && item.authorMeta.name ? item.authorMeta.name : null) ||
    (item.author && item.author.name ? item.author.name : null) ||
    item.nickname || item.uniqueId || item.username || item.handle || null;
  const authorHandle =
    (item.authorMeta && item.authorMeta.id ? item.authorMeta.id : null) ||
    (item.author && item.author.id ? item.author.id : null) ||
    item.uniqueId || item.username || item.handle || null;

  const videoId = item.id || item.videoId || item.video_id || null;
  const handle = authorHandle || authorName;
  const sourceUrl =
    item.webVideoUrl || item.videoUrl || item.url || item.shareUrl ||
    (videoId && handle ? `https://www.tiktok.com/@${handle}/video/${videoId}` : null);

  return {
    entity_id: entityId,
    source,
    source_url: sourceUrl,
    author_name: authorName,
    author_handle: authorHandle,
    content,
    published_at: item.createTimeISO || (item.createTime ? new Date(item.createTime * 1000).toISOString() : new Date().toISOString()),
    engagement: {
      likes: item.diggCount || item.likeCount || item.likes || 0,
      comments: item.commentCount || item.comments || 0,
      shares: item.shareCount || item.shares || 0,
      views: item.playCount || item.viewCount || item.views || 0,
    },
    hashtags: (item.hashtags || item.challenges || []).map((h: any) => {
      if (!h) return null;
      if (typeof h === "string") return h;
      return h.name || h.title || null;
    }).filter(Boolean),
    media_urls: (item.covers && item.covers.dynamic) ? [item.covers.dynamic] : ((item.videoMeta && item.videoMeta.coverUrl) ? [item.videoMeta.coverUrl] : []),
    raw_data: { source: `apify_tiktok_${source}`, search_query: item.searchQuery || null },
  };
}

// Runner: clockworks~tiktok-scraper (keyword)
async function runClockworksKeyword(token: string, keyword: string, maxItems: number, timeoutSecs: number): Promise<any[]> {
  console.log(`TikTok clockworks keyword: "${keyword}"`);
  const items = await runApifyActor(token, APIFY_ACTORS.tiktok_scraper, {
    search: [keyword],
    resultsPerPage: maxItems,
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
    shouldDownloadSlideshowImages: false,
  }, timeoutSecs);
  console.log(`TikTok clockworks keyword "${keyword}": ${items.length} videos`);
  return items;
}

// Runner: clockworks~tiktok-scraper (hashtag)
async function runClockworksHashtag(token: string, hashtag: string, maxItems: number, timeoutSecs: number): Promise<any[]> {
  const tag = hashtag.replace(/^#/, "");
  console.log(`TikTok clockworks hashtag: #${tag}`);
  const items = await runApifyActor(token, APIFY_ACTORS.tiktok_scraper, {
    hashtags: [tag],
    resultsPerPage: maxItems,
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
    shouldDownloadSlideshowImages: false,
  }, timeoutSecs);
  console.log(`TikTok clockworks hashtag "#${tag}": ${items.length} videos`);
  return items;
}

// Runner: apidojo~tiktok-scraper (keyword)
async function runApidojoTikTok(token: string, keyword: string, maxItems: number, timeoutSecs: number): Promise<any[]> {
  console.log(`TikTok apidojo keyword: "${keyword}"`);
  const items = await runApifyActor(token, APIFY_ACTORS.tiktok_apidojo, {
    keywords: [keyword],
    maxItems,
    region: "BR",
  }, timeoutSecs);
  console.log(`TikTok apidojo keyword "${keyword}": ${items.length} videos`);
  return items;
}

// Runner: sociavault~tiktok-keyword-search-scraper (keyword BR)
async function runSociaVaultTikTok(token: string, keyword: string, maxItems: number, timeoutSecs: number): Promise<any[]> {
  console.log(`TikTok sociavault keyword: "${keyword}"`);
  const items = await runApifyActor(token, APIFY_ACTORS.tiktok_keyword, {
    keyword,
    maxItems,
    region: "BR",
  }, timeoutSecs);
  console.log(`TikTok sociavault keyword "${keyword}": ${items.length} videos`);
  return items;
}

// ── Orquestrador principal: TikTok busca pública ──
async function collectTikTok(token: string, query: string, entityName: string, entityId: string, tkHandle?: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];
  const handle = (tkHandle || "").replace(/^@/, "");

  // Hashtags derivadas do nome (sem espaços)
  const hashtagName = `${firstName}${lastName}`.toLowerCase();
  const hashtagHandle = handle || hashtagName;

  console.log(`TikTok: launching 7 parallel searches for "${entityName}"`);

  // Busca paralela: 3 queries principais com timeouts curtos para caber no limite da Edge Function
  const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
    runClockworksKeyword(token, `${firstName} ${lastName} deputado`, 15, 20).catch(() => []),
    runApidojoTikTok(token, entityName, 15, 20).catch(() => []),
    runClockworksHashtag(token, hashtagHandle, 15, 20).catch(() => []),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
  ]);

  // Deduplica por ID de vídeo ou URL
  const seen = new Set<string>();
  const deduped: any[] = [];

  const allSources = [
    [r1, "tiktok"], [r2, "tiktok"], [r3, "tiktok"],
    [r4, "tiktok"], [r5, "tiktok"], [r6, "tiktok"], [r7, "tiktok"],
  ] as [any[], string][];

  for (const [items, srcLabel] of allSources) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const key =
        item.id || item.videoId ||
        item.webVideoUrl || item.url || item.shareUrl ||
        ((item.text || item.desc || "") + "").substring(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      try {
        const mapped = mapTikTokItem(item, entityId, srcLabel);
        if (mapped) deduped.push(mapped);
      } catch (e) {
        console.error("TikTok mapItem error:", e instanceof Error ? e.message : e, JSON.stringify(item).substring(0, 200));
      }
    }
  }

  console.log(`TikTok public search: ${deduped.length} unique videos after dedup`);
  return deduped;
}

// ══════════════════════════════════════════════════
// TIKTOK COMMENTS (from entity's own profile)
// Dois estágios: busca vídeos do perfil → comentários
// Usa clockworks~tiktok-scraper (perfil) + easyapi (comentários)
// ══════════════════════════════════════════════════

async function collectTikTokComments(token: string, tkHandle: string, entityName: string, entityId: string): Promise<any[]> {
  const handle = tkHandle.replace(/^@/, "");
  console.log(`TikTok Comments: Stage 1 - fetching videos from profile @${handle}`);

  // Stage 1: Busca vídeos do perfil usando clockworks~tiktok-scraper
  const profileData = await runApifyActor(token, APIFY_ACTORS.tiktok_scraper, {
    profiles: [handle],
    resultsPerPage: 15,
    shouldDownloadCovers: false,
    shouldDownloadVideos: false,
    shouldDownloadSlideshowImages: false,
  }, 45).catch(async () => {
    // Fallback: tenta o actor de perfil legado
    console.log("TikTok Comments: fallback to clockworks~tiktok-profile-scraper");
    return runApifyActor(token, APIFY_ACTORS.tiktok_profile, {
      profiles: [handle],
      resultsPerPage: 10,
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
    }, 40);
  });

  // Extrai URLs dos vídeos
  const videoUrls: string[] = [];
  for (const item of profileData) {
    const videoId = item.id || item.videoId;
    const authorHandle = item.authorMeta?.id || item.uniqueId || handle;
    const videoUrl =
      item.webVideoUrl || item.videoUrl || item.url || item.shareUrl ||
      (videoId ? `https://www.tiktok.com/@${authorHandle}/video/${videoId}` : null);
    if (videoUrl) videoUrls.push(videoUrl);
  }

  console.log(`TikTok Comments: Stage 1 got ${profileData.length} items, ${videoUrls.length} video URLs`);

  // Fallback: sem URLs → usa legendas dos vídeos
  if (videoUrls.length === 0) {
    console.log("TikTok Comments: no video URLs, using captions as fallback");
    return profileData.map(item => mapTikTokItem(item, entityId, "tiktok_comments")).filter(Boolean) as any[];
  }

  // Stage 2: busca comentários nos vídeos
  const postUrls = videoUrls.slice(0, 12);
  console.log(`TikTok Comments: Stage 2 - fetching comments from ${postUrls.length} videos`);
  const commentItems = await runApifyActor(token, APIFY_ACTORS.tiktok_comments, {
    postURLs: postUrls,
    commentsPerPost: 10,
    maxRepliesPerComment: 0,
  }, 90);

  console.log(`TikTok Comments: Stage 2 got ${commentItems.length} comment items`);
  if (commentItems.length > 0) {
    console.log(`TikTok Comments: comment keys: ${Object.keys(commentItems[0]).join(", ")}`);
    console.log(`TikTok Comments: sample: ${JSON.stringify(commentItems[0]).substring(0, 500)}`);
  }

  const mentions: any[] = [];

  for (const comment of commentItems) {
    const content = (comment.text || comment.comment || comment.desc || comment.body || "").substring(0, 2000);
    if (content.length < 3) continue;

    mentions.push({
      entity_id: entityId,
      source: "tiktok_comments",
      source_url: comment.videoUrl || comment.postUrl || null,
      author_name: comment.nickname || comment.uniqueId || comment.user?.nickname || null,
      author_handle: comment.uniqueId || comment.user?.uniqueId || null,
      content,
      published_at: comment.createTimeISO || (comment.createTime ? new Date(comment.createTime * 1000).toISOString() : new Date().toISOString()),
      engagement: {
        likes: comment.diggCount || comment.likes || comment.likeCount || 0,
        comments: comment.replyCount || comment.replyCommentTotal || 0,
        shares: 0,
        views: 0,
      },
      hashtags: [],
      media_urls: [],
      raw_data: {
        source: "apify_tiktok_comments",
        comment_id: comment.cid || comment.id || null,
      },
    });
  }

  // Fallback: se não há comentários, usa legendas dos vídeos via mapTikTokItem
  if (mentions.length === 0) {
    console.log("TikTok Comments: no comments found, falling back to video captions");
    return profileData.map(item => {
      const mapped = mapTikTokItem(item, entityId, "tiktok_comments");
      return mapped;
    }).filter(Boolean) as any[];
  }

  console.log(`TikTok Comments: total ${mentions.length} mentions extracted`);
  return mentions;
}

// ══════════════════════════════════════════════════
// YOUTUBE COMMENTS (from entity's own channel)
// Two-stage: fetch channel videos → extract comments
// ══════════════════════════════════════════════════

async function collectYouTubeComments(token: string, ytHandle: string, entityName: string, entityId: string): Promise<any[]> {
  const handle = ytHandle.replace(/^@/, "");
  const channelUrl = handle.startsWith("http") ? handle : `https://www.youtube.com/@${handle}`;
  console.log(`YouTube Comments: Stage 1 - fetching videos from ${channelUrl}`);

  // Stage 1: Get recent video URLs from the channel (scrapesmith actor)
  const channelData = await runApifyActor(token, APIFY_ACTORS.youtube_channel, {
    channelUrls: [channelUrl],
    videosPerChannel: 10,
  }, 60);

  const videoUrls: string[] = [];
  if (channelData.length > 0) {
    console.log(`YouTube Comments: Stage 1 sample keys: ${Object.keys(channelData[0]).join(", ")}`);
    console.log(`YouTube Comments: Stage 1 sample: ${JSON.stringify(channelData[0]).substring(0, 600)}`);
  }
  for (const item of channelData) {
    // scrapesmith actor uses numbered field names like "11 Video URL"
    const videoUrl = item["11 Video URL"] || item.url || item.videoUrl || item.video_url || item.link;
    const videoId = item["01 ID"] || item.videoId || item.id;
    const resolvedUrl = videoUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
    if (resolvedUrl && resolvedUrl.includes("watch")) videoUrls.push(resolvedUrl);
  }

  console.log(`YouTube Comments: Stage 1 got ${channelData.length} items, ${videoUrls.length} video URLs`);

  if (videoUrls.length === 0) {
    console.log("YouTube Comments: no video URLs found");
    return [];
  }

  // Stage 2: Get comments from those videos using paid actor
  console.log(`YouTube Comments: Stage 2 - fetching comments from ${videoUrls.slice(0, 10).length} videos`);
  const commentItems = await runApifyActor(token, APIFY_ACTORS.youtube_comments, {
    startUrls: videoUrls.slice(0, 10).map(url => ({ url })),
    maxComments: 100,
    maxReplies: 0,
  }, 90);

  const mentions: any[] = [];

  for (const comment of commentItems) {
    const content = (comment.text || comment.comment || comment.commentText || comment.content || "").substring(0, 2000);
    if (content.length < 3) continue;

    mentions.push({
      entity_id: entityId,
      source: "youtube_comments",
      source_url: comment.videoUrl || (comment.videoId ? `https://www.youtube.com/watch?v=${comment.videoId}` : null),
      author_name: comment.author || comment.authorName || comment.userName || null,
      author_handle: comment.authorChannelUrl || comment.authorUrl || null,
      content,
      published_at: comment.publishedAt || comment.date || comment.timestamp || new Date().toISOString(),
      engagement: {
        likes: comment.likes || comment.likeCount || comment.voteCount || 0,
        comments: comment.replyCount || comment.totalReplyCount || 0,
        shares: 0,
        views: 0,
      },
      hashtags: [],
      media_urls: [],
      raw_data: {
        source: "apify_youtube_comments",
        comment_id: comment.commentId || comment.id || null,
        video_title: comment.videoTitle || null,
      },
    });
  }

  // Fallback: if no comments extracted, use video metadata from Stage 1
  if (mentions.length === 0) {
    console.log("YouTube Comments: no comments found, falling back to video metadata");
    for (const item of channelData) {
      const title = item["02 Title"] || item.title || "";
      const description = item["12 Description"] || item.description || "";
      const content = (title + (description ? `. ${description}` : "")).substring(0, 2000);
      if (content.length < 5) continue;

      const videoUrl = item["11 Video URL"] || item.url || item.videoUrl || null;
      mentions.push({
        entity_id: entityId,
        source: "youtube_comments",
        source_url: videoUrl,
        author_name: item["09 Channel Name"] || entityName,
        author_handle: item["10 Channel URL"] || null,
        content,
        published_at: item["07 Date Posted"] ? new Date(item["07 Date Posted"]).toISOString() : new Date().toISOString(),
        engagement: {
          likes: item["04 Likes"] || 0,
          comments: item["05 Comments"] || 0,
          shares: 0,
          views: item["03 Views"] || 0,
        },
        hashtags: [],
        media_urls: item["13 Thumbnail"] ? [item["13 Thumbnail"]] : [],
        raw_data: { source: "apify_youtube_videos_fallback" },
      });
    }
  }

  console.log(`YouTube Comments: total ${mentions.length} mentions extracted`);
  return mentions;
}

// ══════════════════════════════════════════════════
// REDDIT (via Apify trudax~reddit-scraper)
// ══════════════════════════════════════════════════

async function collectReddit(token: string, query: string, entityName: string, entityId: string): Promise<any[]> {
  const searchTerm = query.replace(/"/g, "");
  console.log(`Reddit: searching for "${searchTerm}" in r/brasilia and r/brasil`);

  const items = await runApifyActor(token, APIFY_ACTORS.reddit, {
    startUrls: [
      { url: `https://www.reddit.com/r/brasilia/search/?q=${encodeURIComponent(searchTerm)}&sort=new` },
      { url: `https://www.reddit.com/r/brasil/search/?q=${encodeURIComponent(searchTerm)}&sort=new` },
    ],
    maxItems: 50,
    maxPostCount: 30,
    maxComments: 50,
    searchSort: "new",
    proxy: { useApifyProxy: true },
  }, 90);

  console.log(`Reddit: got ${items.length} items`);
  if (items.length > 0) {
    console.log(`Reddit: sample keys: ${Object.keys(items[0]).join(", ")}`);
  }

  return items.map(item => {
    const content = (item.body || item.title || item.selftext || item.text || "").substring(0, 2000);
    if (content.length < 5) return null;

    return {
      entity_id: entityId,
      source: "reddit",
      source_url: item.url || item.permalink ? `https://www.reddit.com${item.permalink}` : null,
      author_name: item.author || item.username || null,
      author_handle: item.author ? `u/${item.author}` : null,
      content,
      published_at: item.createdAt || item.created_utc ? new Date((item.created_utc || 0) * 1000).toISOString() : new Date().toISOString(),
      engagement: {
        likes: item.score || item.ups || 0,
        comments: item.numComments || item.num_comments || 0,
        shares: 0,
        views: 0,
      },
      hashtags: [],
      media_urls: item.thumbnail && item.thumbnail !== "self" ? [item.thumbnail] : [],
      raw_data: {
        source: "apify_reddit",
        subreddit: item.subreddit || item.subredditName || null,
        post_type: item.body ? "comment" : "post",
      },
    };
  }).filter(Boolean);
}

// ══════════════════════════════════════════════════
// PORTAIS DF (Metrópoles, Correio Braziliense, G1 DF)
// Uses Zenscrape to scrape local DF news portals
// ══════════════════════════════════════════════════

async function collectPortaisDF(apiKey: string, searchQuery: string, entityName: string, entityId: string): Promise<any[]> {
  const collectedMentions: any[] = [];
  const portalUrls = [
    `https://www.metropoles.com/?s=${encodeURIComponent(searchQuery)}`,
    `https://www.correiobraziliense.com.br/busca/?q=${encodeURIComponent(searchQuery)}`,
    `https://g1.globo.com/busca/?q=${encodeURIComponent(searchQuery)}&species=not%C3%ADcias&editoria=df`,
  ];

  for (const targetUrl of portalUrls) {
    try {
      const zenscrapeUrl = `https://app.zenscrape.com/api/v1/get?url=${encodeURIComponent(targetUrl)}`;
      console.log(`Portais DF: fetching ${targetUrl}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(zenscrapeUrl, {
        headers: { "apikey": apiKey },
        signal: controller.signal,
      }).catch(e => {
        console.error("Portais DF fetch error:", e.message);
        return null;
      });

      clearTimeout(timeout);

      if (res?.ok) {
        const html = await res.text();
        console.log(`Portais DF: received ${html.length} chars from ${targetUrl.split("/")[2]}`);
        const extracted = extractMentionsFromHTML(html, entityName, "portais_df", entityId);
        collectedMentions.push(...extracted);
        console.log(`Portais DF: extracted ${extracted.length} mentions`);
      } else if (res) {
        const errBody = await res.text();
        console.error(`Portais DF error ${res.status}: ${errBody.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Portais DF error:", e);
    }
  }

  return collectedMentions;
}

// ══════════════════════════════════════════════════
// HELPER: Extract reaction types from Facebook/Instagram items
// ══════════════════════════════════════════════════

function extractReactionTypes(item: any): Record<string, number> | null {
  // Facebook reaction breakdown
  const types: Record<string, number> = {};
  const reactionFields = ["likeCount", "loveCount", "wowCount", "hahaCount", "sadCount", "angryCount", "careCount"];
  let hasAny = false;
  for (const field of reactionFields) {
    if (item[field] && item[field] > 0) {
      types[field.replace("Count", "")] = item[field];
      hasAny = true;
    }
  }
  // Also check topReactions array
  if (item.topReactions && Array.isArray(item.topReactions)) {
    for (const r of item.topReactions) {
      if (r.type && r.count) {
        types[r.type.toLowerCase()] = r.count;
        hasAny = true;
      }
    }
  }
  return hasAny ? types : null;
}

// ══════════════════════════════════════════════════
// TELEGRAM (public channels via Apify)
// ══════════════════════════════════════════════════

async function collectTelegram(token: string, tgConfig: string | string[], searchQuery: string, entityName: string, entityId: string): Promise<any[]> {
  let allChannels: string[] = [];
  if (Array.isArray(tgConfig)) {
    allChannels = tgConfig;
  } else if (typeof tgConfig === "string") {
    allChannels = tgConfig.split(",").map(c => c.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "")).filter(Boolean);
  }

  if (allChannels.length === 0) {
    console.log("Telegram: no channels configured");
    return [];
  }

  // Rotation: process 1 channel per execution to avoid timeout
  const rotationIndex = Math.floor(Date.now() / 60000) % allChannels.length;
  const channel = allChannels[rotationIndex];
  console.log(`Telegram: rotating channel ${rotationIndex + 1}/${allChannels.length}: ${channel}`);

  const items = await runApifyActor(token, APIFY_ACTORS.telegram, {
    channels: [channel],
    maxMessagesPerChannel: 30,
  }, 60);

  console.log(`Telegram: got ${items.length} items`);
  if (items.length > 0) {
    console.log(`Telegram: sample keys: ${Object.keys(items[0]).join(", ")}`);
  }

  const nameLower = entityName.toLowerCase();
  const searchLower = searchQuery.replace(/"/g, "").toLowerCase();

  return items.map(item => {
    const content = (item.description || item.text || item.message || "").substring(0, 2000);
    if (content.length < 5) return null;

    const contentLower = content.toLowerCase();
    if (!contentLower.includes(nameLower) && !contentLower.includes(searchLower)) return null;

    return {
      entity_id: entityId,
      source: "telegram",
      source_url: item.url || (item.channel ? `https://t.me/${item.channel}` : null),
      author_name: item.channel || item.channelName || null,
      author_handle: item.channel ? `@${item.channel}` : null,
      content,
      published_at: item.fulldate || item.date || new Date().toISOString(),
      engagement: {
        views: item.views || 0,
        likes: 0,
        comments: 0,
        shares: item.forwards || 0,
      },
      hashtags: [],
      media_urls: item.image ? [item.image] : [],
      raw_data: {
        source: "apify_telegram",
        channel: item.channel || null,
      },
    };
  }).filter(Boolean);
}

// ══════════════════════════════════════════════════
// INFLUENCER COMMENTS (third-party Instagram profiles)
// Scrapes posts from influencer profiles, filters for entity mentions,
// then collects comments from matching posts
// ══════════════════════════════════════════════════

async function collectInfluencerComments(token: string, influencerConfig: string | string[], entityName: string, entityId: string): Promise<any[]> {
  let handles: string[] = [];
  if (Array.isArray(influencerConfig)) {
    handles = influencerConfig;
  } else if (typeof influencerConfig === "string") {
    handles = influencerConfig.split(",").map(h => h.trim().replace(/^@/, ""));
  }

  if (handles.length === 0) {
    console.log("Influencer Comments: no handles configured");
    return [];
  }

  // Rotation: process 1 influencer per execution to avoid timeout
  const rotationIndex = Math.floor(Date.now() / 60000) % handles.length;
  const selectedHandle = handles[rotationIndex].replace(/^@/, "");
  console.log(`Influencer Comments: rotating ${rotationIndex + 1}/${handles.length}: @${selectedHandle}`);

  const nameLower = entityName.toLowerCase();
  const allMentions: any[] = [];

  const cleanHandle = selectedHandle;
  const profileUrl = `https://www.instagram.com/${cleanHandle}`;
  console.log(`Influencer Comments: fetching posts from ${profileUrl}`);

  // Stage 1: Get recent posts
  const posts = await runApifyActor(token, APIFY_ACTORS.instagram, {
    directUrls: [profileUrl],
    resultsType: "posts",
    resultsLimit: 5,
  }, 20);

  if (!posts.length) {
    console.log(`Influencer Comments: no posts from @${cleanHandle}`);
    return [];
  }

  // Filter posts that mention/tag the entity
  const relevantPosts = posts.filter(p => {
    const caption = (p.caption || p.text || "").toLowerCase();
    const mList = (p.mentions || p.taggedUsers || []).map((m: any) => (typeof m === "string" ? m : m.username || m.full_name || "").toLowerCase());
    const hList = (p.hashtags || []).map((h: any) => (typeof h === "string" ? h : "").toLowerCase());
    return caption.includes(nameLower) ||
      mList.some((m: string) => m.includes(nameLower)) ||
      hList.some((h: string) => h.includes(nameLower.replace(/\s+/g, "")));
  });

  console.log(`Influencer Comments: @${cleanHandle} - ${posts.length} posts, ${relevantPosts.length} mention "${entityName}"`);

  if (relevantPosts.length === 0) {
    // No explicit mention — keep posts as context
    for (const post of posts.slice(0, 5)) {
      const content = (post.caption || post.text || "").substring(0, 2000);
      if (content.length < 5) continue;
      const postUrl = post.url || post.postUrl || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null);
      allMentions.push({
        entity_id: entityId,
        source: "influencer_comments",
        source_url: postUrl,
        author_name: post.ownerFullName || cleanHandle,
        author_handle: `@${cleanHandle}`,
        content,
        published_at: post.timestamp || (post.takenAtTimestamp ? new Date(post.takenAtTimestamp * 1000).toISOString() : new Date().toISOString()),
        engagement: { likes: post.likesCount || 0, comments: post.commentsCount || 0, views: post.videoViewCount || 0, shares: 0 },
        hashtags: post.hashtags || [],
        media_urls: post.displayUrl ? [post.displayUrl] : [],
        raw_data: { source: "apify_influencer_post", influencer: cleanHandle },
      });
    }
    console.log(`Influencer Comments: total ${allMentions.length} mentions (context posts)`);
    return allMentions;
  }

  // Stage 2: Get comments from relevant posts
  const postUrls = relevantPosts
    .map(p => p.url || p.postUrl || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null))
    .filter(Boolean)
    .slice(0, 10);

  if (postUrls.length > 0) {
    console.log(`Influencer Comments: Stage 2 - fetching comments from ${postUrls.length} posts of @${cleanHandle}`);
    const commentItems = await runApifyActor(token, APIFY_ACTORS.instagram_comments, {
      directUrls: postUrls,
      maxComments: 20,
      maxReplies: 0,
    }, 30);

    console.log(`Influencer Comments: got ${commentItems.length} comments from @${cleanHandle}`);

    for (const comment of commentItems) {
      const content = (comment.text || comment.comment || comment.body || "").substring(0, 2000);
      if (content.length < 3) continue;
      allMentions.push({
        entity_id: entityId,
        source: "influencer_comments",
        source_url: comment.postUrl || comment.inputUrl || null,
        author_name: comment.ownerFullName || comment.fullName || null,
        author_handle: comment.ownerUsername || comment.username || null,
        content,
        published_at: comment.timestamp || comment.createdAt || new Date().toISOString(),
        engagement: { likes: comment.likesCount || comment.likes || 0, comments: comment.repliesCount || 0, shares: 0, views: 0 },
        hashtags: [],
        media_urls: [],
        raw_data: { source: "apify_influencer_comments", influencer: cleanHandle, comment_id: comment.id || comment.commentId || null },
      });
    }
  }

  // Also add the relevant posts themselves
  for (const post of relevantPosts) {
    const content = (post.caption || post.text || "").substring(0, 2000);
    if (content.length < 5) continue;
    const postUrl = post.url || post.postUrl || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : null);
    allMentions.push({
      entity_id: entityId,
      source: "influencer_comments",
      source_url: postUrl,
      author_name: post.ownerFullName || cleanHandle,
      author_handle: `@${cleanHandle}`,
      content,
      published_at: post.timestamp || (post.takenAtTimestamp ? new Date(post.takenAtTimestamp * 1000).toISOString() : new Date().toISOString()),
      engagement: { likes: post.likesCount || 0, comments: post.commentsCount || 0, views: post.videoViewCount || 0, shares: 0 },
      hashtags: post.hashtags || [],
      media_urls: post.displayUrl ? [post.displayUrl] : [],
      raw_data: { source: "apify_influencer_post_relevant", influencer: cleanHandle },
    });
  }

  console.log(`Influencer Comments: total ${allMentions.length} mentions from @${cleanHandle}`);
  return allMentions;
}

// ══════════════════════════════════════════════════
// GOOGLE SEARCH (organic results via Apify)
// Actor: apify~google-search-scraper
// 5 queries paralelas: nome+cargo, nome+DF, nome+política,
// nome+câmara, nome+notícia — captura blogs, fóruns,
// sites de nicho e portais que não aparecem no Google News
// ══════════════════════════════════════════════════

async function collectGoogleSearch(token: string, query: string, entityName: string, entityId: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];

  const queries = [
    `${firstName} ${lastName} deputado`,
    `${firstName} ${lastName} Brasília "Distrito Federal"`,
    `${firstName} ${lastName} câmara lei votação`,
    `${firstName} ${lastName} política mandato`,
    entityName,
  ];

  console.log(`Google Search: launching 5 parallel queries`);

  const results = await Promise.all(
    queries.map(q =>
      runApifyActor(token, APIFY_ACTORS.google_search, {
        queries: [q],
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        languageCode: "pt",
        countryCode: "br",
        mobileResults: false,
      }, 40).catch(e => {
        console.error(`Google Search "${q}" error:`, e.message);
        return [];
      })
    )
  );

  const seen = new Set<string>();
  const deduped: any[] = [];

  for (const items of results) {
    for (const item of items) {
      const url = item.url || item.link || item.href || "";
      const title = item.title || "";
      const snippet = item.snippet || item.description || item.text || "";
      const content = (title ? `${title}. ${snippet}` : snippet).substring(0, 2000);
      if (content.length < 10) continue;
      const key = url || content.substring(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        entity_id: entityId,
        source: "google_search",
        source_url: url || null,
        author_name: item.displayLink || item.domain || null,
        author_handle: null,
        content,
        published_at: item.date || item.publishedAt || new Date().toISOString(),
        engagement: {},
        hashtags: [],
        media_urls: item.imageUrl ? [item.imageUrl] : [],
        raw_data: { source: "apify_google_search", position: item.position || null },
      });
    }
  }

  const total = results.reduce((s, r) => s + r.length, 0);
  console.log(`Google Search: ${deduped.length} unique of ${total} raw`);
  return deduped;
}

// ══════════════════════════════════════════════════
// PORTAIS DE NOTÍCIAS BRASILEIROS
// Scraping via Zenscrape dos maiores portais:
// UOL, Folha de S.Paulo, O Globo, Estadão,
// Band News, Record News, Agência Brasília (DF)
// ══════════════════════════════════════════════════

async function collectPortaisBR(apiKey: string, searchQuery: string, entityName: string, entityId: string): Promise<any[]> {
  const q = encodeURIComponent(searchQuery.replace(/"/g, ""));
  const name = encodeURIComponent(entityName);

  const portais = [
    // UOL Notícias
    { url: `https://busca.uol.com.br/result.htm#q=${q}`, label: "UOL" },
    // Folha de S. Paulo
    { url: `https://search.folha.uol.com.br/search?q=${name}&site=todos`, label: "Folha de S.Paulo" },
    // O Globo
    { url: `https://oglobo.globo.com/busca/?q=${q}`, label: "O Globo" },
    // Estadão
    { url: `https://busca.estadao.com.br/?q=${q}&datainicial=&datafinal=`, label: "Estadão" },
    // Band News
    { url: `https://www.band.uol.com.br/noticias/busca?q=${q}`, label: "Band News" },
    // Record News
    { url: `https://www.recordtv.com.br/busca?q=${q}`, label: "Record News" },
    // Agência Brasília (local DF)
    { url: `https://www.agenciabrasilia.df.gov.br/?s=${q}`, label: "Agência Brasília" },
  ];

  const collectedMentions: any[] = [];
  // Process 3 portals per run (rotation to avoid timeout)
  const rotationStart = Math.floor(Date.now() / 120000) % portais.length;
  const selected = [
    portais[rotationStart % portais.length],
    portais[(rotationStart + 1) % portais.length],
    portais[(rotationStart + 2) % portais.length],
  ];

  for (const portal of selected) {
    try {
      const zenscrapeUrl = `https://app.zenscrape.com/api/v1/get?url=${encodeURIComponent(portal.url)}`;
      console.log(`Portais BR: fetching ${portal.label}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(zenscrapeUrl, {
        headers: { "apikey": apiKey },
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res?.ok) {
        const html = await res.text();
        const extracted = extractMentionsFromHTML(html, entityName, "portais_br", entityId);
        for (const m of extracted) {
          m.author_name = portal.label;
          m.source_url = portal.url;
          m.raw_data = { ...m.raw_data, portal: portal.label };
        }
        collectedMentions.push(...extracted);
        console.log(`Portais BR: ${extracted.length} mentions from ${portal.label}`);
      }
    } catch (e) {
      console.error(`Portais BR error (${portal.label}):`, e);
    }
  }

  return collectedMentions;
}

// ══════════════════════════════════════════════════
// THREADS (Meta) via Apify
// Actor: apify~threads-scraper
// 5 queries paralelas: nome, handle, cargo, DF, câmara
// ══════════════════════════════════════════════════

async function collectThreads(token: string, query: string, entityName: string, entityId: string, thHandle?: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];
  const handle = (thHandle || "").replace(/^@/, "");

  const searches = [
    `${firstName} ${lastName} deputado`,
    handle ? handle : entityName,
    `${firstName} ${lastName} Brasília política`,
    `${firstName} ${lastName} câmara lei`,
    entityName,
  ];

  console.log(`Threads: launching 5 parallel searches`);

  const results = await Promise.all(
    searches.map(s =>
      runApifyActor(token, APIFY_ACTORS.threads, {
        searchQueries: [s],
        maxResultsPerQuery: 20,
        resultsType: "posts",
      }, 40).catch(e => {
        console.error(`Threads "${s}" error:`, e.message);
        return [];
      })
    )
  );

  const seen = new Set<string>();
  const deduped: any[] = [];

  for (const items of results) {
    for (const item of items) {
      const content = (item.text || item.caption || item.content || "").substring(0, 2000);
      if (content.length < 5) continue;
      const key = item.id || item.postId || item.url || content.substring(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        entity_id: entityId,
        source: "threads",
        source_url: item.url || item.postUrl || (item.id ? `https://www.threads.net/p/${item.id}` : null),
        author_name: item.username || item.ownerUsername || item.author?.username || null,
        author_handle: item.username || item.ownerUsername || null,
        content,
        published_at: item.timestamp || item.createdAt || item.takenAt || new Date().toISOString(),
        engagement: {
          likes: item.likeCount || item.likes || 0,
          comments: item.replyCount || item.commentsCount || 0,
          shares: item.reshareCount || 0,
          views: item.viewCount || 0,
        },
        hashtags: (item.hashtags || []).map((h: any) => (typeof h === "string" ? h : h.name || "")),
        media_urls: item.imageUrl ? [item.imageUrl] : [],
        raw_data: { source: "apify_threads", post_id: item.id || null },
      });
    }
  }

  const total = results.reduce((s, r) => s + r.length, 0);
  console.log(`Threads: ${deduped.length} unique of ${total} raw`);
  return deduped;
}

// ══════════════════════════════════════════════════
// YOUTUBE SEARCH (vídeos que mencionam a entidade)
// Actor: bernardo~youtube-scraper (busca por keyword)
// 4 queries paralelas: nome+cargo, nome+DF, nome+câmara,
// nome+notícia — captura cobertura de canais de notícias,
// comentaristas políticos, etc.
// ══════════════════════════════════════════════════

async function collectYouTubeSearch(token: string, query: string, entityName: string, entityId: string): Promise<any[]> {
  const firstName = entityName.split(" ")[0];
  const lastName = entityName.split(" ").slice(-1)[0];

  const searches = [
    `${firstName} ${lastName} deputado`,
    `${firstName} ${lastName} câmara brasília`,
    `${firstName} ${lastName} política votação`,
    entityName,
  ];

  console.log(`YouTube Search: launching 4 parallel searches`);

  const results = await Promise.all(
    searches.map(q =>
      runApifyActor(token, APIFY_ACTORS.youtube_search, {
        searchKeywords: q,
        maxResults: 15,
        gl: "br",
        hl: "pt",
      }, 50).catch(e => {
        console.error(`YouTube Search "${q}" error:`, e.message);
        return [];
      })
    )
  );

  const seen = new Set<string>();
  const deduped: any[] = [];

  for (const items of results) {
    for (const item of items) {
      const title = item.title || item.name || "";
      const description = item.description || item.snippet || "";
      const content = (title + (description ? `. ${description}` : "")).substring(0, 2000);
      if (content.length < 5) continue;
      const videoId = item.id || item.videoId || item.video_id;
      const url = item.url || item.link || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
      const key = videoId || url || content.substring(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({
        entity_id: entityId,
        source: "youtube_search",
        source_url: url,
        author_name: item.channelName || item.channel?.name || item.author || null,
        author_handle: item.channelUrl || item.channel?.url || null,
        content,
        published_at: item.publishedAt || item.uploadDate || item.date || new Date().toISOString(),
        engagement: {
          views: item.viewCount || item.views || 0,
          likes: item.likes || item.likeCount || 0,
          comments: item.commentCount || item.comments || 0,
          shares: 0,
        },
        hashtags: [],
        media_urls: item.thumbnailUrl ? [item.thumbnailUrl] : (item.thumbnail ? [item.thumbnail] : []),
        raw_data: { source: "apify_youtube_search", video_id: videoId || null, duration: item.duration || null },
      });
    }
  }

  const total = results.reduce((s, r) => s + r.length, 0);
  console.log(`YouTube Search: ${deduped.length} unique of ${total} raw`);
  return deduped;
}

// ══════════════════════════════════════════════════
// FONTES OFICIAIS (Agência Câmara, Senado, TSE, Câmara DF)
// Raspagem via Zenscrape das fontes institucionais
// que cobrem atividade parlamentar oficial
// ══════════════════════════════════════════════════

async function collectFontesOficiais(apiKey: string, searchQuery: string, entityName: string, entityId: string): Promise<any[]> {
  const q = encodeURIComponent(entityName);

  const fontes = [
    // Agência Câmara dos Deputados
    { url: `https://www.camara.leg.br/busca-portal?contextoBusca=BuscaGeral&pagina=1&order=relevancia&tipo=lista&textoFiltro=${q}`, label: "Agência Câmara" },
    // Agência Senado
    { url: `https://www12.senado.leg.br/noticias/busca?q=${q}&btnBusca=`, label: "Agência Senado" },
    // TSE (Tribunal Superior Eleitoral)
    { url: `https://www.tse.jus.br/search?q=${q}&requiredfields=&site=default_collection`, label: "TSE" },
    // Portal da Câmara Legislativa do DF
    { url: `https://www.cl.df.gov.br/busca?q=${q}`, label: "Câmara DF" },
  ];

  const collectedMentions: any[] = [];

  // Rotation: 2 fontes por ciclo
  const rotationStart = Math.floor(Date.now() / 120000) % fontes.length;
  const selected = [
    fontes[rotationStart % fontes.length],
    fontes[(rotationStart + 1) % fontes.length],
  ];

  for (const fonte of selected) {
    try {
      const zenscrapeUrl = `https://app.zenscrape.com/api/v1/get?url=${encodeURIComponent(fonte.url)}`;
      console.log(`Fontes Oficiais: fetching ${fonte.label}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(zenscrapeUrl, {
        headers: { "apikey": apiKey },
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res?.ok) {
        const html = await res.text();
        const extracted = extractMentionsFromHTML(html, entityName, "fontes_oficiais", entityId);
        for (const m of extracted) {
          m.author_name = fonte.label;
          m.source_url = fonte.url;
          m.raw_data = { ...m.raw_data, fonte_oficial: fonte.label };
        }
        collectedMentions.push(...extracted);
        console.log(`Fontes Oficiais: ${extracted.length} mentions from ${fonte.label}`);
      }
    } catch (e) {
      console.error(`Fontes Oficiais error (${fonte.label}):`, e);
    }
  }

  return collectedMentions;
}

// ══════════════════════════════════════════════════
// CUSTOM SITES (user-defined URLs scraped via Zenscrape)
// ══════════════════════════════════════════════════

async function collectCustomSites(apiKey: string, sitesConfig: string | string[], entityName: string, entityId: string): Promise<any[]> {
  let urls: string[] = [];
  if (Array.isArray(sitesConfig)) {
    urls = sitesConfig;
  } else if (typeof sitesConfig === "string") {
    urls = sitesConfig.split(",").map(u => u.trim()).filter(u => u.startsWith("http"));
  }

  if (urls.length === 0) {
    console.log("Custom Sites: no URLs configured");
    return [];
  }

  const collectedMentions: any[] = [];

  for (const targetUrl of urls.slice(0, 10)) {
    try {
      const zenscrapeUrl = `https://app.zenscrape.com/api/v1/get?url=${encodeURIComponent(targetUrl)}`;
      console.log(`Custom Sites: fetching ${targetUrl}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(zenscrapeUrl, {
        headers: { "apikey": apiKey },
        signal: controller.signal,
      }).catch(e => {
        console.error("Custom Sites fetch error:", e.message);
        return null;
      });

      clearTimeout(timeout);

      if (res?.ok) {
        const html = await res.text();
        console.log(`Custom Sites: received ${html.length} chars from ${new URL(targetUrl).hostname}`);
        const extracted = extractMentionsFromHTML(html, entityName, "sites_custom", entityId);
        // Enrich with source URL
        for (const m of extracted) {
          m.source_url = targetUrl;
          m.raw_data = { ...m.raw_data, custom_site_url: targetUrl };
        }
        collectedMentions.push(...extracted);
        console.log(`Custom Sites: extracted ${extracted.length} mentions from ${new URL(targetUrl).hostname}`);
      } else if (res) {
        const errBody = await res.text();
        console.error(`Custom Sites error ${res.status}: ${errBody.substring(0, 200)}`);
      }
    } catch (e) {
      console.error("Custom Sites error:", e);
    }
  }

  return collectedMentions;
}

// ══════════════════════════════════════════════════
// INSTAGRAM COMMENTS — Two-stage: fetch posts, then comments
// Actor: apify~instagram-comment-scraper
// ══════════════════════════════════════════════════

async function collectInstagramComments(token: string, igHandle: string, entityName: string, entityId: string): Promise<any[]> {
  const handle = igHandle.replace(/^@/, "");
  const profileUrl = `https://www.instagram.com/${handle}/`;
  console.log(`Instagram Comments: Stage 1 - fetching posts from ${profileUrl}`);

  // Stage 1: Get recent posts from the profile
  const posts = await runIgScraper(token, {
    directUrls: [profileUrl],
    resultsType: "posts",
    resultsLimit: 10,
  }, 40);

  if (!posts.length) {
    console.log("Instagram Comments: no posts found");
    return [];
  }

  const postUrls = posts
    .map(p => {
      if (p.url) return p.url;
      if (p.shortCode) return `https://www.instagram.com/p/${p.shortCode}/`;
      if (p.id) return `https://www.instagram.com/p/${p.id}/`;
      return null;
    })
    .filter(Boolean)
    .slice(0, 10);

  console.log(`Instagram Comments: Stage 1 got ${posts.length} posts, ${postUrls.length} URLs`);

  if (postUrls.length === 0) return [];

  // Stage 2: Get comments from those posts
  console.log(`Instagram Comments: Stage 2 - fetching comments from ${postUrls.length} posts`);
  const commentItems = await runApifyActor(token, APIFY_ACTORS.instagram_comments, {
    directUrls: postUrls,
    resultsLimit: 100,
  }, 90);

  console.log(`Instagram Comments: Stage 2 got ${commentItems.length} comment items`);
  if (commentItems.length > 0) {
    console.log(`Instagram Comments: comment keys: ${Object.keys(commentItems[0]).join(", ")}`);
  }

  const mentions: any[] = [];

  for (const comment of commentItems) {
    const content = (comment.text || comment.comment || comment.body || comment.content || "").substring(0, 2000);
    if (content.length < 3) continue;

    const postUrl = comment.postUrl || comment.inputUrl || comment.url || null;
    mentions.push({
      entity_id: entityId,
      source: "instagram_comments",
      source_url: postUrl,
      author_name: comment.ownerFullName || comment.username || comment.authorName || comment.owner?.fullName || null,
      author_handle: comment.ownerUsername || comment.username || comment.owner?.username || null,
      content,
      published_at: comment.timestamp ||
        (comment.createdAt ? new Date(comment.createdAt * 1000).toISOString() : null) ||
        comment.date || new Date().toISOString(),
      engagement: {
        likes: comment.likesCount || comment.likes || 0,
        comments: comment.repliesCount || comment.replyCount || 0,
        shares: 0,
        views: 0,
      },
      hashtags: [],
      media_urls: [],
      raw_data: {
        source: "apify_instagram_comments_scraper",
        post_url: postUrl,
        comment_id: comment.id || comment.pk || null,
      },
    });
  }

  // Fallback: if no comments extracted, use post captions
  if (mentions.length === 0) {
    console.log("Instagram Comments: no comments found, falling back to post captions");
    for (const post of posts) {
      const mapped = mapInstagramItem(post, entityId, "instagram_comments");
      if (mapped) mentions.push(mapped);
    }
  }

  console.log(`Instagram Comments: total ${mentions.length} mentions extracted`);
  return mentions;
}


