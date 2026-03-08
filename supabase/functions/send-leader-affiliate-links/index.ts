import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Leader {
  id: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  affiliate_token: string;
  verification_method: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let leaderId: string | null = null;
    let leaderIds: string[] | null = null;

    try {
      const body = await req.json();
      leaderId = body?.leader_id || null;
      leaderIds = body?.leader_ids || null;
    } catch {
      // No body provided
    }

    console.log(`[send-leader-affiliate-links] Mode: ${leaderId ? 'single leader: ' + leaderId : leaderIds ? 'batch: ' + leaderIds.length + ' leaders' : 'batch processing (disabled)'}`);

    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://df-elector-pulse.lovable.app";

    // If specific leader_id provided, process just that leader
    if (leaderId) {
      const result = await processLeader(supabase, leaderId, baseUrl);
      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If leader_ids array provided, process in background and return immediately
    if (leaderIds && leaderIds.length > 0) {
      console.log(`[send-leader-affiliate-links] Starting background batch of ${leaderIds.length} leaders`);
      
      const backgroundTask = async () => {
        let successCount = 0;
        let errorCount = 0;
        for (const lid of leaderIds!) {
          try {
            const result = await processLeader(supabase, lid, baseUrl);
            if (result.sms_sent || result.whatsapp_sent || result.email_sent) {
              successCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (e) {
            errorCount++;
            console.error(`[send-leader-affiliate-links] Error processing ${lid}:`, e);
          }
        }
        console.log(`[send-leader-affiliate-links] Background batch done. Success: ${successCount}, Errors: ${errorCount}`);
      };

      EdgeRuntime.waitUntil(backgroundTask());

      return new Response(
        JSON.stringify({ success: true, message: `Processing ${leaderIds.length} leaders in background`, total: leaderIds.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generic batch processing: DISABLED
    return new Response(
      JSON.stringify({
        success: true,
        message: "Batch processing disabled (use leader_id or leader_ids)",
        processed: 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    const results = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const leader of recentLeaders) {
      if (!leader.telefone && !leader.email) {
        console.log(`[send-leader-affiliate-links] Skipping ${leader.nome_completo}: no contact info`);
        skippedCount++;
        continue;
      }

      const phoneNormalized = leader.telefone?.replace(/\D/g, "").slice(-8) || "";
      // Check for both 'whatsapp_consent' (new flow) and 'whatsapp' (legacy flow)
      const isWhatsAppVerification = leader.verification_method === 'whatsapp_consent' || leader.verification_method === 'whatsapp';

      // Check if welcome SMS already sent for this leader
      const { data: existingSMS } = await supabase
        .from("sms_messages")
        .select("id")
        .or(`message.ilike.%link de indicacao%,message.ilike.%cadastro confirmado%,message.ilike.%indicar pessoas%`)
        .ilike("phone", `%${phoneNormalized}`)
        .limit(1);

      // Check if WhatsApp with affiliate link already sent
      // Note: Search for key phrases that appear in the welcome message template
      const { data: existingWhatsApp } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .or(`message.ilike.%Seu link de indica%,message.ilike.%rede de lideranças%,message.ilike.%/cadastro/%`)
        .ilike("phone", `%${phoneNormalized}`)
        .eq("direction", "outgoing")
        .limit(1);

      // Check if ANY email already sent/attempted for this leader
      const { data: existingEmail } = await supabase
        .from("email_logs")
        .select("id")
        .eq("leader_id", leader.id)
        .limit(1);

      const hasSMS = existingSMS && existingSMS.length > 0;
      const hasWhatsApp = existingWhatsApp && existingWhatsApp.length > 0;
      const hasEmail = existingEmail && existingEmail.length > 0;

      // Determine what channels need to be sent based on verification method
      let skipSMS = hasSMS;
      let skipWhatsApp = hasWhatsApp;
      const skipEmail = hasEmail;

      // If verified via WhatsApp, we use WhatsApp channel (not SMS)
      // If verified via other methods, we use SMS channel (not WhatsApp)
      if (isWhatsAppVerification) {
        skipSMS = true; // Never send SMS for WhatsApp verifications
        // Check if both WhatsApp AND Email were already sent
        if (hasWhatsApp && hasEmail) {
          console.log(`[send-leader-affiliate-links] Skipping ${leader.nome_completo}: already has WhatsApp and Email (WhatsApp verification)`);
          skippedCount++;
          continue;
        }
      } else {
        skipWhatsApp = true; // Never send WhatsApp for non-WhatsApp verifications
        // Check if both SMS AND Email were already sent
        if (hasSMS && hasEmail) {
          console.log(`[send-leader-affiliate-links] Skipping ${leader.nome_completo}: already has SMS and Email`);
          skippedCount++;
          continue;
        }
      }

      // Process to send missing channels
      const result = await processLeader(
        supabase,
        leader.id,
        baseUrl,
        leader as Leader,
        skipSMS,
        skipEmail,
        skipWhatsApp
      );
      results.push(result);
      processedCount++;

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[send-leader-affiliate-links] Done. Processed: ${processedCount}, Skipped: ${skippedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        total: recentLeaders.length,
        results: results.slice(0, 5),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-leader-affiliate-links] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processLeader(
  supabase: any,
  leaderId: string,
  baseUrl: string,
  leaderData?: Leader,
  skipSMS: boolean = false,
  skipEmail: boolean = false,
  skipWhatsApp: boolean = false
): Promise<{ leader_id: string; nome: string; sms_sent: boolean; email_sent: boolean; whatsapp_sent: boolean; errors: string[] }> {
  const errors: string[] = [];

  let leader = leaderData;
  if (!leader) {
    const { data, error } = await supabase
      .from("lideres")
      .select("id, nome_completo, telefone, email, affiliate_token, verification_method")
      .eq("id", leaderId)
      .single();

    if (error || !data) {
      console.error(`[processLeader] Failed to fetch leader ${leaderId}:`, error);
      return { leader_id: leaderId, nome: "Unknown", sms_sent: false, email_sent: false, whatsapp_sent: false, errors: ["Leader not found"] };
    }
    leader = data as Leader;
  }

  // Check for both 'whatsapp_consent' (new flow) and 'whatsapp' (legacy flow)
  const isWhatsAppVerification = leader.verification_method === 'whatsapp_consent' || leader.verification_method === 'whatsapp';
  
  console.log(`[processLeader] Processing: ${leader.nome_completo} (${leader.id})`);
  console.log(`[processLeader] verification_method=${leader.verification_method}, isWhatsAppVerification=${isWhatsAppVerification}`);
  console.log(`[processLeader] skipSMS=${skipSMS}, skipEmail=${skipEmail}, skipWhatsApp=${skipWhatsApp}`);

  const affiliateLink = `${baseUrl}/cadastro/${leader.affiliate_token}`;
  let smsSent = skipSMS;
  let emailSent = skipEmail;
  let whatsAppSent = skipWhatsApp;

  // STEP 1: If WhatsApp verification → send WhatsApp (not SMS)
  // Use bypassAutoCheck=true to ensure the message is sent even if wa_auto_lideranca_enabled is false
  // This is because the channel of delivery should match the channel of verification
  if (isWhatsAppVerification && !skipWhatsApp && leader.telefone) {
    try {
      console.log(`[processLeader] Sending WhatsApp to ${leader.nome_completo} (WhatsApp verification flow, bypassing auto check)`);
      const whatsAppResponse = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone: leader.telefone,
          templateSlug: "lider-cadastro-confirmado",
          variables: {
            nome: leader.nome_completo,
            link_indicacao: affiliateLink,
          },
          bypassAutoCheck: true, // Always send via WhatsApp when verification was via WhatsApp
        },
      });

      if (whatsAppResponse.error) {
        errors.push(`WhatsApp: ${whatsAppResponse.error.message || "Error"}`);
        console.error(`[processLeader] WhatsApp error for ${leader.nome_completo}:`, whatsAppResponse.error);
      } else {
        whatsAppSent = true;
        console.log(`[processLeader] WhatsApp sent to ${leader.nome_completo}`);
      }
    } catch (e) {
      errors.push(`WhatsApp exception: ${String(e)}`);
      console.error(`[processLeader] WhatsApp exception for ${leader.nome_completo}:`, e);
    }
  }

  // STEP 2: If NOT WhatsApp verification → send SMS (original behavior)
  if (!isWhatsAppVerification && !skipSMS && leader.telefone) {
    try {
      console.log(`[processLeader] Sending SMS to ${leader.nome_completo} (non-WhatsApp verification flow)`);
      const smsResponse = await supabase.functions.invoke("send-sms", {
        body: {
          phone: leader.telefone,
          templateSlug: "lider-cadastro-confirmado-sms",
          variables: {
            nome: leader.nome_completo,
            link_indicacao: affiliateLink,
          },
        },
      });

      if (smsResponse.error) {
        errors.push(`SMS: ${smsResponse.error.message || "Error"}`);
        console.error(`[processLeader] SMS error for ${leader.nome_completo}:`, smsResponse.error);
      } else {
        smsSent = true;
        console.log(`[processLeader] SMS sent to ${leader.nome_completo}`);
      }
    } catch (e) {
      errors.push(`SMS exception: ${String(e)}`);
      console.error(`[processLeader] SMS exception for ${leader.nome_completo}:`, e);
    }
  } else if (!leader.telefone) {
    console.log(`[processLeader] No phone for ${leader.nome_completo}, skipping messaging channel`);
  }

  // STEP 3: Send Email (always, after WhatsApp/SMS)
  if (!skipEmail && leader.email) {
    try {
      console.log(`[processLeader] Sending Email to ${leader.nome_completo}`);
      const emailResponse = await supabase.functions.invoke("send-email", {
        body: {
          to: leader.email,
          toName: leader.nome_completo,
          templateSlug: "lideranca-boas-vindas",
          leaderId: leader.id,
          variables: {
            nome: leader.nome_completo,
            link_indicacao: affiliateLink,
          },
        },
      });

      if (emailResponse.error) {
        errors.push(`Email: ${emailResponse.error.message || "Error"}`);
        console.error(`[processLeader] Email error for ${leader.nome_completo}:`, emailResponse.error);
      } else {
        emailSent = true;
        console.log(`[processLeader] Email sent to ${leader.nome_completo}`);
      }
    } catch (e) {
      errors.push(`Email exception: ${String(e)}`);
      console.error(`[processLeader] Email exception for ${leader.nome_completo}:`, e);
    }
  } else if (!leader.email) {
    console.log(`[processLeader] No email for ${leader.nome_completo}, skipping Email`);
  }

  // Schedule region material after successful communication
  if (smsSent || emailSent || whatsAppSent) {
    try {
      console.log(`[processLeader] Scheduling region material for ${leader.nome_completo}`);
      await supabase.functions.invoke("schedule-region-material", {
        body: { leader_id: leader.id },
      });
    } catch (e) {
      console.error(`[processLeader] Error scheduling region material:`, e);
      // Don't add to errors - this is a non-critical operation
    }
  }

  return {
    leader_id: leader.id,
    nome: leader.nome_completo,
    sms_sent: smsSent,
    email_sent: emailSent,
    whatsapp_sent: whatsAppSent,
    errors,
  };
}
