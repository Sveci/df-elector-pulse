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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { eventId, tenantId, registrationIds } = await req.json();

    if (!eventId || !tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "eventId e tenantId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get integration settings for the tenant
    const { data: intSettings } = await supabase
      .from("integrations_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (!intSettings) {
      return new Response(
        JSON.stringify({ success: false, error: "Configurações de integração não encontradas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get registrations with QR codes
    let query = supabase
      .from("event_registrations")
      .select("id, nome, whatsapp, qr_code")
      .eq("event_id", eventId)
      .eq("tenant_id", tenantId)
      .not("qr_code", "is", null);

    if (registrationIds && registrationIds.length > 0) {
      query = query.in("id", registrationIds);
    }

    const { data: registrations, error: regError } = await query;

    if (regError) {
      console.error("[resend-qrcodes] Error fetching registrations:", regError);
      return new Response(
        JSON.stringify({ success: false, error: regError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!registrations || registrations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "Nenhuma inscrição encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://app.eleitor360.ai";
    const metaAccessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
    const useMetaCloud = intSettings.whatsapp_provider_active === 'meta_cloud' ||
      (intSettings.meta_cloud_enabled && !intSettings.zapi_enabled);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const reg of registrations) {
      if (!reg.qr_code || !reg.whatsapp) continue;

      const checkInUrl = `${baseUrl}/checkin/${reg.qr_code}`;
      const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkInUrl)}`;

      let cleanPhone = reg.whatsapp.replace(/[^0-9]/g, "");
      if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
        cleanPhone = "55" + cleanPhone;
      }

      let imageSent = false;

      try {
        if (useMetaCloud && metaAccessToken && intSettings.meta_cloud_phone_number_id) {
          const apiVersion = intSettings.meta_cloud_api_version || "v20.0";
          const graphUrl = `https://graph.facebook.com/${apiVersion}/${intSettings.meta_cloud_phone_number_id}/messages`;

          const metaRes = await fetch(graphUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${metaAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: cleanPhone,
              type: "image",
              image: {
                link: qrCodeImageUrl,
                caption: `🎫 QR Code de Check-in\n👤 ${reg.nome}\n\nApresente este QR Code na entrada do evento.`,
              },
            }),
          });
          const metaResBody = await metaRes.text();
          if (metaRes.ok) {
            imageSent = true;
            console.log(`[resend-qrcodes] QR sent to ${cleanPhone}: OK`);
          } else {
            console.error(`[resend-qrcodes] Meta failed for ${cleanPhone}:`, metaRes.status, metaResBody);
          }
        } else if (intSettings.zapi_enabled && intSettings.zapi_instance_id && intSettings.zapi_token) {
          const zapiImageUrl = `https://api.z-api.io/instances/${intSettings.zapi_instance_id}/token/${intSettings.zapi_token}/send-image`;
          const zapiRes = await fetch(zapiImageUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(intSettings.zapi_client_token && { "Client-Token": intSettings.zapi_client_token }),
            },
            body: JSON.stringify({
              phone: cleanPhone,
              image: qrCodeImageUrl,
              caption: `🎫 QR Code de Check-in\n👤 ${reg.nome}\n\nApresente este QR Code na entrada do evento.`,
            }),
          });
          const zapiResText = await zapiRes.text();
          if (zapiRes.ok) {
            imageSent = true;
            console.log(`[resend-qrcodes] QR sent to ${cleanPhone} via Z-API: OK`);
          } else {
            console.error(`[resend-qrcodes] Z-API failed for ${cleanPhone}:`, zapiRes.status, zapiResText);
          }
        }

        if (imageSent) {
          sent++;
        } else {
          failed++;
          errors.push(`${reg.nome} (${reg.whatsapp})`);
        }
      } catch (err) {
        console.error(`[resend-qrcodes] Error for ${cleanPhone}:`, err);
        failed++;
        errors.push(`${reg.nome} (${reg.whatsapp}): ${(err as Error).message}`);
      }

      // Rate limiting: wait 1 second between sends
      if (registrations.indexOf(reg) < registrations.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: registrations.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[resend-qrcodes] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
