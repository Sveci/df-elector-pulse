// manage-custom-domain v3 - SaaSCustomDomains.com integration (upstream path fix)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCD_API_BASE = "https://app.saascustomdomains.com/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const scdApiKey = Deno.env.get("SAAS_CUSTOM_DOMAINS_API_KEY");
    const scdAccountUuid = Deno.env.get("SCD_ACCOUNT_UUID");
    const scdUpstreamUuid = Deno.env.get("SCD_UPSTREAM_UUID");

    console.log(`SCD Config - Account: "${scdAccountUuid}", Upstream: "${scdUpstreamUuid}", API Key present: ${!!scdApiKey}`);

    if (!scdApiKey || !scdAccountUuid || !scdUpstreamUuid) {
      return new Response(
        JSON.stringify({ error: "SaaSCustomDomains não configurado. Verifique os secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
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

    const { action, tenant_id, domain } = await req.json();

    // Helper to call SCD API
    const scdFetch = async (method: string, path: string, body?: unknown) => {
      const url = `${SCD_API_BASE}${path}`;
      console.log(`SCD API ${method} ${url}`);
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${scdApiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      console.log(`SCD API response ${res.status}: ${text.substring(0, 500)}`);
      
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`SCD API returned non-JSON (${res.status}): ${text.substring(0, 200)}`);
      }
      
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `SCD API error: ${res.status}`);
      }
      return data;
    };

    if (action === "register") {
      // Register a new domain on SaaSCustomDomains
      if (!domain || !tenant_id) {
        return new Response(JSON.stringify({ error: "domain e tenant_id são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Clean domain (remove protocol)
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");

      // Check if tenant already has an SCD domain registered
      const { data: tenant } = await supabase
        .from("tenants")
        .select("scd_domain_uuid")
        .eq("id", tenant_id)
        .single();

      // If already registered, delete old one first
      if (tenant?.scd_domain_uuid) {
        try {
          await scdFetch("DELETE", `/accounts/${scdAccountUuid}/upstreams/${scdUpstreamUuid}/custom_domains/${tenant.scd_domain_uuid}`);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.log("Could not delete old SCD domain, continuing:", message);
        }
      }
...
  } catch (err) {
    console.error("manage-custom-domain error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
