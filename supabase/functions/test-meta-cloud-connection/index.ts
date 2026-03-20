import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestMetaCloudRequest {
  phoneNumberId?: string;
  wabaId?: string;
  apiVersion?: string;
  action?: 'test' | 'list-templates';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"])
      .limit(1)
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso não autorizado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phoneNumberId, wabaId, apiVersion = "v20.0", action = "test" }: TestMetaCloudRequest = await req.json();

    // Get access token from environment
    const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "META_WA_ACCESS_TOKEN não está configurado nos secrets do ambiente"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List templates action
    if (action === "list-templates") {
      if (!wabaId) {
        return new Response(
          JSON.stringify({ success: false, error: "WABA ID é obrigatório para listar templates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[test-meta-cloud] Listing templates for WABA ${wabaId}`);

      const templatesUrl = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`;

      const response = await fetch(templatesUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[test-meta-cloud] Templates error:", data);
        return new Response(
          JSON.stringify({
            success: false,
            error: data.error?.message || "Erro ao listar templates",
            details: data.error
          }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[test-meta-cloud] Templates found:", data.data?.length || 0);

      return new Response(
        JSON.stringify({
          success: true,
          templates: data.data || []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default test connection action
    if (!phoneNumberId) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone Number ID é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[test-meta-cloud] Testing connection to Graph API ${apiVersion}/${phoneNumberId}`);

    // Test connection by getting phone number info
    const graphUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

    const response = await fetch(graphUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[test-meta-cloud] Error:", data);
      return new Response(
        JSON.stringify({
          success: false,
          error: data.error?.message || "Erro ao conectar com a Graph API",
          details: data.error
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[test-meta-cloud] Connection successful:", data);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          phoneNumberId: data.id,
          displayPhoneNumber: data.display_phone_number,
          verifiedName: data.verified_name,
          qualityRating: data.quality_rating,
          platformType: data.platform_type,
          accountMode: data.account_mode,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test-meta-cloud] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
