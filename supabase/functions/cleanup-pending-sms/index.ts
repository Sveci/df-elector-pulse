import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[cleanup-pending-sms] Starting cleanup of orphaned pending messages...");

    // Find messages that are stuck in pending status without a message_id
    // and were created more than 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: orphanedMessages, error: fetchError } = await supabase
      .from("sms_messages")
      .select("id, phone, message, created_at")
      .eq("status", "pending")
      .is("message_id", null)
      .lt("created_at", tenMinutesAgo)
      .eq("direction", "outgoing");

    if (fetchError) {
      console.error("[cleanup-pending-sms] Error fetching orphaned messages:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cleanup-pending-sms] Found ${orphanedMessages?.length || 0} orphaned messages`);

    if (!orphanedMessages || orphanedMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhuma mensagem órfã encontrada",
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark all orphaned messages as failed
    const orphanedIds = orphanedMessages.map(m => m.id);

    const { error: updateError } = await supabase
      .from("sms_messages")
      .update({
        status: "failed",
        error_message: "Timeout: mensagem não foi processada pela API SMSDEV",
      })
      .in("id", orphanedIds);

    if (updateError) {
      console.error("[cleanup-pending-sms] Error updating orphaned messages:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[cleanup-pending-sms] Successfully marked ${orphanedIds.length} messages as failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${orphanedIds.length} mensagens órfãs marcadas como falha`,
        processed: orphanedIds.length,
        ids: orphanedIds,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[cleanup-pending-sms] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
