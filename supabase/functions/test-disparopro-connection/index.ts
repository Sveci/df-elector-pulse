import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestDisparoproRequest {
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: TestDisparoproRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[test-disparopro-connection] Testing Disparopro connection with Bearer token...");

    // Check balance to verify token is valid using Disparopro's HTTPS API
    const response = await fetch("https://apihttp.disparopro.com.br:8433/balance", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    console.log("[test-disparopro-connection] Disparopro response:", JSON.stringify(result));

    // Disparopro API returns status 200 on success with balance in the response
    if (response.ok && result.status === 200) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            connected: true,
            balance: result.detail?.balance || result.balance || 0,
            description: `Saldo disponível: ${result.detail?.balance || result.balance || 0} SMS`,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Check for authentication errors
      let errorMessage = "Erro de conexão com Disparopro";

      if (response.status === 401 || response.status === 403) {
        errorMessage = "Token inválido - verifique seu Bearer Token";
      } else if (result.detail || result.message) {
        errorMessage = result.detail || result.message;
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("[test-disparopro-connection] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
