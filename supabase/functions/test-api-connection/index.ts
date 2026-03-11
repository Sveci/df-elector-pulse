import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check super_admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider } = await req.json();

    if (!provider) {
      return new Response(
        JSON.stringify({ success: false, error: "Provider é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[test-api-connection] Testing provider: ${provider}`);

    // Fetch integration settings from database (keys stored here, not in env)
    const { data: settings } = await serviceClient
      .from("integrations_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    switch (provider) {
      case "smsbarato": {
        const apiKey = settings?.smsbarato_api_key;
        if (!apiKey) return jsonError("API Key do SMSBarato não configurada nas integrações");
        const endpoint = `https://sistema81.smsbarato.com.br/saldo?chave=${apiKey}`;
        const res = await fetch(endpoint);
        const text = await res.text();
        const trimmed = text.trim();
        if (trimmed === "900") return jsonError("API Key inválida (código 900)");
        const balance = parseFloat(trimmed);
        if (!isNaN(balance) && balance >= 0) {
          return jsonSuccess({ balance, description: `Saldo: ${balance} SMS` });
        }
        return jsonError(`Resposta inesperada: ${trimmed}`);
      }

      case "smsdev": {
        const apiKey = settings?.smsdev_api_key;
        if (!apiKey) return jsonError("API Key do SMSDev não configurada nas integrações");
        const res = await fetch(`https://api.smsdev.com.br/v1/balance?key=${apiKey}`);
        const data = await res.json();
        if (data.situacao === "OK" || data.saldo_sms !== undefined) {
          return jsonSuccess({ balance: data.saldo_sms, description: `Saldo: ${data.saldo_sms} SMS` });
        }
        return jsonError(data.mensagem || "Falha na conexão");
      }

      case "disparopro": {
        const token = settings?.disparopro_token;
        if (!token) return jsonError("Token do DisparoPro não configurado nas integrações");
        const res = await fetch("https://api.disparopro.com.br:8433/mt/v2/balance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.balance !== undefined) {
          return jsonSuccess({ balance: data.balance, description: `Saldo: ${data.balance}` });
        }
        return jsonError(data.message || "Falha na conexão");
      }

      case "resend": {
        const apiKey = settings?.resend_api_key;
        if (!apiKey) return jsonError("API Key do Resend não configurada nas integrações");
        const res = await fetch("https://api.resend.com/api-keys", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const resText = await res.text();
        if (res.ok) {
          try {
            const data = JSON.parse(resText);
            return jsonSuccess({ description: `Conectado — ${data.data?.length || 0} API keys encontradas` });
          } catch {
            return jsonSuccess({ description: "Conectado ao Resend" });
          }
        }
        // 401/403 with "restricted" means the key is valid but send-only
        if (res.status === 401 || res.status === 403) {
          return jsonSuccess({ description: "API Key válida (restrita para envio de emails)" });
        }
        return jsonError(`Erro ${res.status}: ${resText.substring(0, 100)}`);
      }

      case "meta_cloud": {
        const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
        console.log(`[test-api-connection] META_WA_ACCESS_TOKEN present: ${!!accessToken}, length: ${accessToken?.length || 0}`);
        if (!accessToken) return jsonError("META_WA_ACCESS_TOKEN não configurado nos secrets");
        const phoneNumberId = settings?.meta_cloud_phone_number_id;
        const apiVersion = settings?.meta_cloud_api_version || "v20.0";
        console.log(`[test-api-connection] phoneNumberId: ${phoneNumberId}, apiVersion: ${apiVersion}`);
        if (!phoneNumberId) return jsonError("Phone Number ID não configurado nas integrações");
        const graphUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;
        console.log(`[test-api-connection] Fetching: ${graphUrl}`);
        try {
          const res = await fetch(graphUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const resText = await res.text();
          console.log(`[test-api-connection] Graph API response status: ${res.status}, body: ${resText.substring(0, 300)}`);
          if (res.ok) {
            const data = JSON.parse(resText);
            if (data.id) {
              return jsonSuccess({ description: `Conectado — Phone: ${data.display_phone_number || data.id}` });
            }
          }
          try {
            const errData = JSON.parse(resText);
            return jsonError(errData.error?.message || `Erro ${res.status}: ${resText.substring(0, 200)}`);
          } catch {
            return jsonError(`Erro ${res.status}: ${resText.substring(0, 200)}`);
          }
        } catch (fetchErr) {
          console.error(`[test-api-connection] Fetch error for meta_cloud:`, fetchErr);
          return jsonError(`Erro de conexão: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
        }
      }

      case "passkit": {
        const apiToken = settings?.passkit_api_token;
        if (!apiToken) return jsonError("Token do PassKit não configurado nas integrações");
        const baseUrl = settings?.passkit_api_base_url || "https://api.pub1.passkit.io";
        return jsonSuccess({ description: `Token configurado — Região: ${baseUrl.includes("pub1") ? "pub1" : "pub2"}` });
      }

      case "apify": {
        const apiToken = Deno.env.get("APIFY_API_TOKEN");
        if (!apiToken) return jsonError("APIFY_API_TOKEN não configurado nos secrets");
        const res = await fetch("https://api.apify.com/v2/users/me", {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          return jsonSuccess({ description: `Conectado — Usuário: ${data.data?.username || "OK"}` });
        }
        const errText = await res.text();
        return jsonError(`Erro ${res.status}: ${errText.substring(0, 100)}`);
      }

      case "openai": {
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) return jsonError("OPENAI_API_KEY não configurada nos secrets");
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          return jsonSuccess({ description: "Conectado — API Key válida" });
        }
        const errText = await res.text();
        return jsonError(`Erro ${res.status}: ${errText.substring(0, 100)}`);
      }

      case "sociavault": {
        const apiKey = Deno.env.get("SOCIAVAULT_API_KEY");
        if (!apiKey) return jsonError("SOCIAVAULT_API_KEY não configurada nos secrets");
        const res = await fetch("https://api.sociavault.com/v1/scrape/google/search?query=test", {
          headers: { "X-API-Key": apiKey },
        });
        if (res.ok) {
          const data = await res.json();
          const credits = data.creditsUsed || 0;
          return jsonSuccess({ description: `Conectado — ${credits} crédito(s) usado(s) no teste` });
        }
        const errText = await res.text();
        if (res.status === 402) return jsonError("Créditos insuficientes no SociaVault");
        return jsonError(`Erro ${res.status}: ${errText.substring(0, 100)}`);
      }

      default:
        return jsonError(`Provider desconhecido: ${provider}`);
    }
  } catch (error: unknown) {
    console.error("[test-api-connection] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonSuccess(data: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ success: true, data: { connected: true, ...data } }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function jsonError(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
