import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEventPhotosRequest {
  eventId: string;
  photoUrl: string;
  sendSms: boolean;
  sendEmail: boolean;
}

// Replace template variables
function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value || "");
  }
  return result;
}

// Normalize phone number for SMS
function normalizePhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");

  if (clean.startsWith("55")) {
    clean = clean.substring(2);
  }

  // Add 9 for Brasília numbers if missing
  if (clean.length === 10 && clean.startsWith("61")) {
    clean = "61" + "9" + clean.substring(2);
  }

  return clean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-event-photos: Starting request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require valid JWT ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ── End Auth ─────────────────────────────────────────────────────────────

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { eventId, photoUrl, sendSms, sendEmail }: SendEventPhotosRequest = await req.json();

    // Resolve tenant from the authenticated user
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const tenantId = userTenant?.tenant_id || null;

    if (!eventId || !photoUrl) {
      return new Response(JSON.stringify({ error: "eventId e photoUrl são obrigatórios" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!sendSms && !sendEmail) {
      return new Response(JSON.stringify({ error: "Selecione pelo menos um canal de envio (SMS ou Email)" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("send-event-photos: Processing event:", eventId);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, slug")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      console.error("send-event-photos: Event not found:", eventError);
      return new Response(JSON.stringify({ error: "Evento não encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get organization info — tenant-scoped
    const orgQuery = supabase.from("organization").select("nome");
    if (tenantId) orgQuery.eq("tenant_id", tenantId);
    const { data: org } = await orgQuery.limit(1).maybeSingle();

    // Get participants who checked in
    const { data: participants, error: participantsError } = await supabase
      .from("event_registrations")
      .select("id, nome, email, whatsapp")
      .eq("event_id", eventId)
      .eq("checked_in", true);

    if (participantsError) {
      console.error("send-event-photos: Error fetching participants:", participantsError);
      throw participantsError;
    }

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum participante com check-in encontrado" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`send-event-photos: Found ${participants.length} participants with check-in`);

    // Shorten the photo URL
    let shortUrl = photoUrl;
    try {
      const shortenResponse = await supabase.functions.invoke("shorten-url", {
        body: { url: photoUrl },
      });

      if (shortenResponse.data?.shortUrl) {
        shortUrl = shortenResponse.data.shortUrl;
        console.log("send-event-photos: URL shortened to:", shortUrl);
      }
    } catch (shortenError) {
      console.warn("send-event-photos: Could not shorten URL, using original:", shortenError);
    }

    // Get integrations settings — tenant-scoped with global fallback
    let settings: any = null;
    if (tenantId) {
      const { data: tenantSettings } = await supabase
        .from("integrations_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      settings = tenantSettings;
    }
    // Fallback to global row
    if (!settings || !settings.resend_api_key) {
      const { data: globalSettings } = await supabase
        .from("integrations_settings")
        .select("*")
        .not("resend_api_key", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (globalSettings) {
        settings = { ...globalSettings, ...(settings || {}) };
      }
    }

    let smsSentCount = 0;
    let emailSentCount = 0;
    const errors: string[] = [];

    // Send SMS
    if (sendSms && settings?.smsdev_enabled && settings?.smsdev_api_key) {
      console.log("send-event-photos: Sending SMS...");

      // Get SMS template
      const { data: smsTemplate } = await supabase
        .from("sms_templates")
        .select("mensagem")
        .eq("slug", "evento-fotos-disponivel")
        .eq("is_active", true)
        .single();

      for (const participant of participants) {
        if (!participant.whatsapp) continue;

        try {
          const phone = normalizePhone(participant.whatsapp);
          const message = smsTemplate?.mensagem
            ? replaceVariables(smsTemplate.mensagem, {
                nome_evento: event.name,
                link_fotos: shortUrl,
              })
            : `Olá! 👋\nObrigado por participar do ${event.name}.\nAs fotos do evento já estão disponíveis:\n${shortUrl}`;

          // Call SMSDEV API
          const smsResponse = await fetch("https://api.smsdev.com.br/v1/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              key: settings.smsdev_api_key,
              type: 9,
              number: phone,
              msg: message,
            }),
          });

          const smsResult = await smsResponse.json();

          if (smsResult.situacao === "OK") {
            smsSentCount++;

            // Log the SMS
            await supabase.from("sms_messages").insert({
              phone: `+55${phone}`,
              message,
              status: "queued",
              message_id: smsResult.id?.toString(),
            });
          } else {
            console.warn(`send-event-photos: SMS failed for ${phone}:`, smsResult);
          }
        } catch (smsError: any) {
          console.error(`send-event-photos: SMS error for ${participant.whatsapp}:`, smsError);
          errors.push(`SMS para ${participant.whatsapp}: ${smsError.message}`);
        }
      }
    } else if (sendSms && (!settings?.smsdev_enabled || !settings?.smsdev_api_key)) {
      errors.push("SMS não configurado. Configure a integração SMSDEV nas configurações.");
    }

    // Send Email
    if (sendEmail && settings?.resend_enabled && settings?.resend_api_key) {
      console.log("send-event-photos: Sending emails...");

      const resend = new Resend(settings.resend_api_key);

      // Get email template
      const { data: emailTemplate } = await supabase
        .from("email_templates")
        .select("assunto, conteudo_html")
        .eq("slug", "evento-fotos-disponivel")
        .eq("is_active", true)
        .single();

      const fromEmail = settings.resend_from_email || "onboarding@resend.dev";
      const fromName = settings.resend_from_name || org?.nome || "Eventos";

      for (const participant of participants) {
        if (!participant.email) continue;

        try {
          const subject = emailTemplate?.assunto
            ? replaceVariables(emailTemplate.assunto, { nome_evento: event.name })
            : `Obrigado por participar do ${event.name}! Confira as fotos 📸`;

          const html = emailTemplate?.conteudo_html
            ? replaceVariables(emailTemplate.conteudo_html, {
                nome_evento: event.name,
                link_fotos: photoUrl, // Use full URL for email
                nome_organizacao: org?.nome || "",
              })
            : `<p>Olá,</p><p>As fotos do ${event.name} estão disponíveis!</p><p><a href="${photoUrl}">Ver fotos</a></p>`;

          const emailResult = await resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: [participant.email],
            subject,
            html,
          });

          if (emailResult.data?.id) {
            emailSentCount++;

            // Log the email
            await supabase.from("email_logs").insert({
              to_email: participant.email,
              to_name: participant.nome,
              subject,
              status: "sent",
              resend_id: emailResult.data.id,
              event_id: eventId,
              sent_at: new Date().toISOString(),
            });
          }
        } catch (emailError: any) {
          console.error(`send-event-photos: Email error for ${participant.email}:`, emailError);
          errors.push(`Email para ${participant.email}: ${emailError.message}`);
        }
      }
    } else if (sendEmail && (!settings?.resend_enabled || !settings?.resend_api_key)) {
      errors.push("Email não configurado. Configure a integração Resend nas configurações.");
    }

    // Save the photo link record
    const { error: saveError } = await supabase.from("event_photo_links").insert({
      event_id: eventId,
      photo_url: photoUrl,
      short_code: shortUrl.includes("/s/") ? shortUrl.split("/s/")[1] : null,
      sms_sent: smsSentCount > 0,
      email_sent: emailSentCount > 0,
      sms_recipients_count: smsSentCount,
      email_recipients_count: emailSentCount,
      sent_at: new Date().toISOString(),
    });

    if (saveError) {
      console.error("send-event-photos: Error saving photo link record:", saveError);
    }

    console.log(`send-event-photos: Completed. SMS: ${smsSentCount}, Email: ${emailSentCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        smsSent: smsSentCount,
        emailSent: emailSentCount,
        totalParticipants: participants.length,
        shortUrl,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("send-event-photos: Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
