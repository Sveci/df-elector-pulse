import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, token, clientToken } = await req.json();

    console.log("[get-zapi-qrcode] Checking connection status for instance:", instanceId);

    if (!instanceId || !token) {
      return new Response(
        JSON.stringify({ success: false, error: "Instance ID e Token são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, check connection status
    const statusUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;

    console.log("[get-zapi-qrcode] Calling Z-API status endpoint:", statusUrl);

    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken && { "Client-Token": clientToken }),
      },
    });

    const statusData = await statusResponse.json();
    console.log("[get-zapi-qrcode] Status response:", JSON.stringify(statusData));

    // Check if already connected
    const isConnected = statusData.connected === true ||
                        statusData.status === "connected" ||
                        statusData.smartphoneConnected === true;

    if (isConnected) {
      console.log("[get-zapi-qrcode] WhatsApp is already connected");
      return new Response(
        JSON.stringify({ success: true, connected: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If disconnected, get QR Code
    console.log("[get-zapi-qrcode] WhatsApp disconnected, fetching QR Code...");

    const qrUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`;

    const qrResponse = await fetch(qrUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken && { "Client-Token": clientToken }),
      },
    });

    const qrData = await qrResponse.json();
    console.log("[get-zapi-qrcode] QR Code response received, has value:", !!qrData.value);

    if (!qrResponse.ok || !qrData.value) {
      console.error("[get-zapi-qrcode] Failed to get QR Code:", qrData);
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: qrData.error || "Não foi possível obter o QR Code. Verifique as credenciais."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        connected: false,
        qrcode: qrData.value // Base64 image
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[get-zapi-qrcode] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
