import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_client_token")
      .limit(1)
      .single();

    if (!settings?.zapi_instance_id || !settings?.zapi_token) {
      return new Response(JSON.stringify({ success: false, error: "Z-API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = `https://api.z-api.io/instances/${settings.zapi_instance_id}/token/${settings.zapi_token}/chats`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.zapi_client_token) {
      headers["Client-Token"] = settings.zapi_client_token;
    }

    const response = await fetch(url, { method: "GET", headers });
    const chats = await response.json();

    // Filter only groups
    const groups = (Array.isArray(chats) ? chats : []).filter(
      (chat: any) => chat.isGroup === true || chat.phone?.includes("@g.us") || chat.isGroup === "true"
    );

    const simplified = groups.map((g: any) => ({
      id: g.phone || g.id,
      name: g.name || g.title || "Sem nome",
      participants: g.participants?.length || null,
    }));

    console.log(`[list-zapi-groups] Found ${simplified.length} groups`);

    return new Response(JSON.stringify({ success: true, groups: simplified }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[list-zapi-groups] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
