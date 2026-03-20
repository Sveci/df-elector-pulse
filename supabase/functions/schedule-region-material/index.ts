import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  leader_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { leader_id } = body;

    if (!leader_id) {
      console.error("[schedule-region-material] Missing leader_id");
      return new Response(
        JSON.stringify({ success: false, error: "leader_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-region-material] Processing leader: ${leader_id}`);

    // 1. Fetch leader with city info
    const { data: leader, error: leaderError } = await supabase
      .from("lideres")
      .select(`
        id,
        nome_completo,
        telefone,
        cidade_id,
        office_cities (
          id,
          nome
        )
      `)
      .eq("id", leader_id)
      .single();

    if (leaderError || !leader) {
      console.error("[schedule-region-material] Leader not found:", leaderError);
      return new Response(
        JSON.stringify({ success: false, error: "Leader not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-region-material] Leader: ${leader.nome_completo}, City: ${leader.cidade_id}`);

    if (!leader.cidade_id) {
      console.log("[schedule-region-material] Leader has no city_id, skipping");
      return new Response(
        JSON.stringify({ success: true, scheduled: false, reason: "No city assigned" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!leader.telefone) {
      console.log("[schedule-region-material] Leader has no phone, skipping");
      return new Response(
        JSON.stringify({ success: true, scheduled: false, reason: "No phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if region has a material configured
    const { data: material, error: materialError } = await supabase
      .from("region_materials")
      .select("*")
      .eq("city_id", leader.cidade_id)
      .eq("is_active", true)
      .maybeSingle();

    if (materialError) {
      console.error("[schedule-region-material] Error fetching material:", materialError);
      throw materialError;
    }

    if (!material) {
      console.log(`[schedule-region-material] No active material for city ${leader.cidade_id}`);
      return new Response(
        JSON.stringify({ success: true, scheduled: false, reason: "No material configured for region" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[schedule-region-material] Found material: ${material.material_name}, delay: ${material.delay_minutes}min`);

    // 3. Check if already scheduled for this leader
    const { data: existingSchedule } = await supabase
      .from("scheduled_messages")
      .select("id")
      .eq("leader_id", leader_id)
      .ilike("template_slug", "%material%")
      .limit(1);

    if (existingSchedule && existingSchedule.length > 0) {
      console.log("[schedule-region-material] Material already scheduled for this leader");
      return new Response(
        JSON.stringify({ success: true, scheduled: false, reason: "Already scheduled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Calculate scheduled time
    const scheduledFor = new Date();
    scheduledFor.setMinutes(scheduledFor.getMinutes() + material.delay_minutes);

    // 5. Get the city name
    const cityName = (leader.office_cities as any)?.nome || "sua região";

    // 5.5. Shorten material URL using the production domain
    let shortenedUrl = material.material_url;
    try {
      console.log("[schedule-region-material] Shortening material URL...");
      const { data: shortenResult, error: shortenError } = await supabase.functions.invoke("shorten-url", {
        body: { url: material.material_url },
      });

      if (!shortenError && shortenResult?.shortUrl) {
        shortenedUrl = shortenResult.shortUrl;
        console.log(`[schedule-region-material] URL shortened: ${shortenedUrl}`);
      } else {
        console.warn("[schedule-region-material] Could not shorten URL, using original:", shortenError);
      }
    } catch (e) {
      console.warn("[schedule-region-material] Error shortening URL, using original:", e);
    }

    // 6. Create scheduled message
    const { error: insertError } = await supabase.from("scheduled_messages").insert({
      message_type: "sms",
      recipient_phone: leader.telefone,
      recipient_name: leader.nome_completo,
      template_slug: material.sms_template_slug || "material-regiao-sms",
      variables: {
        nome: leader.nome_completo,
        regiao: cityName,
        link_material: shortenedUrl,
      },
      scheduled_for: scheduledFor.toISOString(),
      leader_id: leader_id,
      status: "pending",
    });

    if (insertError) {
      console.error("[schedule-region-material] Error inserting scheduled message:", insertError);
      throw insertError;
    }

    console.log(`[schedule-region-material] Scheduled for ${scheduledFor.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: true,
        scheduled_for: scheduledFor.toISOString(),
        material_name: material.material_name,
        delay_minutes: material.delay_minutes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[schedule-region-material] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
