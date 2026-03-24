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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let leaderId: string | null = null;
    let leaderIds: string[] | null = null;
    let verificationCode: string | null = null;

    try {
      const body = await req.json();
      leaderId = body?.leader_id || null;
      leaderIds = body?.leader_ids || null;
      verificationCode = body?.verification_code || null;
    } catch {
      // No body provided
    }

    // ── Auth: allow public calls with verification_code, otherwise require JWT ──
    if (verificationCode && leaderId) {
      // Public flow: validate verification_code matches the leader
      const { data: leaderCheck, error: checkError } = await supabase
        .from("lideres")
        .select("id, verification_code, is_verified")
        .eq("id", leaderId)
        .single();

      if (checkError || !leaderCheck || leaderCheck.verification_code !== verificationCode) {
        return new Response(JSON.stringify({ error: "Invalid verification code" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[send-leader-affiliate-links] Public auth via verification_code for leader ${leaderId}`);
    } else {
      // Authenticated flow: require valid JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // ── End Auth ──────────────────────────────────────────────────────

    console.log(`[send-leader-affiliate-links] Mode: ${leaderId ? 'single leader: ' + leaderId : leaderIds ? 'batch: ' + leaderIds.length + ' leaders' : 'batch processing (disabled)'}`);

    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://app.eleitor360.ai";

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

      const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
      if (edgeRuntime?.waitUntil) {
        edgeRuntime.waitUntil(backgroundTask());
      } else {
        backgroundTask().catch((e) => console.error("[send-leader-affiliate-links] Background task failed:", e));
      }

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
