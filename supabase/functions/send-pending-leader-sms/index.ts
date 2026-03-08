import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isQuietHours(settings: { quiet_hours_enabled: boolean | null; quiet_hours_start: string | null; quiet_hours_end: string | null } | null): boolean {
  if (!settings?.quiet_hours_enabled) return false;
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  const startHour = parseInt((settings.quiet_hours_start || '21:00').split(':')[0]);
  const endHour = parseInt((settings.quiet_hours_end || '08:00').split(':')[0]);
  if (startHour > endHour) {
    return brasiliaHour >= startHour || brasiliaHour < endHour;
  }
  return brasiliaHour >= startHour && brasiliaHour < endHour;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar horário de silêncio
    const { data: qhSettings } = await supabase
      .from("integrations_settings")
      .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
      .limit(1)
      .single();

    if (isQuietHours(qhSettings)) {
      console.log("[send-pending-leader-sms] Horário de silêncio ativo. Pulando execução.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "quiet_hours" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar líderes VERIFICADOS que não receberam o SMS com link de indicação
    const { data: leaders, error: leadersError } = await supabase
      .from("lideres")
      .select("id, nome_completo, telefone, affiliate_token, created_at")
      .eq("is_active", true)
      .eq("is_verified", true) // IMPORTANTE: Só envia para líderes verificados!
      .not("telefone", "is", null)
      .not("affiliate_token", "is", null);

    if (leadersError) throw leadersError;

    // Buscar quais líderes já receberam o SMS
    const { data: sentSms, error: smsError } = await supabase
      .from("sms_messages")
      .select("phone")
      .ilike("message", "%link de indicacao%");

    if (smsError) throw smsError;

    const sentPhones = new Set(
      sentSms?.map((s) => s.phone.replace(/\D/g, "").slice(-8)) || []
    );

    // Filtrar líderes que não receberam SMS
    const pendingLeaders = leaders?.filter((leader) => {
      if (!leader.telefone) return false;
      const phoneSuffix = leader.telefone.replace(/\D/g, "").slice(-8);
      return !sentPhones.has(phoneSuffix);
    }) || [];

    console.log(`Found ${pendingLeaders.length} leaders without SMS`);

    const results: { nome: string; phone: string; success: boolean; error?: string }[] = [];
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://df-elector-pulse.lovable.app";

    // Enviar SMS para cada líder pendente
    for (const leader of pendingLeaders) {
      const linkIndicacao = `${baseUrl}/cadastro/${leader.affiliate_token}`;
      
      try {
        const { error: sendError } = await supabase.functions.invoke("send-sms", {
          body: {
            phone: leader.telefone,
            templateSlug: "lider-cadastro-confirmado-sms",
            variables: {
              nome: leader.nome_completo,
              link_indicacao: linkIndicacao,
            },
          },
        });

        if (sendError) {
          results.push({ 
            nome: leader.nome_completo, 
            phone: leader.telefone, 
            success: false, 
            error: sendError.message 
          });
        } else {
          results.push({ 
            nome: leader.nome_completo, 
            phone: leader.telefone, 
            success: true 
          });
        }

        // Delay de 3 segundos entre envios para evitar bloqueio
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (err) {
        results.push({ 
          nome: leader.nome_completo, 
          phone: leader.telefone, 
          success: false, 
          error: String(err) 
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Enviados: ${successCount}, Falhas: ${failCount}`,
        total: pendingLeaders.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
