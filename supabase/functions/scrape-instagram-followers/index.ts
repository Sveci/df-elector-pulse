import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .limit(1)
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acesso não autorizado. Requer permissão de administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[scrape-instagram-followers] Authenticated user: ${user.id} role: ${roleData.role}`);
    // ========== END AUTHENTICATION CHECK ==========

    if (!apifyToken) {
      return new Response(
        JSON.stringify({ error: "APIFY_API_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { instagram_username } = await req.json();
    if (!instagram_username) {
      return new Response(
        JSON.stringify({ error: "instagram_username é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const username = instagram_username.replace("@", "").trim();

    // Use Apify actor to scrape followers
    const actorId = "scraping_solutions~instagram-scraper-followers-following-no-cookies";
    const encodedActorId = actorId.replace("~", "~");

    const actorInput = {
      usernames: [username],
      resultsType: "followers",
      resultsLimit: 50000,
    };

    console.log(`Starting follower scrape for @${username}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2min timeout

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${apifyToken}&timeout=110`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actorInput),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!apifyRes.ok) {
      const errText = await apifyRes.text();
      console.error("Apify error:", errText);
      return new Response(
        JSON.stringify({ error: "Erro ao raspar seguidores", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const followers = await apifyRes.json();
    console.log(`Found ${followers.length} followers`);

    // Get all leaders from DB
    const { data: leaders, error: leadersErr } = await supabase
      .from("lideres")
      .select("id, nome_completo, telefone, email, instagram_username, is_active, cidade_id")
      .eq("is_active", true);

    if (leadersErr) throw leadersErr;

    // Build follower lookup maps
    const followerUsernames = new Set(
      followers.map((f: any) => (f.username || f.login || "").toLowerCase())
    );
    const followerFullNames = new Set(
      followers.map((f: any) => (f.fullName || f.full_name || "").toLowerCase().trim()).filter(Boolean)
    );

    // Cross-reference
    const results = (leaders || []).map((leader: any) => {
      // 1. Exact username match
      let matchType: string | null = null;
      let matchedUsername: string | null = null;

      if (leader.instagram_username) {
        const cleanUsername = leader.instagram_username.replace("@", "").toLowerCase().trim();
        if (followerUsernames.has(cleanUsername)) {
          matchType = "username_exact";
          matchedUsername = cleanUsername;
        }
      }

      // 2. Fuzzy name match (only if no username match)
      if (!matchType && leader.nome_completo) {
        const leaderName = leader.nome_completo.toLowerCase().trim();
        if (followerFullNames.has(leaderName)) {
          matchType = "name_exact";
        } else {
          // Check partial match (first + last name)
          const parts = leaderName.split(" ").filter(Boolean);
          if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts[parts.length - 1];
            for (const f of followers) {
              const fn = (f.fullName || f.full_name || "").toLowerCase().trim();
              if (fn && fn.includes(firstName) && fn.includes(lastName)) {
                matchType = "name_partial";
                matchedUsername = f.username || f.login || null;
                break;
              }
            }
          }
        }
      }

      return {
        leader_id: leader.id,
        nome_completo: leader.nome_completo,
        instagram_username: leader.instagram_username,
        is_follower: matchType !== null,
        match_type: matchType,
        matched_instagram: matchedUsername,
      };
    });

    const followingCount = results.filter((r: any) => r.is_follower).length;
    const notFollowingCount = results.filter((r: any) => !r.is_follower).length;

    return new Response(
      JSON.stringify({
        profile: username,
        total_followers_scraped: followers.length,
        total_leaders: results.length,
        leaders_following: followingCount,
        leaders_not_following: notFollowingCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
