import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCTION_URL = Deno.env.get("APP_BASE_URL") || "https://df-elector-pulse.lovable.app";

function generateLeaderVerificationUrl(verificationCode: string): string {
  return `${PRODUCTION_URL}/verificar-lider/${verificationCode}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calcular threshold: líderes cadastrados nas últimas 4 horas
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    console.log("[resend-verification-sms] Starting. Looking for unverified leaders since:", fourHoursAgo);

    // Buscar líderes NÃO verificados, ativos, com telefone, cadastrados nas últimas 4h
    const { data: leaders, error: leadersError } = await supabase
      .from("lideres")
      .select("id, nome_completo, telefone, verification_code, verification_sent_at, created_at")
      .eq("is_active", true)
      .eq("is_verified", false)
      .not("telefone", "is", null)
      .not("verification_code", "is", null)
      .gte("created_at", fourHoursAgo)
      .order("created_at", { ascending: true });

    if (leadersError) {
      console.error("[resend-verification-sms] Error fetching leaders:", leadersError);
      throw leadersError;
    }

    if (!leaders || leaders.length === 0) {
      console.log("[resend-verification-sms] No unverified leaders found in the last 4 hours");
      return new Response(
        JSON.stringify({ message: "Nenhum líder pendente encontrado", total: 0, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filtrar: só reenviar se o último envio foi há mais de 1 hora (evitar spam)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const eligibleLeaders = leaders
      .filter((leader) => {
        if (!leader.verification_sent_at) return true; // Nunca recebeu
        return leader.verification_sent_at < oneHourAgo; // Último envio há mais de 1h
      })
      .slice(0, 5); // Máximo de 5 líderes por execução

    console.log(`[resend-verification-sms] Found ${leaders.length} unverified, ${eligibleLeaders.length} eligible for resend (max 5)`);

    const results: { nome: string; phone: string; success: boolean; error?: string }[] = [];

    for (const leader of eligibleLeaders) {
      try {
        const verificationLink = generateLeaderVerificationUrl(leader.verification_code);

        const { error: sendError } = await supabase.functions.invoke("send-sms", {
          body: {
            phone: leader.telefone,
            templateSlug: "verificacao-lider-sms",
            leaderId: leader.id,
            variables: {
              nome: leader.nome_completo,
              link_verificacao: verificationLink,
            },
          },
        });

        if (sendError) {
          console.error(`[resend-verification-sms] Error sending to ${leader.nome_completo}:`, sendError);
          results.push({ nome: leader.nome_completo, phone: leader.telefone, success: false, error: String(sendError) });
        } else {
          console.log(`[resend-verification-sms] SMS sent to ${leader.nome_completo}`);
          results.push({ nome: leader.nome_completo, phone: leader.telefone, success: true });

          // Atualizar verification_sent_at
          await supabase
            .from("lideres")
            .update({ verification_sent_at: new Date().toISOString() })
            .eq("id", leader.id);
        }

        // Delay de 2 segundos entre envios
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`[resend-verification-sms] Unexpected error for ${leader.nome_completo}:`, err);
        results.push({ nome: leader.nome_completo, phone: leader.telefone, success: false, error: String(err) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`[resend-verification-sms] ===== RESUMO DO LOTE =====`);
    console.log(`[resend-verification-sms] Total enviados: ${successCount} | Falhas: ${failCount}`);
    results.forEach((r, i) => {
      const status = r.success ? "✅ ENVIADO" : `❌ FALHA (${r.error})`;
      console.log(`[resend-verification-sms] ${i + 1}. ${r.nome} | ${r.phone} | ${status}`);
    });
    console.log(`[resend-verification-sms] ==========================`);

    return new Response(
      JSON.stringify({
        message: `Enviados: ${successCount}, Falhas: ${failCount}`,
        total: eligibleLeaders.length,
        sent: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[resend-verification-sms] Fatal error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
