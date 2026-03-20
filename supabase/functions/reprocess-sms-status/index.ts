import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SMSDEV status codes mapping
const SMSDEV_STATUS_MAP: Record<string, string> = {
  "0": "queued",
  "1": "sent",
  "2": "delivered",
  "3": "failed",
  "4": "failed",
  "FILA": "queued",
  "ENVIADO": "sent",
  "ENVIADA": "sent",
  "ENTREGUE": "delivered",
  "RECEBIDA": "delivered",
  "CLICADA": "delivered",
  "ERRO": "failed",
  "FALHA": "failed",
  "BLOQUEADO": "failed",
  "CANCELADO": "failed",
  "INVALIDO": "failed",
  "OK": "sent",
};

// SMSBarato status codes mapping
const SMSBARATO_STATUS_MAP: Record<string, string> = {
  "N": "queued",     // Nova, aguardando envio
  "R": "sent",       // Sendo enviada
  "S": "delivered",  // Sucesso
  "F": "failed",     // Falha
};

interface SMSMessageRow {
  id: string;
  message_id: string | null;
  status: string;
  created_at: string;
  provider: string | null;
}

interface SMSDEVStatusResponse {
  situacao?: string;
  status?: string;
  descricao?: string;
  codigo?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Check status via SMSDEV API
async function checkSMSDEVStatus(
  messageId: string,
  apiKey: string
): Promise<{ success: boolean; status?: string; description?: string }> {
  const statusUrl = `https://api.smsdev.com.br/v1/dlr?key=${apiKey}&id=${messageId}`;

  const response = await fetch(statusUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { success: false };
  }

  const statusData: SMSDEVStatusResponse = await response.json();

  let rawStatus: string | undefined;
  if (statusData.situacao === "OK" && statusData.descricao) {
    rawStatus = statusData.descricao;
  } else {
    rawStatus = statusData.situacao || statusData.status || statusData.codigo || statusData.descricao;
  }

  if (!rawStatus) return { success: false };

  const normalizedStatus = rawStatus.toString().toUpperCase();
  const mappedStatus = SMSDEV_STATUS_MAP[normalizedStatus] || SMSDEV_STATUS_MAP[rawStatus];

  if (!mappedStatus) {
    console.log(`[reprocess-sms-status] Unknown SMSDEV status '${rawStatus}'`);
    return { success: false };
  }

  return { success: true, status: mappedStatus, description: statusData.descricao };
}

// Check status via SMSBarato API
async function checkSMSBaratoStatus(
  messageId: string,
  apiKey: string
): Promise<{ success: boolean; status?: string; description?: string }> {
  const statusUrl = `https://sistema81.smsbarato.com.br/status?chave=${apiKey}&id=${messageId}`;

  const response = await fetch(statusUrl);
  const result = await response.text();
  const trimmedResult = result.trim();

  console.log(`[reprocess-sms-status] SMSBarato raw response: "${trimmedResult}"`);

  // Verificar erros (resposta começa com "ERRO")
  if (trimmedResult.startsWith("ERRO")) {
    return { success: false };
  }

  // SMSBarato retorna formato: "S 2026-01-22 18:00:18" (status + timestamp)
  // Extrair apenas o primeiro caractere (código de status: N, R, S, F)
  const statusCode = trimmedResult.charAt(0).toUpperCase();

  const mappedStatus = SMSBARATO_STATUS_MAP[statusCode];

  if (!mappedStatus) {
    console.log(`[reprocess-sms-status] Unknown SMSBarato status code '${statusCode}' from response: "${trimmedResult}"`);
    return { success: false };
  }

  const descriptions: Record<string, string> = {
    "N": "Mensagem nova, aguardando envio",
    "R": "Mensagem sendo enviada",
    "S": "Mensagem enviada com sucesso",
    "F": "Envio falhou",
  };

  return { success: true, status: mappedStatus, description: descriptions[statusCode] };
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 500, days = 30 } = (await req.json().catch(() => ({}))) as {
      limit?: number;
      days?: number;
    };

    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    const safeDays = Math.max(1, Math.min(365, Number(days) || 30));

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
      console.log("[reprocess-sms-status] Horário de silêncio ativo. Pulando execução.");
      return json({ success: true, skipped: true, reason: "quiet_hours" });
    }

    // Get settings for all SMS providers
    const { data: settings, error: settingsError } = await supabase
      .from("integrations_settings")
      .select("smsdev_api_key, smsdev_enabled, smsbarato_api_key, smsbarato_enabled")
      .limit(1)
      .single();

    if (settingsError) {
      console.log("[reprocess-sms-status] Settings error:", settingsError);
      return json({ success: false, error: "Failed to load settings" }, 500);
    }

    const smsdevEnabled = settings?.smsdev_enabled && settings?.smsdev_api_key;
    const smsbaratoEnabled = settings?.smsbarato_enabled && settings?.smsbarato_api_key;

    if (!smsdevEnabled && !smsbaratoEnabled) {
      console.log("[reprocess-sms-status] No SMS provider enabled");
      return json({ success: false, error: "No SMS provider enabled" }, 200);
    }

    console.log(`[reprocess-sms-status] SMSDEV enabled: ${smsdevEnabled}, SMSBarato enabled: ${smsbaratoEnabled}`);

    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

    // PostgREST has a default max of 1000 rows per request; fetch in pages.
    const pageSize = 1000;
    let messages: SMSMessageRow[] = [];
    let from = 0;

    while (messages.length < safeLimit) {
      const to = Math.min(from + pageSize - 1, safeLimit - 1);

      const { data: page, error: pageError } = await supabase
        .from("sms_messages")
        .select("id, message_id, status, created_at, provider")
        .in("status", ["queued", "sent", "pending"])
        .not("message_id", "is", null)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (pageError) {
        console.error("[reprocess-sms-status] Error fetching messages:", pageError);
        return json({ success: false, error: pageError.message }, 500);
      }

      if (!page || page.length === 0) break;

      messages = messages.concat(page as SMSMessageRow[]);

      if (page.length < pageSize) break;
      from += pageSize;
    }


    if (!messages || messages.length === 0) {
      return json({ success: true, checked: 0, updated: 0, limit: safeLimit, days: safeDays });
    }

    console.log(
      `[reprocess-sms-status] Reprocessing ${messages.length} messages (limit=${safeLimit}, days=${safeDays})`
    );

    let checked = 0;
    let updated = 0;

    const rows = messages as SMSMessageRow[];
    const chunkSize = 25;

    const processOne = async (msg: SMSMessageRow) => {
      if (!msg.message_id) return { checked: 0, updated: 0 };

      // Determine provider (default to smsdev for backward compatibility)
      const provider = msg.provider || 'smsdev';

      let statusResult: { success: boolean; status?: string; description?: string };

      if (provider === 'smsbarato') {
        if (!smsbaratoEnabled) return { checked: 0, updated: 0 };
        statusResult = await checkSMSBaratoStatus(msg.message_id, settings.smsbarato_api_key!);
      } else {
        // Default to SMSDEV
        if (!smsdevEnabled) return { checked: 0, updated: 0 };
        statusResult = await checkSMSDEVStatus(msg.message_id, settings.smsdev_api_key!);
      }

      if (!statusResult.success || !statusResult.status) {
        return { checked: 1, updated: 0 };
      }

      const mappedStatus = statusResult.status;

      if (mappedStatus === msg.status) return { checked: 1, updated: 0 };

      const updateData: Record<string, unknown> = {
        status: mappedStatus,
        updated_at: new Date().toISOString(),
      };

      if (mappedStatus === "sent") {
        updateData.sent_at = new Date().toISOString();
      } else if (mappedStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
        updateData.sent_at = new Date().toISOString();
      } else if (mappedStatus === "failed") {
        updateData.error_message = statusResult.description || "Falha no envio";
      }

      const { error: updateError } = await supabase
        .from("sms_messages")
        .update(updateData)
        .eq("id", msg.id);

      if (updateError) {
        console.error(`[reprocess-sms-status] Update error for ${msg.id}:`, updateError);
        return { checked: 1, updated: 0 };
      }

      return { checked: 1, updated: 1 };
    };

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const results = await Promise.allSettled(
        chunk.map(async (msg) => {
          try {
            return await processOne(msg);
          } catch (e) {
            console.error(`[reprocess-sms-status] Error processing ${msg.message_id}:`, e);
            return { checked: 1, updated: 0 };
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          checked += r.value.checked;
          updated += r.value.updated;
        } else {
          checked += 1;
        }
      }
    }

    console.log(`[reprocess-sms-status] Completed. Checked: ${checked}, Updated: ${updated}`);

    return json({ success: true, checked, updated, limit: safeLimit, days: safeDays });
  } catch (error) {
    console.error("[reprocess-sms-status] Error:", error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
