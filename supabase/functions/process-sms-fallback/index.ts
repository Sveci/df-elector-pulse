import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSMessage {
  id: string;
  phone: string;
  message: string;
  contact_id: string | null;
  retry_count: number;
  status: string;
  created_at: string;
}

interface IntegrationSettings {
  zapi_enabled: boolean | null;
  wa_auto_sms_fallback_enabled: boolean | null;
}

type MessageType = 'verification' | 'affiliate_link' | null;

// Normalizar telefone para busca
function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("55") && clean.length > 11) {
    clean = clean.substring(2);
  }
  if (clean.length === 10 && clean.startsWith("61")) {
    clean = "61" + "9" + clean.substring(2);
  }
  return clean;
}

// Determinar tipo de mensagem SMS
function determineMessageType(message: string): MessageType {
  const lowerMessage = message.toLowerCase();

  // Verificar se é mensagem de link de indicação
  if (lowerMessage.includes('link de indicacao') || lowerMessage.includes('link de indicação') ||
      message.includes('/cadastro/')) {
    return 'affiliate_link';
  }

  // Verificar se é mensagem de verificação
  if (lowerMessage.includes('verificar-lider') || lowerMessage.includes('verificar-contato') ||
      lowerMessage.includes('código') || lowerMessage.includes('codigo')) {
    return 'verification';
  }

  return null;
}

// Extrair código de verificação de uma mensagem SMS
function extractVerificationCode(message: string): string | null {
  const patterns = [
    // Padrão 1: Extrair código do link de verificação de líder
    /verificar-lider\/([A-Z0-9]{5,6})/i,
    // Padrão 2: Extrair código do link de verificação de contato
    /verificar-contato\/([A-Z0-9]{5,6})/i,
    // Padrão 3: Código alfanumérico após "código:" ou "codigo"
    /c[oó]digo[:\s]*([A-Z0-9]{5,6})/i,
    // Padrão 4: Código alfanumérico isolado de 5-6 caracteres (excluindo palavras comuns)
    /\b([A-Z0-9]{5,6})\b/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const code = match[1].toUpperCase();
      // Excluir palavras comuns que podem ser confundidas com códigos
      if (!["HTTPS", "DEPUTADO", "WHATS", "RAFAE", "PRUDE"].some(w => code.includes(w))) {
        console.log(`[process-sms-fallback] Extracted verification code: ${code}`);
        return code;
      }
    }
  }

  console.log(`[process-sms-fallback] No verification code found in message`);
  return null;
}

// Extrair link de indicação de uma mensagem SMS
function extractAffiliateLink(message: string): { url: string; token: string } | null {
  // Padrão para extrair URL com token de afiliado
  const patterns = [
    // URL completa com /cadastro/TOKEN
    /(https?:\/\/[^\s]+\/cadastro\/([A-Za-z0-9_-]+))/i,
    // URL encurtada ou alternativa
    /(https?:\/\/[^\s]+)/i,
  ];

  // Tentar extrair URL com token
  const fullUrlMatch = message.match(patterns[0]);
  if (fullUrlMatch && fullUrlMatch[1] && fullUrlMatch[2]) {
    console.log(`[process-sms-fallback] Extracted affiliate link: ${fullUrlMatch[1]}, token: ${fullUrlMatch[2]}`);
    return { url: fullUrlMatch[1], token: fullUrlMatch[2] };
  }

  // Tentar extrair qualquer URL
  const anyUrlMatch = message.match(patterns[1]);
  if (anyUrlMatch && anyUrlMatch[1]) {
    console.log(`[process-sms-fallback] Extracted URL (no token): ${anyUrlMatch[1]}`);
    return { url: anyUrlMatch[1], token: '' };
  }

  console.log(`[process-sms-fallback] No affiliate link found in message`);
  return null;
}

// Buscar contato ou líder NÃO VERIFICADO associado ao telefone
async function findUnverifiedRecipient(
  supabaseUrl: string,
  supabaseServiceKey: string,
  phone: string
): Promise<{
  type: 'contact' | 'leader' | null;
  id: string | null;
  name: string | null;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cleanPhone = normalizePhone(phone);
  const last9Digits = cleanPhone.slice(-9);

  console.log(`[process-sms-fallback] Searching for UNVERIFIED recipient with phone: ${phone}, last9: ${last9Digits}`);

  // Buscar em office_contacts pelo telefone normalizado
  const { data: contactData, error: contactError } = await supabase
    .from('office_contacts')
    .select('id, nome, telefone_norm, verification_code')
    .eq('is_verified', false)
    .or(`telefone_norm.ilike.%${last9Digits}`)
    .limit(1)
    .maybeSingle();

  if (contactError) {
    console.error(`[process-sms-fallback] Error searching contacts:`, contactError);
  }

  if (contactData) {
    console.log(`[process-sms-fallback] ✓ Found unverified contact: ${contactData.nome} (${contactData.id})`);
    return { type: 'contact', id: contactData.id, name: contactData.nome };
  }

  // Buscar em lideres pelo telefone
  const { data: leaderData, error: leaderError } = await supabase
    .from('lideres')
    .select('id, nome_completo, telefone, verification_code')
    .eq('is_verified', false)
    .eq('is_active', true)
    .or(`telefone.ilike.%${last9Digits}`)
    .limit(1)
    .maybeSingle();

  if (leaderError) {
    console.error(`[process-sms-fallback] Error searching leaders:`, leaderError);
  }

  if (leaderData) {
    console.log(`[process-sms-fallback] ✓ Found unverified leader: ${leaderData.nome_completo} (${leaderData.id})`);
    return { type: 'leader', id: leaderData.id, name: leaderData.nome_completo };
  }

  console.log(`[process-sms-fallback] ✗ No unverified contact/leader found for phone ${phone}`);
  return { type: null, id: null, name: null };
}

// Buscar líder pelo telefone (para mensagens de link de indicação - pode ser verificado)
async function findLeaderByPhone(
  supabaseUrl: string,
  supabaseServiceKey: string,
  phone: string
): Promise<{
  id: string | null;
  name: string | null;
  affiliateToken: string | null;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cleanPhone = normalizePhone(phone);
  const last9Digits = cleanPhone.slice(-9);

  console.log(`[process-sms-fallback] Searching for leader (any status) with phone: ${phone}, last9: ${last9Digits}`);

  const { data: leaderData, error: leaderError } = await supabase
    .from('lideres')
    .select('id, nome_completo, telefone, affiliate_token')
    .eq('is_active', true)
    .or(`telefone.ilike.%${last9Digits}`)
    .limit(1)
    .maybeSingle();

  if (leaderError) {
    console.error(`[process-sms-fallback] Error searching leader:`, leaderError);
  }

  if (leaderData) {
    console.log(`[process-sms-fallback] ✓ Found leader: ${leaderData.nome_completo} (${leaderData.id}), token: ${leaderData.affiliate_token}`);
    return {
      id: leaderData.id,
      name: leaderData.nome_completo,
      affiliateToken: leaderData.affiliate_token
    };
  }

  console.log(`[process-sms-fallback] ✗ No leader found for phone ${phone}`);
  return { id: null, name: null, affiliateToken: null };
}

// Enviar WhatsApp para verificação
async function sendVerificationWhatsApp(
  supabaseUrl: string,
  phone: string,
  name: string,
  code: string,
  contactId: string | null
): Promise<{ success: boolean; error?: string }> {
  console.log(`[process-sms-fallback] Sending VERIFICATION WhatsApp to ${phone}, name: ${name}, code: ${code}`);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        templateSlug: 'verificacao-sms-fallback',
        variables: {
          nome: name || 'Amigo(a)',
          codigo: code,
        },
        contactId,
      }),
    });

    const data = await response.json();
    console.log(`[process-sms-fallback] WhatsApp verification response:`, JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: data.success === true, error: data.error };
  } catch (error) {
    console.error(`[process-sms-fallback] WhatsApp exception:`, error);
    return { success: false, error: (error as Error).message };
  }
}

// Enviar WhatsApp para link de indicação
async function sendAffiliateLinkWhatsApp(
  supabaseUrl: string,
  phone: string,
  name: string,
  affiliateLink: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[process-sms-fallback] Sending AFFILIATE LINK WhatsApp to ${phone}, name: ${name}, link: ${affiliateLink}`);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        templateSlug: 'link-indicacao-sms-fallback',
        variables: {
          nome: name || 'Líder',
          link_indicacao: affiliateLink,
        },
      }),
    });

    const data = await response.json();
    console.log(`[process-sms-fallback] WhatsApp affiliate response:`, JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: data.success === true, error: data.error };
  } catch (error) {
    console.error(`[process-sms-fallback] WhatsApp exception:`, error);
    return { success: false, error: (error as Error).message };
  }
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

  const startTime = Date.now();
  console.log("[process-sms-fallback] ========== Starting SMS fallback processing ==========");

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
      console.log("[process-sms-fallback] Horário de silêncio ativo. Pulando execução.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "quiet_hours" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verificar configurações de fallback
    const { data: settings, error: settingsError } = await supabase
      .from("integrations_settings")
      .select("zapi_enabled, wa_auto_sms_fallback_enabled")
      .limit(1)
      .single();

    if (settingsError) {
      console.error("[process-sms-fallback] Error fetching settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configurações" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedSettings = settings as IntegrationSettings;

    if (!typedSettings.zapi_enabled) {
      console.log("[process-sms-fallback] Z-API not enabled, skipping");
      return new Response(
        JSON.stringify({ success: false, error: "Z-API não está habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!typedSettings.wa_auto_sms_fallback_enabled) {
      console.log("[process-sms-fallback] WhatsApp SMS fallback not enabled");
      return new Response(
        JSON.stringify({ success: false, error: "Fallback SMS->WhatsApp não está habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[process-sms-fallback] ✓ WhatsApp fallback is enabled");

    // 2. Buscar mensagens SMS falhadas pendentes de fallback
    // Critérios:
    // - VERIFICAÇÃO: status = 'failed', retry_count >= 6, contém código de verificação
    // - LINK INDICAÇÃO: status = 'failed', retry_count >= 3, contém link de indicação
    // Buscar mensagens falhadas (excluir as que já estão em processamento ou já tiveram fallback)
    const { data: failedMessages, error: fetchError } = await supabase
      .from("sms_messages")
      .select("id, phone, message, contact_id, retry_count, status, created_at")
      .eq("status", "failed")
      .or(
        // Mensagens de verificação com 6+ tentativas
        "and(retry_count.gte.6,or(message.ilike.%verificar-lider%,message.ilike.%verificar-contato%,message.ilike.%codigo%))," +
        // Mensagens de link de indicação com 3+ tentativas
        "and(retry_count.gte.3,or(message.ilike.%link de indicacao%,message.ilike.%/cadastro/%))"
      )
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("[process-sms-fallback] Error fetching failed messages:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!failedMessages || failedMessages.length === 0) {
      console.log("[process-sms-fallback] No failed messages pending fallback");
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: "Nenhuma mensagem pendente de fallback"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-sms-fallback] Found ${failedMessages.length} failed messages to process`);

    const results = {
      processed: 0,
      verification_success: 0,
      verification_failed: 0,
      affiliate_success: 0,
      affiliate_failed: 0,
      no_data: 0,
      skipped: 0,
      details: [] as { id: string; phone: string; type: string; result: string }[],
    };

    // 3. Processar cada mensagem com lock otimista
    for (const msg of failedMessages as SMSMessage[]) {
      console.log(`\n[process-sms-fallback] Attempting to lock message ${msg.id}`);

      // LOCK OTIMISTA: Tentar atualizar status para 'processing_fallback'
      // Se outra instância já pegou esta mensagem, o update não afetará nenhuma linha
      const { data: lockResult, error: lockError } = await supabase
        .from("sms_messages")
        .update({
          status: "processing_fallback",
          updated_at: new Date().toISOString()
        })
        .eq("id", msg.id)
        .eq("status", "failed") // Só atualiza se ainda estiver 'failed'
        .select("id");

      if (lockError) {
        console.error(`[process-sms-fallback] Lock error for ${msg.id}:`, lockError);
        results.skipped++;
        results.details.push({ id: msg.id, phone: msg.phone, type: 'unknown', result: 'lock_error' });
        continue;
      }

      if (!lockResult || lockResult.length === 0) {
        console.log(`[process-sms-fallback] ⚡ Message ${msg.id} already being processed by another instance, skipping`);
        results.skipped++;
        results.details.push({ id: msg.id, phone: msg.phone, type: 'unknown', result: 'already_locked' });
        continue;
      }

      console.log(`[process-sms-fallback] ✓ Lock acquired for message ${msg.id}`);

      results.processed++;
      console.log(`[process-sms-fallback] Processing message ${msg.id} (${results.processed}/${failedMessages.length})`);
      console.log(`[process-sms-fallback] Phone: ${msg.phone}, retry_count: ${msg.retry_count}`);
      console.log(`[process-sms-fallback] Message: ${msg.message.substring(0, 100)}...`);

      const messageType = determineMessageType(msg.message);
      console.log(`[process-sms-fallback] Message type: ${messageType}`);

      // Verificar se atende os critérios de retry para o tipo
      if (messageType === 'verification' && msg.retry_count < 6) {
        console.log(`[process-sms-fallback] Skipping verification message - only ${msg.retry_count} retries (need 6+)`);
        results.skipped++;
        results.details.push({ id: msg.id, phone: msg.phone, type: 'verification', result: 'skipped_low_retry' });
        continue;
      }

      if (messageType === 'affiliate_link' && msg.retry_count < 3) {
        console.log(`[process-sms-fallback] Skipping affiliate link message - only ${msg.retry_count} retries (need 3+)`);
        results.skipped++;
        results.details.push({ id: msg.id, phone: msg.phone, type: 'affiliate_link', result: 'skipped_low_retry' });
        continue;
      }

      let whatsappResult: { success: boolean; error?: string } = { success: false, error: 'Unknown type' };
      let fallbackMessage = '';

      if (messageType === 'verification') {
        // PROCESSAR VERIFICAÇÃO
        const verificationCode = extractVerificationCode(msg.message);

        if (!verificationCode) {
          console.log(`[process-sms-fallback] ✗ No verification code found`);
          results.no_data++;
          results.details.push({ id: msg.id, phone: msg.phone, type: 'verification', result: 'no_code' });
          continue;
        }

        const recipient = await findUnverifiedRecipient(supabaseUrl, supabaseServiceKey, msg.phone);

        if (!recipient.type || !recipient.id) {
          console.log(`[process-sms-fallback] ✗ No unverified recipient found`);
          results.no_data++;
          results.details.push({ id: msg.id, phone: msg.phone, type: 'verification', result: 'no_recipient' });
          continue;
        }

        whatsappResult = await sendVerificationWhatsApp(
          supabaseUrl,
          msg.phone,
          recipient.name || 'Amigo(a)',
          verificationCode,
          recipient.type === 'contact' ? recipient.id : null
        );

        fallbackMessage = `Após ${msg.retry_count} tentativas SMS, código de verificação enviado via WhatsApp`;

        if (whatsappResult.success) {
          results.verification_success++;
        } else {
          results.verification_failed++;
        }

      } else if (messageType === 'affiliate_link') {
        // PROCESSAR LINK DE INDICAÇÃO
        const affiliateData = extractAffiliateLink(msg.message);

        if (!affiliateData) {
          console.log(`[process-sms-fallback] ✗ No affiliate link found`);
          results.no_data++;
          results.details.push({ id: msg.id, phone: msg.phone, type: 'affiliate_link', result: 'no_link' });
          continue;
        }

        const leader = await findLeaderByPhone(supabaseUrl, supabaseServiceKey, msg.phone);

        if (!leader.id) {
          console.log(`[process-sms-fallback] ✗ No leader found for phone`);
          results.no_data++;
          results.details.push({ id: msg.id, phone: msg.phone, type: 'affiliate_link', result: 'no_leader' });
          continue;
        }

        whatsappResult = await sendAffiliateLinkWhatsApp(
          supabaseUrl,
          msg.phone,
          leader.name || 'Líder',
          affiliateData.url
        );

        fallbackMessage = `Após ${msg.retry_count} tentativas SMS, link de indicação enviado via WhatsApp`;

        if (whatsappResult.success) {
          results.affiliate_success++;
        } else {
          results.affiliate_failed++;
        }

      } else {
        console.log(`[process-sms-fallback] ✗ Unknown message type, skipping`);
        results.skipped++;
        results.details.push({ id: msg.id, phone: msg.phone, type: 'unknown', result: 'skipped' });
        continue;
      }

      // Atualizar status da mensagem SMS
      if (whatsappResult.success) {
        const { error: updateError } = await supabase
          .from("sms_messages")
          .update({
            status: "fallback_whatsapp",
            error_message: fallbackMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id);

        if (updateError) {
          console.error(`[process-sms-fallback] Error updating message ${msg.id}:`, updateError);
        }

        results.details.push({ id: msg.id, phone: msg.phone, type: messageType || 'unknown', result: 'fallback_sent' });
        console.log(`[process-sms-fallback] ✓ WhatsApp fallback sent for ${msg.id}`);
      } else {
        // WhatsApp falhou - voltar status para 'failed' para permitir reprocessamento futuro
        const { error: revertError } = await supabase
          .from("sms_messages")
          .update({
            status: "failed",
            error_message: `WhatsApp fallback failed: ${whatsappResult.error}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", msg.id);

        if (revertError) {
          console.error(`[process-sms-fallback] Error reverting status for ${msg.id}:`, revertError);
        }

        results.details.push({ id: msg.id, phone: msg.phone, type: messageType || 'unknown', result: `failed: ${whatsappResult.error}` });
        console.log(`[process-sms-fallback] ✗ WhatsApp fallback failed for ${msg.id}: ${whatsappResult.error}, status reverted to 'failed'`);
      }

      // Delay entre mensagens para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;
    console.log(`\n[process-sms-fallback] ========== Completed in ${duration}ms ==========`);
    console.log(`[process-sms-fallback] Results: processed=${results.processed}`);
    console.log(`[process-sms-fallback] Verification: success=${results.verification_success}, failed=${results.verification_failed}`);
    console.log(`[process-sms-fallback] Affiliate: success=${results.affiliate_success}, failed=${results.affiliate_failed}`);
    console.log(`[process-sms-fallback] No data: ${results.no_data}, Skipped: ${results.skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.processed,
        verification_success: results.verification_success,
        verification_failed: results.verification_failed,
        affiliate_success: results.affiliate_success,
        affiliate_failed: results.affiliate_failed,
        no_data: results.no_data,
        skipped: results.skipped,
        details: results.details,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-sms-fallback] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
