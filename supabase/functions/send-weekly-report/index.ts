import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchAllPaginated(supabase: any, table: string, filters: { column: string; op: string; value: any }[], selectCols: string) {
  const pageSize = 1000;
  let offset = 0;
  const allData: any[] = [];
  while (true) {
    let query = supabase.from(table).select(selectCols).range(offset, offset + pageSize - 1);
    for (const f of filters) {
      if (f.op === "gte") query = query.gte(f.column, f.value);
      else if (f.op === "eq") query = query.eq(f.column, f.value);
      else if (f.op === "in") query = query.in(f.column, f.value);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return allData;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { phone, groupId } = body;

    const destination = phone || groupId;
    if (!destination) {
      return new Response(JSON.stringify({ success: false, error: "phone or groupId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate week range (Monday to now)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartISO = weekStart.toISOString();

    console.log(`[weekly-report] Generating report from ${weekStartISO} to now`);

    // 1. Contacts registered this week
    const { count: contactsThisWeek } = await supabase
      .from("office_contacts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStartISO);

    // 2. Leaders registered this week
    const { count: leadersThisWeek } = await supabase
      .from("lideres")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStartISO);

    // 3. Sentiment analyses this week (using sentiment text field like dashboard)
    const allAnalyses = await fetchAllPaginated(
      supabase,
      "po_sentiment_analyses",
      [{ column: "analyzed_at", op: "gte", value: weekStartISO }],
      "sentiment, category"
    );

    const totalAnalyzed = allAnalyses.length;
    const positiveCount = allAnalyses.filter((a: any) => a.sentiment === "positivo").length;
    const negativeCount = allAnalyses.filter((a: any) => a.sentiment === "negativo").length;
    const neutralCount = allAnalyses.filter((a: any) => a.sentiment === "neutro").length;
    const complaintCount = allAnalyses.filter((a: any) => a.category === "reclamacao" || a.category === "critica").length;

    const positivePct = totalAnalyzed > 0 ? ((positiveCount / totalAnalyzed) * 100).toFixed(1) : "0";
    const negativePct = totalAnalyzed > 0 ? ((negativeCount / totalAnalyzed) * 100).toFixed(1) : "0";
    const neutralPct = totalAnalyzed > 0 ? ((neutralCount / totalAnalyzed) * 100).toFixed(1) : "0";

    // 4. Total mentions count this week
    const { count: totalMentions } = await supabase
      .from("po_mentions")
      .select("*", { count: "exact", head: true })
      .gte("collected_at", weekStartISO);

    // 5. Events this week
    const { data: eventsThisWeek } = await supabase
      .from("events")
      .select("id, name, registrations_count, checkedin_count")
      .gte("date", weekStart.toISOString().split("T")[0]);

    const totalEvents = eventsThisWeek?.length || 0;
    const totalRegistrations = eventsThisWeek?.reduce((s: number, e: any) => s + (e.registrations_count || 0), 0) || 0;
    const totalCheckins = eventsThisWeek?.reduce((s: number, e: any) => s + (e.checkedin_count || 0), 0) || 0;
    const attendanceRate = totalRegistrations > 0 ? ((totalCheckins / totalRegistrations) * 100).toFixed(1) : "0";

    // 6. Campaign materials distributed this week
    const withdrawals = await fetchAllPaginated(
      supabase,
      "material_reservations",
      [
        { column: "withdrawn_at", op: "gte", value: weekStartISO },
        { column: "status", op: "eq", value: "withdrawn" },
      ],
      "quantidade, leader_id"
    );
    const totalDistributed = withdrawals.reduce((s: number, w: any) => s + (w.quantidade || 0), 0);

    // 7. Top region for materials
    let topRegion = "N/A";
    let topRegionQty = 0;

    if (withdrawals.length > 0) {
      const leaderIds = [...new Set(withdrawals.map((w: any) => w.leader_id))];
      const { data: leaders } = await supabase
        .from("lideres")
        .select("id, cidade_id")
        .in("id", leaderIds);

      if (leaders) {
        const cityQty: Record<string, number> = {};
        for (const w of withdrawals) {
          const leader = leaders.find((l: any) => l.id === w.leader_id);
          if (leader?.cidade_id) {
            cityQty[leader.cidade_id] = (cityQty[leader.cidade_id] || 0) + (w.quantidade || 0);
          }
        }

        const topCityEntry = Object.entries(cityQty).sort((a, b) => b[1] - a[1])[0];
        if (topCityEntry) {
          topRegionQty = topCityEntry[1];
          const { data: city } = await supabase
            .from("office_cities")
            .select("nome")
            .eq("id", topCityEntry[0])
            .single();
          topRegion = city?.nome || "Desconhecida";
        }
      }
    }

    // Build report message
    const weekLabel = `${weekStart.toLocaleDateString("pt-BR")} a ${now.toLocaleDateString("pt-BR")}`;

    const report = `🟠 *SANFONINHA DIGITAL — RELATÓRIO SEMANAL*
📅 ${weekLabel}

👥 *Cadastros da Semana*
• Contatos: ${contactsThisWeek || 0}
• Líderes: ${leadersThisWeek || 0}

📣 *Menções (Opinião Pública)*
• Total de menções: ${totalMentions || 0}
• Analisadas: ${totalAnalyzed}
• ✅ Positivas: ${positiveCount} (${positivePct}%)
• ❌ Negativas: ${negativeCount} (${negativePct}%)
• 😐 Neutras: ${neutralCount} (${neutralPct}%)
• ⚠️ Reclamações/Críticas: ${complaintCount}

🎯 *Eventos*
• Realizados: ${totalEvents}
• Inscritos totais: ${totalRegistrations}
• Presença: ${totalCheckins} (${attendanceRate}%)

📦 *Material de Campanha*
• Distribuído: ${totalDistributed} unidades
• Região destaque: ${topRegion}${topRegionQty > 0 ? ` (${topRegionQty} un.)` : ""}

_Relatório gerado automaticamente pela Sanfoninha Digital._`;

    console.log("[weekly-report] Report:\n", report);

    // Get Z-API credentials
    const { data: settings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_client_token")
      .limit(1)
      .single();

    if (!settings?.zapi_instance_id || !settings?.zapi_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Z-API not configured", report }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Z-API
    const isGroup = !!groupId;
    const endpoint = `https://api.z-api.io/instances/${settings.zapi_instance_id}/token/${settings.zapi_token}/send-text`;
    const cleanPhone = phone ? phone.replace(/\D/g, "") : undefined;

    const zapiBody = isGroup
      ? { phone: groupId, message: report, isGroup: true }
      : { phone: cleanPhone, message: report };

    const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.zapi_client_token) {
      zapiHeaders["Client-Token"] = settings.zapi_client_token;
    }

    const zapiResponse = await fetch(endpoint, {
      method: "POST",
      headers: zapiHeaders,
      body: JSON.stringify(zapiBody),
    });

    const zapiResult = await zapiResponse.text();
    console.log("[weekly-report] Z-API response:", zapiResult);

    // Log to whatsapp_messages
    await supabase.from("whatsapp_messages").insert({
      phone: cleanPhone || groupId,
      message: report,
      status: zapiResponse.ok ? "sent" : "failed",
      direction: "outgoing",
      template_slug: "weekly-report",
      sent_at: new Date().toISOString(),
      provider: "zapi",
      error_message: zapiResponse.ok ? null : zapiResult,
    });

    return new Response(
      JSON.stringify({ success: zapiResponse.ok, report, zapiResponse: zapiResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[weekly-report] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
