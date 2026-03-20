import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledMessage {
  id: string;
  message_type: "sms" | "email" | "whatsapp";
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  template_slug: string;
  variables: Record<string, string>;
  contact_id: string | null;
  leader_id: string | null;
  tenant_id: string | null;
}

function isQuietHours(
  settings: {
    quiet_hours_enabled: boolean | null;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
  } | null,
): boolean {
  if (!settings?.quiet_hours_enabled) return false;
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  const startHour = parseInt((settings.quiet_hours_start || "21:00").split(":")[0]);
  const endHour = parseInt((settings.quiet_hours_end || "08:00").split(":")[0]);
  if (startHour > endHour) {
    return brasiliaHour >= startHour || brasiliaHour < endHour;
  }
  return brasiliaHour >= startHour && brasiliaHour < endHour;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar horário de silêncio — usa a primeira linha encontrada como referência global
    // (quiet hours é uma configuração operacional compartilhada)
    const { data: qhSettings } = await supabase
      .from("integrations_settings")
      .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
      .not("quiet_hours_enabled", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (isQuietHours(qhSettings)) {
      console.log("[process-scheduled-messages] Horário de silêncio ativo. Pulando execução.");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "quiet_hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[process-scheduled-messages] Starting processing...");

    // Get pending messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("[process-scheduled-messages] Error fetching messages:", fetchError);
      throw fetchError;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log("[process-scheduled-messages] No pending messages to process");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-scheduled-messages] Found ${pendingMessages.length} messages to process`);

    let processed = 0;
    let failed = 0;

    for (const message of pendingMessages as ScheduledMessage[]) {
      try {
        // Mark as processing
        await supabase.from("scheduled_messages").update({ status: "processing" }).eq("id", message.id);

        console.log(`[process-scheduled-messages] Processing message ${message.id} (${message.message_type})`);

        let sendResult: { success: boolean; error?: string } = { success: false };

        if (message.message_type === "sms") {
          const { data, error } = await supabase.functions.invoke("send-sms", {
            body: {
              phone: message.recipient_phone,
              templateSlug: message.template_slug,
              variables: message.variables,
              contactId: message.contact_id,
              tenantId: (message as any).tenant_id || undefined,
            },
          });

          if (error) {
            sendResult = { success: false, error: error.message };
          } else {
            sendResult = { success: data?.success || false, error: data?.error };
          }
        } else if (message.message_type === "email") {
          const { data, error } = await supabase.functions.invoke("send-email", {
            body: {
              to: message.recipient_email,
              toName: message.recipient_name,
              templateSlug: message.template_slug,
              variables: message.variables,
              contactId: message.contact_id,
              leaderId: message.leader_id,
              // Pass tenant_id so send-email uses the correct Resend settings
              tenantId: (message as any).tenant_id || undefined,
            },
          });

          if (error) {
            sendResult = { success: false, error: error.message };
          } else {
            sendResult = { success: data?.success || false, error: data?.error };
          }
        } else if (message.message_type === "whatsapp") {
          const { data, error } = await supabase.functions.invoke("send-whatsapp", {
            body: {
              phone: message.recipient_phone,
              templateSlug: message.template_slug,
              variables: message.variables,
              contactId: message.contact_id,
              tenantId: (message as any).tenant_id || undefined,
            },
          });

          if (error) {
            sendResult = { success: false, error: error.message };
          } else {
            sendResult = { success: data?.success || false, error: data?.error };
          }
        }

        if (sendResult.success) {
          await supabase
            .from("scheduled_messages")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", message.id);
          processed++;
          console.log(`[process-scheduled-messages] Message ${message.id} sent successfully`);
        } else {
          await supabase
            .from("scheduled_messages")
            .update({ status: "failed", error_message: sendResult.error || "Unknown error" })
            .eq("id", message.id);
          failed++;
          console.error(`[process-scheduled-messages] Message ${message.id} failed:`, sendResult.error);
        }

        // Add a small delay between messages to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[process-scheduled-messages] Error processing message ${message.id}:`, err);
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed", error_message: errorMessage })
          .eq("id", message.id);
        failed++;
      }
    }

    console.log(`[process-scheduled-messages] Completed. Processed: ${processed}, Failed: ${failed}`);

    return new Response(JSON.stringify({ success: true, processed, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[process-scheduled-messages] Error:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
