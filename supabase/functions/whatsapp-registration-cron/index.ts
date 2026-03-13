import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// CRON: Proactive registration invite after 30 minutes
// =====================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find sessions where:
    // - 30+ minutes have passed since first message
    // - No registration state yet (never asked)
    // - Not completed
    // - User is NOT a registered leader
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: pendingSessions, error: sessError } = await supabase
      .from("whatsapp_chatbot_sessions")
      .select("*")
      .is("registration_state", null)
      .is("registration_completed_at", null)
      .lte("first_message_at", thirtyMinAgo)
      .limit(50);

    if (sessError) {
      console.error("[registration-cron] Error fetching sessions:", sessError);
      return new Response(JSON.stringify({ error: sessError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingSessions || pendingSessions.length === 0) {
      console.log("[registration-cron] No pending sessions to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[registration-cron] Found ${pendingSessions.length} sessions to process`);

    let sent = 0;
    let skipped = 0;

    for (const session of pendingSessions) {
      try {
        // Check if this phone belongs to a registered leader (skip if yes)
        const phoneVariants = [session.phone];
        const withoutPlus = session.phone.replace(/^\+/, "");
        if (withoutPlus !== session.phone) phoneVariants.push(withoutPlus);

        const { data: leader } = await supabase
          .from("lideres")
          .select("id")
          .or(phoneVariants.map(p => `telefone.eq.${p}`).join(","))
          .eq("is_active", true)
          .eq("tenant_id", session.tenant_id)
          .limit(1)
          .maybeSingle();

        if (leader) {
          // Mark as skipped so we don't check again
          await supabase
            .from("whatsapp_chatbot_sessions")
            .update({ registration_state: "skipped_leader", registration_completed_at: new Date().toISOString() })
            .eq("id", session.id);
          skipped++;
          continue;
        }

        // Check if already a contact
        const { data: existingContact } = await supabase
          .from("office_contacts")
          .select("id")
          .eq("telefone_norm", session.phone)
          .eq("tenant_id", session.tenant_id)
          .maybeSingle();

        if (existingContact) {
          await supabase
            .from("whatsapp_chatbot_sessions")
            .update({ registration_state: "skipped_existing", registration_completed_at: new Date().toISOString() })
            .eq("id", session.id);
          skipped++;
          continue;
        }

        // Get integration settings for this tenant
        const { data: intSettings } = await supabase
          .from("integrations_settings")
          .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_api_version, whatsapp_provider_active")
          .eq("tenant_id", session.tenant_id)
          .limit(1)
          .single();

        if (!intSettings) {
          console.log(`[registration-cron] No integration settings for tenant ${session.tenant_id}`);
          continue;
        }

        const regInviteMsg = `Que bom que você está por aqui! 😊\n\nGostaria de se cadastrar para ficar por dentro de mais notícias, informações e ações que podem te ajudar e beneficiar?\n\nResponda *SIM* para se cadastrar! ✅`;

        // Send via configured provider
        let messageSent = false;
        const useMetaCloud = intSettings.whatsapp_provider_active === "meta_cloud";

        if (useMetaCloud && intSettings.meta_cloud_enabled && intSettings.meta_cloud_phone_number_id) {
          const metaAccessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
          if (metaAccessToken) {
            messageSent = await sendWhatsAppMessageMetaCloud(
              intSettings.meta_cloud_phone_number_id,
              intSettings.meta_cloud_api_version || "v20.0",
              metaAccessToken,
              session.phone,
              regInviteMsg,
              supabase
            );
          }
        }

        if (!messageSent && intSettings.zapi_enabled && intSettings.zapi_instance_id && intSettings.zapi_token) {
          messageSent = await sendWhatsAppMessage(
            intSettings.zapi_instance_id,
            intSettings.zapi_token,
            intSettings.zapi_client_token,
            session.phone,
            regInviteMsg
          );
        }

        if (messageSent) {
          await supabase
            .from("whatsapp_chatbot_sessions")
            .update({
              registration_state: "awaiting_confirmation",
              registration_asked_at: new Date().toISOString(),
            })
            .eq("id", session.id);

          await supabase.from("whatsapp_chatbot_logs").insert({
            leader_id: null,
            phone: session.phone,
            message_in: "[cron-auto-trigger-30min]",
            message_out: regInviteMsg,
            keyword_matched: null,
            response_type: "registration_invite",
            processing_time_ms: 0,
            tenant_id: session.tenant_id,
          });

          sent++;
          console.log(`[registration-cron] Sent registration invite to ${session.phone}`);
        } else {
          console.log(`[registration-cron] Failed to send to ${session.phone} - no provider available`);
        }
      } catch (err) {
        console.error(`[registration-cron] Error processing session ${session.id}:`, err);
      }
    }

    console.log(`[registration-cron] Done: ${sent} sent, ${skipped} skipped`);
    return new Response(
      JSON.stringify({ processed: pendingSessions.length, sent, skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[registration-cron] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Send WhatsApp message via Z-API
async function sendWhatsAppMessage(
  instanceId: string,
  token: string,
  clientToken: string | null,
  phone: string,
  message: string
): Promise<boolean> {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  try {
    const response = await fetch(zapiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: cleanPhone, message }),
    });

    if (!response.ok) {
      console.error("[registration-cron] Z-API error:", await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[registration-cron] Z-API send error:", err);
    return false;
  }
}

// Send WhatsApp message via Meta Cloud API
async function sendWhatsAppMessageMetaCloud(
  phoneNumberId: string,
  apiVersion: string,
  accessToken: string,
  phone: string,
  message: string,
  supabase?: any
): Promise<boolean> {
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    cleanPhone = "55" + cleanPhone;
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      }),
    });

    if (!response.ok) {
      console.error("[registration-cron] Meta Cloud error:", await response.text());
      return false;
    }

    const result = await response.json();
    console.log("[registration-cron] Meta Cloud sent:", result.messages?.[0]?.id);

    if (supabase) {
      await supabase.from("whatsapp_messages").insert({
        phone: cleanPhone,
        message,
        direction: "outgoing",
        status: "sent",
        provider: "meta_cloud",
        metadata: { wamid: result.messages?.[0]?.id },
      });
    }

    return true;
  } catch (err) {
    console.error("[registration-cron] Meta Cloud send error:", err);
    return false;
  }
}
