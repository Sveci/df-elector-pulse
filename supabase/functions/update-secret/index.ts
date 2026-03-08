import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated and is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas super admins." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { secretName, secretValue } = await req.json();

    // Validate allowed secret names
    const allowedSecrets = ["META_WA_ACCESS_TOKEN", "APIFY_API_TOKEN", "OPENAI_API_KEY", "RESEND_API_KEY", "SMSBARATO_API_KEY", "DISPAROPRO_TOKEN", "SMSDEV_API_KEY", "PASSKIT_API_TOKEN"];
    if (!allowedSecrets.includes(secretName)) {
      return new Response(JSON.stringify({ error: "Secret não permitido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!secretValue || typeof secretValue !== "string" || !secretValue.trim()) {
      return new Response(JSON.stringify({ error: "Valor do token é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store in Vault
    // First try to update existing secret, then insert if not found
    const { data: existing } = await supabase.rpc("read_secret", { secret_name: secretName }).single();

    if (existing) {
      await supabase.rpc("update_secret", {
        secret_name: secretName,
        new_secret: secretValue.trim(),
      });
    } else {
      await supabase.rpc("insert_secret", {
        name: secretName,
        secret: secretValue.trim(),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});