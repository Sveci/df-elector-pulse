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

    console.log("Testing Z-API connection for instance:", instanceId);

    if (!instanceId || !token) {
      return new Response(
        JSON.stringify({ success: false, error: "Instance ID e Token são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;

    console.log("Calling Z-API status endpoint:", zapiUrl);

    const response = await fetch(zapiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken && { "Client-Token": clientToken }),
      },
    });

    const data = await response.json();
    console.log("Z-API response:", JSON.stringify(data));

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.error || "Erro ao conectar ao Z-API",
          status: response.status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If connected, fetch device info to get the phone number
    const isConnected = data.connected === true || data.status === "connected";
    let deviceData = null;

    if (isConnected) {
      try {
        const deviceUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/device`;
        console.log("Fetching device info:", deviceUrl);
        const deviceResponse = await fetch(deviceUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(clientToken && { "Client-Token": clientToken }),
          },
        });
        if (deviceResponse.ok) {
          deviceData = await deviceResponse.json();
          console.log("Device data:", JSON.stringify(deviceData));
        }
      } catch (e) {
        console.error("Error fetching device info:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...data,
          phone: deviceData?.phone || null,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error testing Z-API connection:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
