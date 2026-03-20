import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestSMSBaratoRequest {
  apiKey: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey }: TestSMSBaratoRequest = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[test-smsbarato-connection] Testing SMSBarato connection...");

    // SMSBarato API - endpoint correto conforme documentação
    const endpoint = `https://sistema81.smsbarato.com.br/saldo?chave=${apiKey}`;

    console.log("[test-smsbarato-connection] Calling endpoint:", endpoint.replace(apiKey, '***'));

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Accept": "text/plain, */*",
      },
    });

    const result = await response.text();

    console.log("[test-smsbarato-connection] Response status:", response.status);
    console.log("[test-smsbarato-connection] Response:", result.substring(0, 200));

    // Check if response is HTML (404 page)
    if (result.includes("<!DOCTYPE html>") || result.includes("<html>")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Endpoint retornou página HTML (possível erro de servidor)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedResult = result.trim();

    // Código 900 = erro de autenticação
    if (trimmedResult === "900") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Erro de autenticação - API Key inválida (código 900)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retorno numérico positivo = saldo
    const balance = parseFloat(trimmedResult);

    if (!isNaN(balance) && balance >= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            connected: true,
            balance: balance,
            description: `Saldo disponível: ${balance} SMS`,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Outros códigos de erro
    return new Response(
      JSON.stringify({
        success: false,
        error: `Resposta inesperada da API: ${trimmedResult}`,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[test-smsbarato-connection] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
