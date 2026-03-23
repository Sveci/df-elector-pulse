import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// WHATSAPP CHATBOT - ASSISTENTE VIRTUAL PARA LÍDERES
// =====================================================

interface ChatbotConfig {
  id: string;
  is_enabled: boolean;
  use_ai_for_unknown: boolean;
  welcome_message: string | null;
  fallback_message: string | null;
  ai_system_prompt: string | null;
  max_messages_per_hour: number;
  tenant_id: string;
}

interface ChatbotKeyword {
  id: string;
  keyword: string;
  aliases: string[];
  description: string | null;
  response_type: "static" | "dynamic" | "ai";
  static_response: string | null;
  dynamic_function: string | null;
  is_active: boolean;
  priority: number;
}

interface Leader {
  id: string;
  nome_completo: string;
  telefone: string;
  email: string | null;
  cadastros: number;
  pontuacao_total: number;
  cidade_id: string | null;
  is_coordinator: boolean;
  hierarchy_level: number | null;
  tenant_id: string;
}

interface ChatbotRequest {
  phone: string;
  message: string;
  messageId?: string;
  provider?: 'zapi' | 'meta_cloud';
  tenantId?: string;
}

// =====================================================
// CONSTANTS
// =====================================================
const MAX_MESSAGE_LENGTH = 4096;  // WhatsApp max message size
const MAX_CONVERSATION_TURNS = 10; // Keep last N exchanges in context
const SESSION_EXPIRY_HOURS = 24;   // Sessions expire after 24h of inactivity
const REGISTRATION_INVITE_MIN_INTERVAL_MIN = 60; // Min minutes between registration invites
const SEND_RETRY_ATTEMPTS = 3;     // Retry failed sends up to 3 times
const SEND_RETRY_BASE_DELAY_MS = 1000; // Base delay for exponential backoff
const KEYWORD_COOLDOWN_MINUTES = 2; // After a keyword trigger, ignore free-text for N minutes

// =====================================================
// UTILITIES
// =====================================================

/** Sanitize inbound message: remove null bytes, truncate to safe length */
function sanitizeMessage(raw: string): string {
  return raw
    .replace(/\0/g, '')           // strip null bytes
    .replace(/[\u200B-\u200F\uFEFF]/g, '') // strip zero-width chars
    .substring(0, MAX_MESSAGE_LENGTH)
    .trim();
}

/** Exponential backoff sleep */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Send with retry + exponential backoff */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = SEND_RETRY_ATTEMPTS,
  baseDelay = SEND_RETRY_BASE_DELAY_MS,
  label = 'operation'
): Promise<T> {
  let lastError: Error | unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`[whatsapp-chatbot] ${label} attempt ${i + 1}/${attempts} failed, retrying in ${delay}ms:`, err);
      if (i < attempts - 1) await sleep(delay);
    }
  }
  throw lastError;
}

type EventRegCityOption = {
  id: string | null;
  nome: string;
  source: "office" | "ibge";
};

function normalizeCityText(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatCityOptionsList(options: EventRegCityOption[]): string {
  return options.map((c, idx) => `${idx + 1}. ${c.nome}`).join("\n");
}

async function getEventRegistrationCityOptions(
  supabase: any,
  tenantId: string,
  limit = 30,
): Promise<EventRegCityOption[]> {
  const { data: officeCities } = await supabase
    .from("office_cities")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("nome")
    .limit(limit);

  if (officeCities && officeCities.length > 0) {
    return officeCities.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      source: "office" as const,
    }));
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("estado")
    .eq("id", tenantId)
    .maybeSingle();

  const uf = tenant?.estado;
  if (!uf) return [];

  const { data: ibgeCities } = await supabase
    .from("ibge_cidades")
    .select("nome")
    .eq("uf", uf)
    .order("nome")
    .limit(limit);

  return (ibgeCities || []).map((c: any) => ({
    id: null,
    nome: c.nome,
    source: "ibge" as const,
  }));
}

// =====================================================
// EVENT REGISTRATION FLOW HANDLER (via WhatsApp)
// =====================================================
async function handleEventRegistrationStep(
  supabase: any,
  session: any,
  phone: string,
  userMessage: string,
  tenantId: string,
  provider: string | undefined,
  startTime: number
): Promise<any | null> {
  const { data: intSettings } = await supabase
    .from("integrations_settings")
    .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_api_version, whatsapp_provider_active")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();

  const normalizedInput = userMessage.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const state = session.event_reg_state;

  // Allow cancellation at any step
  if (["CANCELAR", "SAIR", "VOLTAR", "CANCEL"].includes(normalizedInput)) {
    await supabase.from("whatsapp_chatbot_sessions").update({
      event_reg_state: null, event_reg_event_id: null, event_reg_nome: null,
      event_reg_email: null, event_reg_cidade_id: null, event_reg_data_nascimento: null, event_reg_endereco: null,
    }).eq("id", session.id);
    const msg = "Inscrição cancelada. ❌\n\nSe quiser se inscrever depois, é só digitar *EVENTO* novamente!";
    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logEventReg(supabase, phone, userMessage, msg, "event_reg_cancelled", tenantId, startTime);
    return { success: true, responseType: "event_reg_cancelled" };
  }

  // State: selecting_event
  if (state === "selecting_event") {
    const num = parseInt(userMessage.trim());

    // Fetch active/published events to validate selection
    const { data: events } = await supabase
      .from("events")
      .select("id, name, date, time, location, address, status")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "published"])
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true })
      .limit(10);

    if (!events || events.length === 0 || isNaN(num) || num < 1 || num > events.length) {
      const msg = `Por favor, digite o *número* do evento desejado (1 a ${events?.length || '?'}).`;
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logEventReg(supabase, phone, userMessage, msg, "event_reg_retry_select", tenantId, startTime);
      return { success: true, responseType: "event_reg_retry_select" };
    }

    const selectedEvent = events[num - 1];

    // ── Check if user is already registered for this event ──
    const normalizedPhone = phone.replace(/\D/g, "");
    const phoneVariants = [normalizedPhone];
    if (normalizedPhone.startsWith("55") && normalizedPhone.length >= 12) {
      phoneVariants.push(normalizedPhone.slice(2)); // without country code
    }

    const { data: existingReg } = await supabase
      .from("event_registrations")
      .select("id, nome, qr_code")
      .eq("event_id", selectedEvent.id)
      .eq("tenant_id", tenantId)
      .or(phoneVariants.map(p => `whatsapp.ilike.%${p}%`).join(","))
      .limit(1);

    if (existingReg && existingReg.length > 0) {
      const reg = existingReg[0];
      const msg = `⚠️ Você já está inscrito(a) neste evento!\n\n📅 *${selectedEvent.name}*\n👤 Nome: *${reg.nome}*\n\nSeu QR Code de check-in já foi enviado anteriormente. Se precisar de ajuda, digite *AJUDA*.`;
      
      // Clear session state
      await supabase.from("whatsapp_chatbot_sessions").update({
        event_reg_state: null,
        event_reg_event_id: null,
      }).eq("id", session.id);
      
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logEventReg(supabase, phone, userMessage, msg, "event_reg_already_registered", tenantId, startTime);
      return { success: true, responseType: "event_reg_already_registered" };
    }

    await supabase.from("whatsapp_chatbot_sessions").update({
      event_reg_event_id: selectedEvent.id,
      event_reg_state: "collecting_evt_name",
    }).eq("id", session.id);

    const eventDate = new Date(selectedEvent.date + "T00:00:00").toLocaleDateString("pt-BR");
    const msg = `Ótimo! Você escolheu:\n\n📅 *${selectedEvent.name}*\n🗓️ ${eventDate} às ${selectedEvent.time}\n📍 ${selectedEvent.location}\n\nVamos fazer sua inscrição! 📝\n\nPor favor, me diga seu *nome completo*:`;
    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logEventReg(supabase, phone, userMessage, msg, "event_reg_event_selected", tenantId, startTime);
    return { success: true, responseType: "event_reg_event_selected" };
  }

  // State: collecting_evt_name
  if (state === "collecting_evt_name") {
    if (userMessage.length < 3 || userMessage.length > 100) {
      const msg = "Por favor, digite seu *nome completo* (mínimo 3 caracteres):";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logEventReg(supabase, phone, userMessage, msg, "event_reg_retry_name", tenantId, startTime);
      return { success: true, responseType: "event_reg_retry_name" };
    }

    await supabase.from("whatsapp_chatbot_sessions").update({
      event_reg_nome: userMessage.trim(),
      event_reg_state: "collecting_evt_email",
    }).eq("id", session.id);

    const msg = `Obrigado, *${userMessage.trim().split(" ")[0]}*! 😊\n\nAgora, qual seu *e-mail*?`;
    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logEventReg(supabase, phone, userMessage, msg, "event_reg_name_collected", tenantId, startTime);
    return { success: true, responseType: "event_reg_name_collected" };
  }

  // State: collecting_evt_email
  if (state === "collecting_evt_email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userMessage.trim())) {
      const msg = "Hmm, esse e-mail não parece válido. 🤔\n\nPor favor, digite um *e-mail válido* (ex: seunome@email.com):";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logEventReg(supabase, phone, userMessage, msg, "event_reg_retry_email", tenantId, startTime);
      return { success: true, responseType: "event_reg_retry_email" };
    }
    const email = userMessage.trim().toLowerCase();

    await supabase.from("whatsapp_chatbot_sessions").update({
      event_reg_email: email,
      event_reg_state: "collecting_evt_birthday",
    }).eq("id", session.id);

    const msg = `E-mail registrado! 👍\n\nQual sua *data de nascimento*? (formato: DD/MM/AAAA)`;
    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logEventReg(supabase, phone, userMessage, msg, "event_reg_email_collected", tenantId, startTime);
    return { success: true, responseType: "event_reg_email_collected" };
  }

  // State: collecting_evt_birthday
  if (state === "collecting_evt_birthday") {
    // Try to parse DD/MM/YYYY
    const dateMatch = userMessage.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!dateMatch) {
      const msg = "Formato inválido. 🤔 Digite sua *data de nascimento* no formato *DD/MM/AAAA* (ex: 15/03/1990):";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logEventReg(supabase, phone, userMessage, msg, "event_reg_retry_birthday", tenantId, startTime);
      return { success: true, responseType: "event_reg_retry_birthday" };
    }
    const [, day, month, year] = dateMatch;
    const dataNascimento = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    await supabase.from("whatsapp_chatbot_sessions").update({
      event_reg_data_nascimento: dataNascimento,
      event_reg_state: "collecting_evt_city",
    }).eq("id", session.id);

    const cityOptions = await getEventRegistrationCityOptions(supabase, tenantId, 30);

    let msg = `${dataNascimento ? "Data registrada!" : "Tudo bem!"} 👍\n\nEm qual *cidade/região* você mora?`;
    if (cityOptions.length > 0) {
      msg += `\n\n*Cidades cadastradas:*\n${formatCityOptionsList(cityOptions)}`;
      msg += `\n\nResponda apenas com o *número* da cidade/região.`;
    } else {
      msg += "\n\nNo momento não há cidades/regiões disponíveis para seleção. Tente novamente digitando *EVENTO* em instantes.";
    }
    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logEventReg(supabase, phone, userMessage, msg, "event_reg_birthday_collected", tenantId, startTime);
    return { success: true, responseType: "event_reg_birthday_collected" };
  }

  // State: collecting_evt_city
  if (state === "collecting_evt_city") {
    let cidadeId: string | null = null;
    let cidadeNomeSelecionada: string | null = null;
    const cityOptions = await getEventRegistrationCityOptions(supabase, tenantId, 30);
    const trimmed = userMessage.trim();

    if (cityOptions.length === 0) {
      const retryMsg = "No momento não há cidades/regiões disponíveis para seleção. Tente novamente digitando *EVENTO* em instantes.";
      await sendResponseToUser(supabase, intSettings, provider, phone, retryMsg);
      await logEventReg(supabase, phone, userMessage, retryMsg, "event_reg_retry_city", tenantId, startTime);
      return { success: true, responseType: "event_reg_retry_city" };
    }

    if (!/^\d+$/.test(trimmed)) {
      const retryMsg = `Por favor, responda apenas com o *número* da cidade/região da lista. 🙏\n\n*Cidades cadastradas:*\n${formatCityOptionsList(cityOptions)}`;
      await sendResponseToUser(supabase, intSettings, provider, phone, retryMsg);
      await logEventReg(supabase, phone, userMessage, retryMsg, "event_reg_retry_city", tenantId, startTime);
      return { success: true, responseType: "event_reg_retry_city" };
    }

    {
      const selectedNumber = Number.parseInt(trimmed, 10);

      const selectedByNumber = Number.isNaN(selectedNumber)
        ? null
        : cityOptions[selectedNumber - 1] || null;

      if (selectedByNumber) {
        cidadeId = selectedByNumber.id;
        cidadeNomeSelecionada = selectedByNumber.nome;
      } else {
        let retryMsg = "Por favor, responda apenas com o *número* da cidade/região da lista. 🙏\n\n";
        if (cityOptions.length > 0) {
          retryMsg += `*Cidades cadastradas:*\n${formatCityOptionsList(cityOptions)}`;
        } else {
          retryMsg += "Nenhuma cidade cadastrada no momento.";
        }

        await sendResponseToUser(supabase, intSettings, provider, phone, retryMsg);
        await logEventReg(supabase, phone, userMessage, retryMsg, "event_reg_retry_city", tenantId, startTime);
        return { success: true, responseType: "event_reg_retry_city" };
      }
    }

    // Now we have all data — perform the registration
    const updatedSession = {
      ...session,
      event_reg_cidade_id: cidadeId,
      event_reg_nome: session.event_reg_nome,
      event_reg_email: session.event_reg_email,
      event_reg_data_nascimento: session.event_reg_data_nascimento,
      event_reg_event_id: session.event_reg_event_id,
    };

    // Normalize phone for registration
    const phoneNorm = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

    // Call create_event_registration RPC
    try {
      const { data: regResult, error: regError } = await supabase.rpc('create_event_registration', {
        _event_id: updatedSession.event_reg_event_id,
        _nome: updatedSession.event_reg_nome,
        _email: updatedSession.event_reg_email || 'whatsapp@evento.com',
        _whatsapp: phoneNorm,
        _cidade_id: cidadeId || null,
        _data_nascimento: updatedSession.event_reg_data_nascimento || null,
        _endereco: null,
        _leader_id: null,
        _utm_source: 'whatsapp',
        _utm_medium: 'chatbot',
        _utm_campaign: null,
        _utm_content: null,
      });

      if (regError) {
        console.error("[whatsapp-chatbot] Event registration error:", regError);
        const msg = `Ops, ocorreu um erro na inscrição: ${regError.message}\n\nTente novamente digitando *EVENTO*.`;
        await sendResponseToUser(supabase, intSettings, provider, phone, msg);
        await supabase.from("whatsapp_chatbot_sessions").update({
          event_reg_state: null, event_reg_event_id: null, event_reg_nome: null,
          event_reg_email: null, event_reg_cidade_id: null, event_reg_data_nascimento: null,
        }).eq("id", session.id);
        await logEventReg(supabase, phone, userMessage, msg, "event_reg_error", tenantId, startTime);
        return { success: true, responseType: "event_reg_error" };
      }

      const resultRow = Array.isArray(regResult) ? regResult[0] : regResult;
      const registrationId = resultRow?.id || resultRow?.registration_id || null;
      const qrCode = resultRow?.qr_code;

      if (registrationId && !cidadeId && cidadeNomeSelecionada) {
        await supabase
          .from("event_registrations")
          .update({ localidade: cidadeNomeSelecionada })
          .eq("id", registrationId);
      }

      // Fetch event details for confirmation message
      const { data: eventData } = await supabase
        .from("events")
        .select("name, date, time, location, address")
        .eq("id", updatedSession.event_reg_event_id)
        .single();

      const eventDate = eventData ? new Date(eventData.date + "T00:00:00").toLocaleDateString("pt-BR") : "";
      const firstName = (updatedSession.event_reg_nome || "").split(" ")[0];

      // Build success message
      let msg = `✅ *Inscrição Confirmada!*\n\n`;
      msg += `👤 ${updatedSession.event_reg_nome}\n`;
      if (eventData) {
        msg += `📅 *${eventData.name}*\n`;
        msg += `🗓️ ${eventDate} às ${eventData.time}\n`;
        msg += `📍 ${eventData.location}\n`;
        if (eventData.address) msg += `🏠 ${eventData.address}\n`;
      }
      msg += `\n🎫 Seu QR Code de entrada será enviado em seguida. Apresente-o na chegada para fazer o check-in!\n`;
      msg += `\n${firstName}, esperamos você lá! 🎉`;

      await sendResponseToUser(supabase, intSettings, provider, phone, msg);

      // Send QR Code image
      if (qrCode) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const baseUrl = Deno.env.get("APP_BASE_URL") || "https://app.eleitor360.ai";
        const checkInUrl = `${baseUrl}/checkin/${qrCode}`;
        const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(checkInUrl)}`;

        // Wait a bit to ensure first message is delivered
        await sleep(2000);

        // Send QR code as image
        const useMetaCloud = provider === 'meta_cloud' ||
          (provider !== 'zapi' && intSettings?.whatsapp_provider_active === 'meta_cloud');

        if (!useMetaCloud && intSettings?.zapi_enabled && intSettings.zapi_instance_id && intSettings.zapi_token) {
          // Z-API: send image directly
          const zapiImageUrl = `https://api.z-api.io/instances/${intSettings.zapi_instance_id}/token/${intSettings.zapi_token}/send-image`;
          try {
            await fetch(zapiImageUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(intSettings.zapi_client_token && { "Client-Token": intSettings.zapi_client_token }),
              },
              body: JSON.stringify({
                phone: phone.replace(/[^0-9]/g, ""),
                image: qrCodeImageUrl,
                caption: "🎫 QR Code para Check-in no Evento",
              }),
            });
            console.log("[whatsapp-chatbot] QR code image sent via Z-API");
          } catch (imgErr) {
            console.error("[whatsapp-chatbot] Error sending QR image via Z-API:", imgErr);
            // Fallback: send as link
            await sendResponseToUser(supabase, intSettings, provider, phone,
              `🎫 *Seu QR Code:*\n${checkInUrl}`);
          }
        } else if (useMetaCloud && intSettings?.meta_cloud_enabled && intSettings.meta_cloud_phone_number_id) {
          // Meta Cloud: send image via API
          const metaAccessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
          if (metaAccessToken) {
            const apiVersion = intSettings.meta_cloud_api_version || "v20.0";
            const graphUrl = `https://graph.facebook.com/${apiVersion}/${intSettings.meta_cloud_phone_number_id}/messages`;
            let cleanPhone = phone.replace(/[^0-9]/g, "");
            if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
              cleanPhone = "55" + cleanPhone;
            }
            try {
              await fetch(graphUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${metaAccessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: cleanPhone,
                  type: "image",
                  image: {
                    link: qrCodeImageUrl,
                    caption: "🎫 QR Code para Check-in no Evento",
                  },
                }),
              });
              console.log("[whatsapp-chatbot] QR code image sent via Meta Cloud");
            } catch (imgErr) {
              console.error("[whatsapp-chatbot] Error sending QR image via Meta Cloud:", imgErr);
              await sendResponseToUser(supabase, intSettings, provider, phone,
                `🎫 *Seu QR Code:*\n${checkInUrl}`);
            }
          } else {
            await sendResponseToUser(supabase, intSettings, provider, phone,
              `🎫 *Seu QR Code:*\n${checkInUrl}`);
          }
        } else {
          // No image capability, send link
          await sendResponseToUser(supabase, intSettings, provider, phone,
            `🎫 *Seu QR Code:*\n${checkInUrl}`);
        }
      }

      // Clean up session state
      await supabase.from("whatsapp_chatbot_sessions").update({
        event_reg_state: null, event_reg_event_id: null, event_reg_nome: null,
        event_reg_email: null, event_reg_cidade_id: null, event_reg_data_nascimento: null,
      }).eq("id", session.id);

      await logEventReg(supabase, phone, userMessage, msg, "event_reg_completed", tenantId, startTime);
      console.log(`[whatsapp-chatbot] Event registration completed for ${phone}`);
      return { success: true, responseType: "event_reg_completed" };

    } catch (err) {
      console.error("[whatsapp-chatbot] Event registration exception:", err);
      const msg = "Ops, ocorreu um erro inesperado. 😔 Tente novamente digitando *EVENTO*.";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await supabase.from("whatsapp_chatbot_sessions").update({
        event_reg_state: null, event_reg_event_id: null, event_reg_nome: null,
        event_reg_email: null, event_reg_cidade_id: null, event_reg_data_nascimento: null,
      }).eq("id", session.id);
      await logEventReg(supabase, phone, userMessage, msg, "event_reg_exception", tenantId, startTime);
      return { success: true, responseType: "event_reg_exception" };
    }
  }

  return null;
}

async function logEventReg(supabase: any, phone: string, msgIn: string, msgOut: string, type: string, tenantId: string, startTime: number) {
  await supabase.from("whatsapp_chatbot_logs").insert({
    leader_id: null, phone, message_in: msgIn, message_out: msgOut,
    keyword_matched: "EVENTO", response_type: type,
    processing_time_ms: Date.now() - startTime,
    tenant_id: tenantId,
  });
}

// Dynamic function implementations
const dynamicFunctions: Record<string, (supabase: any, leader: Leader, session?: any, tenantId?: string, phone?: string, provider?: string, intSettings?: any) => Promise<string | null>> = {

  // Mostra estatísticas da árvore do líder
  minha_arvore: async (supabase, leader) => {
    const { data, error } = await supabase.rpc("get_leader_tree_stats", {
      _leader_id: leader.id
    });

    const { data: leaderInfo } = await supabase
      .from("lideres")
      .select("parent_leader_id")
      .eq("id", leader.id)
      .single();

    let parentLeader = null;
    if (leaderInfo?.parent_leader_id) {
      const { data: parentData } = await supabase
        .from("lideres")
        .select("nome_completo, cadastros, pontuacao_total")
        .eq("id", leaderInfo.parent_leader_id)
        .eq("is_active", true)
        .single();
      parentLeader = parentData;
    }

    if (error || !data || data.length === 0) {
      return `Olá ${leader.nome_completo.split(" ")[0]}! 🌳\n\nSua rede ainda está começando. Compartilhe seu link de indicação para que novas pessoas se cadastrem!`;
    }

    const stats = data[0];
    let response = `Olá ${leader.nome_completo.split(" ")[0]}! 🌳\n\n`;
    response += `*Sua Rede de Lideranças*\n\n`;

    if (parentLeader) {
      response += `👆 *Seu Líder Superior:*\n`;
      response += `   ${parentLeader.nome_completo}\n`;
      response += `   📋 ${parentLeader.cadastros} cadastros | ⭐ ${parentLeader.pontuacao_total} pts\n\n`;
    }

    response += `👥 Líderes na sua árvore: ${stats.total_leaders || 0}\n`;
    response += `📋 Total de cadastros: ${stats.total_cadastros || 0}\n`;
    response += `⭐ Pontuação total: ${stats.total_pontos || 0}\n`;
    response += `📊 Subordinados diretos: ${stats.direct_subordinates || 0}\n`;

    if (stats.top_subordinate_name) {
      response += `\n🏆 *Top líder*: ${stats.top_subordinate_name} (${stats.top_subordinate_cadastros} cadastros)`;
    }

    response += `\n\nContinue crescendo! 🚀`;
    return response;
  },

  meus_cadastros: async (supabase, leader) => {
    const { data: contatos, error } = await supabase
      .from("office_contacts")
      .select("nome, created_at, is_verified, cidade:office_cities(nome)")
      .eq("source_type", "lider")
      .eq("source_id", leader.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    let response = `Olá ${leader.nome_completo.split(" ")[0]}! 📋\n\n`;
    response += `*Seus Cadastros*\n`;
    response += `Total: ${leader.cadastros}\n\n`;

    if (!contatos || contatos.length === 0) {
      response += `Você ainda não tem cadastros. Compartilhe seu link de indicação para que novas pessoas se cadastrem através dele!`;
    } else {
      response += `*Últimos cadastros:*\n`;
      contatos.forEach((c: any, i: number) => {
        const cidade = Array.isArray(c.cidade) ? c.cidade[0] : c.cidade;
        const verificado = c.is_verified ? "✅" : "⏳";
        response += `${i + 1}. ${c.nome} ${verificado}\n`;
        if (cidade?.nome) response += `   📍 ${cidade.nome}\n`;
      });
    }

    return response;
  },

  minha_pontuacao: async (supabase, leader) => {
    const pontos = leader.pontuacao_total || 0;
    let nivel = "Bronze 🥉";
    let proximoNivel = "Prata";
    let pontosProximo = 11 - pontos;

    if (pontos >= 51) {
      nivel = "Diamante 💎";
      proximoNivel = "";
      pontosProximo = 0;
    } else if (pontos >= 31) {
      nivel = "Ouro 🥇";
      proximoNivel = "Diamante";
      pontosProximo = 51 - pontos;
    } else if (pontos >= 11) {
      nivel = "Prata 🥈";
      proximoNivel = "Ouro";
      pontosProximo = 31 - pontos;
    }

    let response = `Olá ${leader.nome_completo.split(" ")[0]}! ⭐\n\n`;
    response += `*Sua Pontuação*\n\n`;
    response += `🏆 Nível: ${nivel}\n`;
    response += `⭐ Pontos: ${pontos}\n`;
    response += `📋 Cadastros: ${leader.cadastros}\n`;

    if (proximoNivel) {
      response += `\n📈 Faltam ${pontosProximo} pontos para ${proximoNivel}!`;
    } else {
      response += `\n🎉 Parabéns! Você está no nível máximo!`;
    }

    return response;
  },

  minha_posicao: async (supabase, leader) => {
    const { data, error } = await supabase.rpc("get_leader_ranking_position", {
      _leader_id: leader.id
    });

    if (error || !data || data.length === 0) {
      return `Olá ${leader.nome_completo.split(" ")[0]}! Não consegui buscar sua posição no ranking.`;
    }

    const ranking = data[0];
    let emoji = "📊";
    if (ranking.ranking_position === 1) emoji = "🥇";
    else if (ranking.ranking_position === 2) emoji = "🥈";
    else if (ranking.ranking_position === 3) emoji = "🥉";
    else if (ranking.ranking_position <= 10) emoji = "🏆";

    let response = `Olá ${leader.nome_completo.split(" ")[0]}! ${emoji}\n\n`;
    response += `*Seu Ranking*\n\n`;
    response += `📍 Posição: ${ranking.ranking_position}º de ${ranking.total_leaders}\n`;
    response += `⭐ Pontuação: ${ranking.pontuacao}\n`;
    response += `📈 Você está no top ${(100 - (ranking.percentile || 0)).toFixed(0)}%\n`;

    if (ranking.ranking_position > 1) {
      response += `\n💪 Continue indicando para subir no ranking!`;
    } else {
      response += `\n🎉 Você é o líder #1! Parabéns!`;
    }

    return response;
  },

  meus_subordinados: async (supabase, leader) => {
    const { data: subordinados, error } = await supabase
      .from("lideres")
      .select("nome_completo, cadastros, pontuacao_total")
      .eq("parent_leader_id", leader.id)
      .eq("is_active", true)
      .order("pontuacao_total", { ascending: false })
      .limit(10);

    let response = `Olá ${leader.nome_completo.split(" ")[0]}! 👥\n\n`;
    response += `*Sua Equipe Direta*\n\n`;

    if (!subordinados || subordinados.length === 0) {
      response += `Você não tem líderes subordinados ainda.\n`;
      response += `Convide pessoas para fazer parte da sua equipe!`;
    } else {
      subordinados.forEach((s: any, i: number) => {
        response += `${i + 1}. ${s.nome_completo}\n`;
        response += `   📋 ${s.cadastros} cadastros | ⭐ ${s.pontuacao_total} pts\n`;
      });
    }

    return response;
  },

  pendentes: async (supabase, leader) => {
    const { count: totalSubordinados } = await supabase
      .from("lideres")
      .select("id", { count: "exact", head: true })
      .eq("parent_leader_id", leader.id)
      .eq("is_active", true);

    const { data: subordinadosDiretos, error } = await supabase
      .from("lideres")
      .select("nome_completo, telefone, created_at")
      .eq("parent_leader_id", leader.id)
      .eq("is_active", true)
      .eq("is_verified", false)
      .order("created_at", { ascending: false })
      .limit(15);

    let response = `Olá ${leader.nome_completo.split(" ")[0]}! ⏳\n\n`;
    response += `*Líderes Pendentes de Verificação*\n\n`;

    if (!totalSubordinados || totalSubordinados === 0) {
      response += `📭 Você ainda não tem subordinados na sua rede.\n`;
      response += `\n💡 Comece a indicar líderes para expandir sua árvore! 🌱`;
    }
    else if (error || !subordinadosDiretos || subordinadosDiretos.length === 0) {
      response += `✅ Parabéns! Todos os seus ${totalSubordinados} subordinado(s) direto(s) já estão verificados.\n`;
      response += `\nContinue expandindo sua rede! 🚀`;
    }
    else {
      response += `📋 Encontrei ${subordinadosDiretos.length} de ${totalSubordinados} líder(es) aguardando verificação:\n\n`;
      subordinadosDiretos.forEach((s: any, i: number) => {
        const telefone = s.telefone ? s.telefone.slice(-4) : "----";
        response += `${i + 1}. ${s.nome_completo}\n`;
        response += `   📱 ***${telefone}\n`;
      });
      response += `\n💡 Entre em contato para que completem a verificação!`;
    }

    return response;
  },

  ajuda: async (supabase, leader) => {
    let response = `Olá ${leader.nome_completo.split(" ")[0]}! 🤖\n\n`;
    response += `*Comandos Disponíveis:*\n\n`;
    response += `📋 *CADASTROS* - Ver suas indicações\n`;
    response += `🌳 *ARVORE* - Ver sua rede completa\n`;
    response += `⭐ *PONTOS* - Ver sua pontuação\n`;
    response += `📊 *RANKING* - Ver sua posição\n`;
    response += `👥 *SUBORDINADOS* - Ver equipe direta\n`;
    response += `⏳ *PENDENTES* - Ver subordinados não verificados\n`;
    response += `📅 *EVENTO* - Inscrever-se em evento\n`;
    response += `❓ *AJUDA* - Ver esta lista\n`;
    response += `\nOu digite sua pergunta e tentarei ajudar! 😊`;

    return response;
  },

  // Cadastro em evento via WhatsApp — starts the multi-step flow
  cadastro_evento: async (supabase, leader, session, tenantId, phone, provider, intSettings) => {
    if (!tenantId || !session) return "Erro ao iniciar inscrição. Tente novamente.";

    // Fetch active/published upcoming events
    const { data: events } = await supabase
      .from("events")
      .select("id, name, date, time, location")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "published"])
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true })
      .limit(10);

    if (!events || events.length === 0) {
      return "📅 Não há eventos disponíveis para inscrição no momento.\n\nFique atento, em breve teremos novidades! 😊";
    }

    let msg = `📅 *Eventos Disponíveis para Inscrição:*\n\n`;
    events.forEach((ev: any, i: number) => {
      const eventDate = new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR");
      msg += `*${i + 1}.* ${ev.name}\n`;
      msg += `   🗓️ ${eventDate} às ${ev.time}\n`;
      msg += `   📍 ${ev.location}\n\n`;
    });
    msg += `Digite o *número* do evento para se inscrever.\nDigite *CANCELAR* para sair.`;

    // Set session state to selecting_event
    await supabase.from("whatsapp_chatbot_sessions").update({
      event_reg_state: "selecting_event",
    }).eq("id", session.id);

    return msg;
  }
};

// =====================================================
// HELPER: Send response via configured provider
// =====================================================
async function sendResponseToUser(
  supabase: any,
  integrationSettings: any,
  provider: string | undefined,
  phone: string,
  message: string
): Promise<boolean> {
  const useMetaCloud = provider === 'meta_cloud' ||
    (provider !== 'zapi' && integrationSettings?.whatsapp_provider_active === 'meta_cloud');

  if (useMetaCloud && integrationSettings?.meta_cloud_enabled && integrationSettings.meta_cloud_phone_number_id) {
    const metaAccessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
    if (metaAccessToken) {
      return await sendWhatsAppMessageMetaCloud(
        integrationSettings.meta_cloud_phone_number_id,
        integrationSettings.meta_cloud_api_version || "v20.0",
        metaAccessToken, phone, message, supabase
      );
    }
  }

  if (integrationSettings?.zapi_enabled && integrationSettings.zapi_instance_id && integrationSettings.zapi_token) {
    return await sendWhatsAppMessage(
      integrationSettings.zapi_instance_id, integrationSettings.zapi_token,
      integrationSettings.zapi_client_token, phone, message
    );
  }

  return false;
}

// =====================================================
// REGISTRATION FLOW HANDLER
// =====================================================
async function handleRegistrationStep(
  supabase: any,
  session: any,
  phone: string,
  userMessage: string,
  tenantId: string,
  provider: string | undefined,
  startTime: number
): Promise<any | null> {
  const { data: intSettings } = await supabase
    .from("integrations_settings")
    .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_api_version, whatsapp_provider_active")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();

  const normalizedInput = userMessage.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Strip punctuation for matching (e.g., "SIM, GOSTARIA" → "SIM GOSTARIA")
  const normalizedInputClean = normalizedInput.replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const state = session.registration_state;

  // State: awaiting_confirmation
  if (state === "awaiting_confirmation") {
    const positiveResponses = ["SIM", "S", "QUERO", "CLARO", "PODE SER", "ACEITO", "BORA", "VAMOS", "OK", "PODE", "CADASTRAR", "EU QUERO"];
    const isPositive = positiveResponses.some(r => normalizedInputClean === r || normalizedInputClean.startsWith(r + " "));

    if (isPositive) {
      const msg = "Ótimo! Vamos fazer seu cadastro rapidinho! 📝\n\nPor favor, me diga seu *nome completo*:";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await supabase.from("whatsapp_chatbot_sessions").update({ registration_state: "collecting_name" }).eq("id", session.id);
      await logRegistration(supabase, phone, userMessage, msg, "registration_confirm", tenantId, startTime);
      return { success: true, responseType: "registration_confirm" };
    } else {
      const msg = "Sem problemas! 😊 Se mudar de ideia, é só me dizer que quer se cadastrar.";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await supabase.from("whatsapp_chatbot_sessions").update({ registration_state: "declined", registration_completed_at: new Date().toISOString() }).eq("id", session.id);
      await logRegistration(supabase, phone, userMessage, msg, "registration_declined", tenantId, startTime);
      return { success: true, responseType: "registration_declined" };
    }
  }

  // State: collecting_name
  if (state === "collecting_name") {
    if (userMessage.length < 3 || userMessage.length > 100) {
      const msg = "Por favor, digite seu *nome completo* (mínimo 3 caracteres):";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logRegistration(supabase, phone, userMessage, msg, "registration_retry_name", tenantId, startTime);
      return { success: true, responseType: "registration_retry_name" };
    }

    await supabase.from("whatsapp_chatbot_sessions").update({ collected_name: userMessage, registration_state: "collecting_email" }).eq("id", session.id);
    const msg = `Obrigado, *${userMessage.split(" ")[0]}*! 😊\n\nAgora, qual seu *e-mail*? (Se preferir não informar, digite *PULAR*)`;
    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logRegistration(supabase, phone, userMessage, msg, "registration_name_collected", tenantId, startTime);
    return { success: true, responseType: "registration_name_collected" };
  }

  // State: collecting_email
  if (state === "collecting_email") {
    let email: string | null = null;
    const skipWords = ["PULAR", "NAO", "NAO TENHO", "NADA", "PULA", "SEM"];
    const isSkip = skipWords.some(w => normalizedInput === w || normalizedInput.startsWith(w + " "));

    if (!isSkip) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userMessage.trim())) {
        const msg = "Hmm, esse e-mail não parece válido. 🤔\n\nPor favor, digite um e-mail válido ou *PULAR* para continuar sem:";
        await sendResponseToUser(supabase, intSettings, provider, phone, msg);
        await logRegistration(supabase, phone, userMessage, msg, "registration_retry_email", tenantId, startTime);
        return { success: true, responseType: "registration_retry_email" };
      }
      email = userMessage.trim().toLowerCase();
    }

    await supabase.from("whatsapp_chatbot_sessions").update({ collected_email: email, registration_state: "collecting_city" }).eq("id", session.id);

    const { data: cities } = await supabase
      .from("office_cities")
      .select("nome")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("nome")
      .limit(30);

    let msg = `${email ? "E-mail registrado!" : "Tudo bem, sem problemas!"} 👍\n\nAgora, em qual *cidade* você mora?`;
    if (cities && cities.length > 0) {
      msg += `\n\nAlgumas opções:\n${cities.map((c: any) => `• ${c.nome}`).join("\n")}`;
      msg += `\n\nDigite o nome da sua cidade:`;
    }

    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logRegistration(supabase, phone, userMessage, msg, "registration_email_collected", tenantId, startTime);
    return { success: true, responseType: "registration_email_collected" };
  }

  // State: collecting_city
  if (state === "collecting_city") {
    if (userMessage.length < 2) {
      const msg = "Por favor, digite o nome da sua *cidade*:";
      await sendResponseToUser(supabase, intSettings, provider, phone, msg);
      await logRegistration(supabase, phone, userMessage, msg, "registration_retry_city", tenantId, startTime);
      return { success: true, responseType: "registration_retry_city" };
    }

    const { data: matchedCity } = await supabase
      .from("office_cities")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .ilike("nome", `%${userMessage.trim()}%`)
      .limit(1)
      .maybeSingle();

    await supabase.from("whatsapp_chatbot_sessions").update({
      collected_city: userMessage.trim(),
      registration_state: "completed",
      registration_completed_at: new Date().toISOString()
    }).eq("id", session.id);

    // Create/update contact in office_contacts
    const phoneNorm = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;

    // Search without tenant filter due to global unique constraint on telefone_norm
    const { data: existingContact } = await supabase
      .from("office_contacts")
      .select("id, tenant_id")
      .eq("telefone_norm", phoneNorm)
      .maybeSingle();

    if (existingContact) {
      const updateData: any = {
        nome: session.collected_name,
        source_type: "whatsapp",
        is_active: true,
        opted_out_at: null,
        opt_out_reason: null,
        opt_out_channel: null,
        // Always update city fields: use matched city or store as text
        cidade_id: matchedCity?.id || null,
        localidade: matchedCity ? matchedCity.nome : userMessage.trim(),
      };
      if (session.collected_email) updateData.email = session.collected_email;
      if (existingContact.tenant_id !== tenantId) {
        updateData.tenant_id = tenantId;
      }
      await supabase.from("office_contacts").update(updateData).eq("id", existingContact.id);
      console.log(`[whatsapp-chatbot] Updated existing contact ${existingContact.id} for ${phoneNorm}`);
    } else {
      const { error: insertError } = await supabase.from("office_contacts").insert({
        nome: session.collected_name,
        telefone_norm: phoneNorm,
        email: session.collected_email || null,
        cidade_id: matchedCity?.id || null,
        localidade: matchedCity ? matchedCity.nome : userMessage.trim(),
        source_type: "whatsapp",
        tenant_id: tenantId,
        is_active: true,
      });
      if (insertError) {
        console.error(`[whatsapp-chatbot] Error inserting contact:`, insertError);
      }
    }

    const cityName = matchedCity?.nome || userMessage.trim();
    const firstName = (session.collected_name || "").split(" ")[0];
    const msg = `Cadastro realizado com sucesso! 🎉\n\n` +
      `📋 *Seus dados:*\n` +
      `👤 Nome: ${session.collected_name}\n` +
      `📱 WhatsApp: ${phone}\n` +
      `${session.collected_email ? `📧 E-mail: ${session.collected_email}\n` : ""}` +
      `📍 Cidade: ${cityName}\n\n` +
      `Obrigado, ${firstName}! Agora você receberá informações e novidades que podem te ajudar. 😊`;

    await sendResponseToUser(supabase, intSettings, provider, phone, msg);
    await logRegistration(supabase, phone, userMessage, msg, "registration_completed", tenantId, startTime);

    console.log(`[whatsapp-chatbot] Registration completed for ${phone}: ${session.collected_name}`);
    return { success: true, responseType: "registration_completed" };
  }

  return null;
}

async function logRegistration(supabase: any, phone: string, msgIn: string, msgOut: string, type: string, tenantId: string, startTime: number) {
  await supabase.from("whatsapp_chatbot_logs").insert({
    leader_id: null, phone, message_in: msgIn, message_out: msgOut,
    keyword_matched: null, response_type: type,
    processing_time_ms: Date.now() - startTime,
    tenant_id: tenantId,
  });
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ChatbotRequest = await req.json();
    const { phone, messageId, provider, tenantId: requestTenantId } = body;

    // ── INPUT SANITIZATION ────────────────────────────────────────
    if (!phone || typeof phone !== 'string') {
      return new Response(JSON.stringify({ success: false, reason: "invalid_phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const message = sanitizeMessage(body.message || '');
    if (!message) {
      return new Response(JSON.stringify({ success: false, reason: "empty_message" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DEDUPLICATION: skip already-processed messageIds ─────────
    if (messageId) {
      const { data: isNew } = await supabase.rpc('check_and_record_message', {
        p_message_id: messageId,
        p_phone: phone,
        p_tenant_id: requestTenantId || null,
      });

      if (isNew === false) {
        console.log(`[whatsapp-chatbot] Duplicate messageId ${messageId} — skipping`);
        return new Response(JSON.stringify({ success: true, reason: "duplicate" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    console.log(`[whatsapp-chatbot] Received: phone=${phone}, message=${message.substring(0, 50)}, provider=${provider || 'auto'}, tenantId=${requestTenantId || 'auto'}`);

    // Normalize phone for lookup
    const normalizedPhone = normalizePhone(phone);
    const phoneWithoutPlus = normalizedPhone.replace(/^\+/, "");

    // Find leader by phone (try with +, without +, and original)
    const { data: leader, error: leaderError } = await supabase
      .from("lideres")
      .select("id, nome_completo, telefone, email, cadastros, pontuacao_total, cidade_id, is_coordinator, hierarchy_level, tenant_id")
      .or(`telefone.eq.${normalizedPhone},telefone.eq.${phoneWithoutPlus},telefone.eq.${phone}`)
      .eq("is_active", true)
      .limit(1)
      .single();

    const resolvedLeader = leaderError || !leader ? null : (leader as Leader);
    const tenantId = requestTenantId || resolvedLeader?.tenant_id;

    if (!tenantId) {
      console.log(`[whatsapp-chatbot] No tenant context available for phone ${phone}`);
      return new Response(
        JSON.stringify({ success: false, reason: "missing_tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (resolvedLeader) {
      console.log(`[whatsapp-chatbot] Found leader: ${resolvedLeader.nome_completo} (${resolvedLeader.id}), tenant: ${tenantId}`);
    } else {
      console.log(`[whatsapp-chatbot] No leader found for phone ${phone}, continuing as guest in tenant ${tenantId}`);
    }

    const actor: Leader | null = resolvedLeader;

    // =====================================================
    // SESSION TRACKING & REGISTRATION FLOW
    // =====================================================

    // Use upsert RPC for session management (handles expiry, activity update)
    const { data: sessionData } = await supabase.rpc('upsert_chatbot_session', {
      p_phone: normalizedPhone,
      p_tenant_id: tenantId,
    });

    let session = sessionData;

    // Fallback: if RPC unavailable, use direct query
    if (!session) {
      const { data: existingSession } = await supabase
        .from("whatsapp_chatbot_sessions")
        .select("*")
        .eq("phone", normalizedPhone)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      session = existingSession;
      if (!session) {
        const { data: newSession } = await supabase
          .from("whatsapp_chatbot_sessions")
          .insert({ phone: normalizedPhone, tenant_id: tenantId, first_message_at: new Date().toISOString() })
          .select()
          .single();
        session = newSession;
      } else {
        // Update last_activity_at
        await supabase
          .from("whatsapp_chatbot_sessions")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", session.id);
      }
    }

    // =====================================================
    // GLOBAL EXIT COMMAND — clears any active flow
    // =====================================================
    const normalizedMsgUpper = message.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (["SAIR", "CANCELAR", "CANCEL", "EXIT"].includes(normalizedMsgUpper)) {
      const hasActiveFlow = session?.registration_state || session?.event_reg_state;
      if (hasActiveFlow) {
        // Clear all flow states
        await supabase.from("whatsapp_chatbot_sessions").update({
          registration_state: null,
          event_reg_state: null,
          event_reg_event_id: null,
          event_reg_nome: null,
          event_reg_email: null,
          event_reg_cidade_id: null,
          event_reg_data_nascimento: null,
          event_reg_endereco: null,
        }).eq("id", session.id);

        const exitMsg = "✅ Você saiu do fluxo atual.\n\nSe precisar de algo, é só digitar:\n📋 *AJUDA* — ver comandos disponíveis\n📅 *EVENTO* — inscrever-se em eventos\n🤖 Ou envie qualquer pergunta!";
        await sendResponseToUser(supabase, intSettings, provider, normalizedPhone, exitMsg);
        return new Response(JSON.stringify({ success: true, responseType: "flow_exit" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Check if user is in a registration flow step
    if (session?.registration_state && !session.registration_completed_at) {
      const regResult = await handleRegistrationStep(
        supabase, session, normalizedPhone, message.trim(), tenantId, provider, startTime
      );
      if (regResult) {
        return new Response(JSON.stringify(regResult),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Check if user is in an EVENT registration flow step
    if (session?.event_reg_state) {
      const evtRegResult = await handleEventRegistrationStep(
        supabase, session, normalizedPhone, message.trim(), tenantId, provider, startTime
      );
      if (evtRegResult) {
        return new Response(JSON.stringify(evtRegResult),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Check chatbot configuration - filtered by tenant
    let configQuery = supabase
      .from("whatsapp_chatbot_config")
      .select("*");
    if (tenantId) configQuery = configQuery.eq("tenant_id", tenantId);

    const { data: config } = await configQuery.limit(1).single();

    const chatbotConfig = config as ChatbotConfig | null;

    if (!chatbotConfig?.is_enabled) {
      console.log("[whatsapp-chatbot] Chatbot is disabled");
      return new Response(
        JSON.stringify({ success: false, reason: "disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let rateLimitQuery = supabase
      .from("whatsapp_chatbot_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneHourAgo)
      .eq("phone", normalizedPhone);

    if (actor?.id) {
      rateLimitQuery = rateLimitQuery.eq("leader_id", actor.id);
    }

    if (tenantId) {
      rateLimitQuery = rateLimitQuery.eq("tenant_id", tenantId);
    }

    const { count: recentMessages } = await rateLimitQuery;

    if (recentMessages && recentMessages >= (chatbotConfig.max_messages_per_hour || 20)) {
      console.log(`[whatsapp-chatbot] Rate limit exceeded for ${actor?.id ? `leader ${actor.id}` : `phone ${normalizedPhone}`}`);
      return new Response(
        JSON.stringify({ success: false, reason: "rate_limit" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active keywords - filtered by tenant
    let keywordsQuery = supabase
      .from("whatsapp_chatbot_keywords")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (tenantId) keywordsQuery = keywordsQuery.eq("tenant_id", tenantId);

    const { data: keywords } = await keywordsQuery;

    const activeKeywords = (keywords as ChatbotKeyword[]) || [];

    // Try to match message with a keyword
    const normalizedMessage = normalizeTextForMatch(message.trim());
    const messageForKeywordMatch = sanitizeKeywordCandidate(normalizedMessage);
    const tokenCount = messageForKeywordMatch ? messageForKeywordMatch.split(" ").length : 0;
    const isCommandLikeMessage = tokenCount <= 5 || messageForKeywordMatch.length <= 35;

    // === INTERCEPT VERIFICATION CODES ===
    // First, check if the message matches any registered keyword - keywords take priority over verification codes
    const allKeywordNames = new Set<string>();
    for (const kw of activeKeywords) {
      allKeywordNames.add(normalizeTextForMatch(kw.keyword));
      if (kw.aliases) {
        for (const alias of kw.aliases) {
          allKeywordNames.add(normalizeTextForMatch(alias));
        }
      }
    }
    const isRegisteredKeyword = allKeywordNames.has(normalizedMessage);

    const confirmMatchChatbot = normalizedMessage.match(/^CONFIRMAR\s+([A-Z0-9]{5,6})$/);
    const bareCodeMatch = normalizedMessage.match(/^[A-Z0-9]{5,6}$/);

    if (confirmMatchChatbot || (bareCodeMatch && !isRegisteredKeyword && normalizedMessage !== "AJUDA" && normalizedMessage !== "PONTOS" && normalizedMessage !== "SIM")) {
      // Extra safety: skip common dynamic-function trigger words that look like verification codes
      const dynamicTriggerWords = new Set(["EVENTO", "PONTOS", "AJUDA", "ARVORE"]);
      if (bareCodeMatch && dynamicTriggerWords.has(normalizedMessage)) {
        console.log(`[whatsapp-chatbot] Skipping verification intercept for dynamic trigger word: ${normalizedMessage}`);
        // Fall through to keyword matching below
      } else {
      if (!actor) {
        console.log(`[whatsapp-chatbot] Verification code received from unknown phone ${normalizedPhone}`);
        return new Response(JSON.stringify({ success: false, reason: "leader_not_found_for_code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const code = confirmMatchChatbot ? confirmMatchChatbot[1] : bareCodeMatch![0];
      console.log(`[whatsapp-chatbot] Detected verification code: ${code} from leader ${actor.id}`);

      const { data: leaderVerificationStatus } = await supabase
        .from("lideres")
        .select("is_verified, verification_code")
        .eq("id", actor.id)
        .single();

      if (leaderVerificationStatus?.is_verified) {
        const responseAlready = `Olá ${actor.nome_completo.split(" ")[0]}! ✅\n\nSeu cadastro já foi verificado anteriormente. Você já pode usar todos os comandos disponíveis.\n\nDigite *AJUDA* para ver a lista de comandos.`;

        let intSettingsQuery = supabase
          .from("integrations_settings")
          .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_api_version, whatsapp_provider_active");
        if (tenantId) intSettingsQuery = intSettingsQuery.eq("tenant_id", tenantId);
        const { data: intSettings } = await intSettingsQuery.limit(1).single();

        const useMetaCloudForVerif = provider === 'meta_cloud' ||
          (provider !== 'zapi' && intSettings?.whatsapp_provider_active === 'meta_cloud');

        if (useMetaCloudForVerif && intSettings?.meta_cloud_enabled && intSettings.meta_cloud_phone_number_id) {
          const metaToken = Deno.env.get("META_WA_ACCESS_TOKEN");
          if (metaToken) await sendWhatsAppMessageMetaCloud(intSettings.meta_cloud_phone_number_id, intSettings.meta_cloud_api_version || "v20.0", metaToken, normalizedPhone, responseAlready, supabase);
        } else if (intSettings?.zapi_enabled && intSettings.zapi_instance_id && intSettings.zapi_token) {
          await sendWhatsAppMessage(intSettings.zapi_instance_id, intSettings.zapi_token, intSettings.zapi_client_token, normalizedPhone, responseAlready);
        }

        await supabase.from("whatsapp_chatbot_logs").insert({
          leader_id: actor.id, phone: normalizedPhone, message_in: message,
          message_out: responseAlready, keyword_matched: "CONFIRMAR", response_type: "verification_already",
          processing_time_ms: Date.now() - startTime,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        });

        return new Response(JSON.stringify({ success: true, responseType: "verification_already" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (leaderVerificationStatus?.verification_code && leaderVerificationStatus.verification_code !== code) {
        const responseWrongCode = `Olá ${actor.nome_completo.split(" ")[0]}! ⚠️\n\nEsse código não pertence ao seu número de telefone. Por favor, utilize o código que foi enviado para você.`;

        let intSettingsQuery = supabase
          .from("integrations_settings")
          .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_api_version, whatsapp_provider_active");
        if (tenantId) intSettingsQuery = intSettingsQuery.eq("tenant_id", tenantId);
        const { data: intSettings } = await intSettingsQuery.limit(1).single();

        const useMetaCloudForVerif = provider === 'meta_cloud' ||
          (provider !== 'zapi' && intSettings?.whatsapp_provider_active === 'meta_cloud');

        if (useMetaCloudForVerif && intSettings?.meta_cloud_enabled && intSettings.meta_cloud_phone_number_id) {
          const metaToken = Deno.env.get("META_WA_ACCESS_TOKEN");
          if (metaToken) await sendWhatsAppMessageMetaCloud(intSettings.meta_cloud_phone_number_id, intSettings.meta_cloud_api_version || "v20.0", metaToken, normalizedPhone, responseWrongCode, supabase);
        } else if (intSettings?.zapi_enabled && intSettings.zapi_instance_id && intSettings.zapi_token) {
          await sendWhatsAppMessage(intSettings.zapi_instance_id, intSettings.zapi_token, intSettings.zapi_client_token, normalizedPhone, responseWrongCode);
        }

        await supabase.from("whatsapp_chatbot_logs").insert({
          leader_id: actor.id, phone: normalizedPhone, message_in: message,
          message_out: responseWrongCode, keyword_matched: "CONFIRMAR", response_type: "verification_wrong_code",
          processing_time_ms: Date.now() - startTime,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        });

        return new Response(JSON.stringify({ success: true, responseType: "verification_wrong_code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[whatsapp-chatbot] Code matches leader, deferring to verification flow`);
      return new Response(JSON.stringify({ success: false, reason: "deferred_to_verification" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // =====================================================
    // FLOW-BASED EXECUTION ENGINE
    // Load published flows and use as primary routing
    // =====================================================
    let matchedFlowId: string | null = null;
    let matchedFlowName: string | null = null;

    // Load all published flows for this tenant
    const { data: publishedFlows } = await supabase
      .from("whatsapp_chatbot_flows")
      .select("id, name, nodes, edges, is_active, is_published")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("is_published", true);

    const flows = (publishedFlows || []) as Array<{
      id: string;
      name: string;
      nodes: Array<{ id: string; type: string; data: Record<string, any> }>;
      edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; label?: string }>;
      is_active: boolean;
      is_published: boolean;
    }>;

    console.log(`[whatsapp-chatbot] [FLUXOS] Loaded ${flows.length} published flows for tenant ${tenantId}`);

    // ── FLOW MATCHING: find the right flow for this message ──
    // Priority 1: Keyword flows (match against keyword nodes)
    // Priority 2: AI/fallback flow (any_message trigger)
    let matchedKeyword: ChatbotKeyword | null = null;
    let flowMatchedKeyword = false;

    // First try keyword matching via flows
    for (const flow of flows) {
      if (!flow.nodes || !Array.isArray(flow.nodes)) continue;

      // Find keyword nodes in this flow
      const keywordNodes = flow.nodes.filter((n: any) => n.type === "keyword");
      for (const kwNode of keywordNodes) {
        const kwData = kwNode.data || {};
        const keyword = kwData.keyword || "";
        const aliases = kwData.aliases || [];
        if (!keyword) continue;

        const keywordNorm = normalizeTextForMatch(keyword);
        const aliasesNorm = (aliases as string[]).map(normalizeTextForMatch);

        if (isKeywordMatch(messageForKeywordMatch, keywordNorm, aliasesNorm, isCommandLikeMessage)) {
          matchedFlowId = flow.id;
          matchedFlowName = flow.name;
          flowMatchedKeyword = true;
          console.log(`[whatsapp-chatbot] [FLUXOS] Matched flow "${flow.name}" via keyword "${keyword}"`);
          break;
        }
      }

      // Also check trigger nodes with keyword type
      if (!flowMatchedKeyword) {
        const triggerNodes = flow.nodes.filter((n: any) => n.type === "trigger" && n.data?.triggerType === "keyword");
        for (const trigNode of triggerNodes) {
          const trigKeyword = trigNode.data?.keyword || "";
          if (!trigKeyword) continue;
          const keywordNorm = normalizeTextForMatch(trigKeyword);
          if (isKeywordMatch(messageForKeywordMatch, keywordNorm, [], isCommandLikeMessage)) {
            matchedFlowId = flow.id;
            matchedFlowName = flow.name;
            flowMatchedKeyword = true;
            console.log(`[whatsapp-chatbot] [FLUXOS] Matched flow "${flow.name}" via trigger keyword "${trigKeyword}"`);
            break;
          }
        }
      }

      if (flowMatchedKeyword) break;
    }

    // Also try matching via legacy keywords table (backwards compatibility)
    for (const kw of activeKeywords) {
      const keywordNorm = normalizeTextForMatch(kw.keyword);
      const aliasesNorm = (kw.aliases || []).map(normalizeTextForMatch);

      if (isKeywordMatch(messageForKeywordMatch, keywordNorm, aliasesNorm, isCommandLikeMessage)) {
        matchedKeyword = kw;
        if (!matchedFlowId) {
          // Try to find a flow that matches this keyword name
          const matchingFlow = flows.find(f => {
            return f.nodes?.some((n: any) =>
              (n.type === "keyword" && normalizeTextForMatch(n.data?.keyword || "") === keywordNorm) ||
              (n.type === "automation" && n.data?.automationFunction === kw.dynamic_function)
            );
          });
          if (matchingFlow) {
            matchedFlowId = matchingFlow.id;
            matchedFlowName = matchingFlow.name;
          }
        }
        break;
      }
    }

    // If no keyword matched, find AI/fallback flow
    if (!matchedKeyword && !flowMatchedKeyword) {
      const aiFlow = flows.find(f =>
        f.nodes?.some((n: any) =>
          n.type === "trigger" && n.data?.triggerType === "any_message"
        ) &&
        f.nodes?.some((n: any) => n.type === "ai_response")
      );
      if (aiFlow) {
        matchedFlowId = aiFlow.id;
        matchedFlowName = aiFlow.name;
        console.log(`[whatsapp-chatbot] [FLUXOS] Using AI fallback flow "${aiFlow.name}"`);
      }

      // Check for the specific "Saudação IA" flow
      const greetingFlow = flows.find(f => f.name?.includes("Saudação IA"));
      if (greetingFlow) {
        matchedFlowId = greetingFlow.id;
        matchedFlowName = greetingFlow.name;
        console.log(`[whatsapp-chatbot] [FLUXOS] Using Saudação IA flow "${greetingFlow.name}"`);
      }
    }

    // Update flow execution count
    if (matchedFlowId) {
      try {
        await supabase.rpc('increment_counter', { row_id: matchedFlowId, table_name: 'whatsapp_chatbot_flows', column_name: 'execution_count' })
          .then(() => {}).catch(() => {
            // Fallback: direct update if RPC doesn't exist
            supabase.from("whatsapp_chatbot_flows")
              .update({ execution_count: supabase.rpc ? undefined : 1 })
              .eq("id", matchedFlowId)
              .then(() => {}).catch(() => {});
          });
      } catch { /* ignore counter update failures */ }
    }

    let responseMessage = "";
    let responseType = "unknown";

    if (matchedKeyword) {
      // ============================================================
      // MODO AUTOMAÇÃO: palavra-chave encontrada → segue a trilha
      // Processado via fluxo: ${matchedFlowName || 'legado'}
      // ============================================================
      console.log(`[whatsapp-chatbot] [FLUXO: ${matchedFlowName || 'legado'}] [AUTOMAÇÃO] Matched keyword: ${matchedKeyword.keyword} (${matchedKeyword.response_type})`);
      responseType = matchedKeyword.response_type;

      // Mark keyword activation timestamp on the session
      if (session?.id) {
        await supabase.from("whatsapp_chatbot_sessions").update({
          last_keyword_at: new Date().toISOString(),
        }).eq("id", session.id);
      }

      if (matchedKeyword.response_type === "static" && matchedKeyword.static_response) {
        responseMessage = matchedKeyword.static_response
          .replace("{{nome}}", getFirstName(actor))
          .replace("{{nome_completo}}", actor?.nome_completo || "Visitante")
          .replace("{{pontos}}", String(actor?.pontuacao_total || 0))
          .replace("{{cadastros}}", String(actor?.cadastros || 0));

      } else if (matchedKeyword.response_type === "dynamic" && matchedKeyword.dynamic_function) {
        // Dynamic functions that work for everyone (leaders + guests)
        const guestAllowedFunctions = ["cadastro_evento", "ajuda"];
        const fnName = matchedKeyword.dynamic_function;
        const fn = dynamicFunctions[fnName];

        if (!fn) {
          responseType = "fallback";
          responseMessage = `Essa função (*${fnName}*) não está disponível no momento. Digite *AJUDA* para ver os comandos disponíveis.`;
        } else if (guestAllowedFunctions.includes(fnName)) {
          // Functions that work without being a leader
          const result = await fn(supabase, actor as any, session, tenantId, normalizedPhone, provider, null);
          responseMessage = result || "Função não disponível no momento.";
        } else if (actor) {
          // Leader-only functions
          const result = await fn(supabase, actor);
          responseMessage = result || "Não foi possível obter os dados solicitados. Tente novamente.";
        } else {
          // Guest trying a leader-only function
          responseType = "fallback";
          responseMessage = `Esse comando é exclusivo para líderes cadastrados. 😊\n\nSe você tiver dúvidas, pode me fazer uma pergunta diretamente que tentarei ajudar!`;
        }

      } else if (matchedKeyword.response_type === "ai") {
        if (lovableApiKey) {
          responseMessage = await generateAIResponse(
            lovableApiKey,
            message,
            actor,
            matchedKeyword.description || "",
            chatbotConfig.ai_system_prompt || "",
            supabase,
            tenantId,
            session?.conversation_history
          );
        } else {
          responseMessage = chatbotConfig.fallback_message || "Não consegui processar sua mensagem.";
        }
      }

    } else {
      // ============================================================
      // MODO INTELIGENTE: pergunta aberta → IA + Base de Conhecimento + Perplexity
      // Processado via fluxo: ${matchedFlowName || 'Saudação IA'}
      // ============================================================

      // Check keyword cooldown
      const lastKeywordAt = session?.last_keyword_at ? new Date(session.last_keyword_at).getTime() : 0;
      const cooldownActive = lastKeywordAt > 0 && (Date.now() - lastKeywordAt) < KEYWORD_COOLDOWN_MINUTES * 60 * 1000;

      if (cooldownActive) {
        console.log(`[whatsapp-chatbot] [FLUXO: ${matchedFlowName || 'Saudação IA'}] Keyword cooldown active (${KEYWORD_COOLDOWN_MINUTES}min). Ignoring free-text AI.`);
        responseType = "cooldown_hint";
        responseMessage = "Não entendi. 🤔\n\nDigite *AJUDA* para ver a lista de comandos disponíveis ou aguarde alguns minutos para fazer uma pergunta aberta.";
      } else if (isEventRegistrationStatusIntent(message)) {
        console.log(`[whatsapp-chatbot] [FLUXO: ${matchedFlowName || 'Inscrição em Evento'}] Event registration status intent detected`);
        responseType = "event_reg_status";
        responseMessage = await getEventRegistrationStatusResponse(supabase, tenantId, normalizedPhone);
      } else {
        console.log(`[whatsapp-chatbot] [FLUXO: ${matchedFlowName || 'Saudação IA'}] [IA] No keyword match — using AI + KB + Perplexity pipeline`);
        responseType = "ai";

        if (lovableApiKey) {
          responseMessage = await generateAIResponse(
            lovableApiKey,
            message,
            actor,
            "",
            chatbotConfig.ai_system_prompt || "",
            supabase,
            tenantId,
            session?.conversation_history
          );
        } else {
          responseType = "fallback";
          responseMessage = chatbotConfig.fallback_message ||
            `${actor ? `Olá ${getFirstName(actor)}!` : "Olá!"} Posso ajudar com informações sobre o mandato. Faça sua pergunta! 😊`;
        }
      }
    }

    // Send response - decide provider (filtered by tenant)
    let intSettingsQuery = supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, meta_cloud_enabled, meta_cloud_phone_number_id, meta_cloud_api_version, whatsapp_provider_active");
    if (tenantId) intSettingsQuery = intSettingsQuery.eq("tenant_id", tenantId);
    const { data: integrationSettings } = await intSettingsQuery.limit(1).single();

    const useMetaCloud = provider === 'meta_cloud' ||
      (provider !== 'zapi' && integrationSettings?.whatsapp_provider_active === 'meta_cloud');

    let messageSent = false;

    if (useMetaCloud && integrationSettings?.meta_cloud_enabled && integrationSettings.meta_cloud_phone_number_id) {
      const metaAccessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
      if (metaAccessToken) {
        messageSent = await sendWhatsAppMessageMetaCloud(
          integrationSettings.meta_cloud_phone_number_id,
          integrationSettings.meta_cloud_api_version || "v20.0",
          metaAccessToken,
          normalizedPhone,
          responseMessage,
          supabase
        );
      } else {
        console.log("[whatsapp-chatbot] META_WA_ACCESS_TOKEN not configured");
      }
    }

    if (!messageSent && integrationSettings?.zapi_enabled && integrationSettings.zapi_instance_id && integrationSettings.zapi_token) {
      await sendWhatsAppMessage(
        integrationSettings.zapi_instance_id,
        integrationSettings.zapi_token,
        integrationSettings.zapi_client_token,
        normalizedPhone,
        responseMessage
      );
      messageSent = true;
    }

    if (!messageSent) {
      console.log("[whatsapp-chatbot] No WhatsApp provider configured, skipping send");
    }

    // ── UPDATE CONVERSATION HISTORY (for AI context in future turns) ──
    if (session?.id && responseMessage) {
      await (supabase.rpc as any)('append_conversation_turn', {
        p_session_id: session.id,
        p_role: 'user',
        p_content: message,
        p_max_turns: MAX_CONVERSATION_TURNS,
      }).then(() => {}).catch((e: Error) => console.warn('[whatsapp-chatbot] Failed to append user turn:', e));

      await (supabase.rpc as any)('append_conversation_turn', {
        p_session_id: session.id,
        p_role: 'assistant',
        p_content: responseMessage,
        p_max_turns: MAX_CONVERSATION_TURNS,
      }).then(() => {}).catch((e: Error) => console.warn('[whatsapp-chatbot] Failed to append assistant turn:', e));
    }

    // Log the interaction (with flow reference)
    await supabase.from("whatsapp_chatbot_logs").insert({
      leader_id: actor?.id || null,
      phone: normalizedPhone,
      message_in: message,
      message_out: responseMessage,
      keyword_matched: matchedKeyword?.keyword || null,
      response_type: responseType,
      processing_time_ms: Date.now() - startTime,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });

    console.log(`[whatsapp-chatbot] [FLUXO: ${matchedFlowName || 'N/A'}] Response sent in ${Date.now() - startTime}ms`);

    // POST-RESPONSE: Check if we should trigger registration invite
    if (session && !session.registration_state && !session.registration_completed_at && !resolvedLeader) {
      const firstMsgTime = new Date(session.first_message_at).getTime();
      const minutesSinceFirst = (Date.now() - firstMsgTime) / (1000 * 60);

      const lastInviteAt = session.last_invite_at ? new Date(session.last_invite_at).getTime() : 0;
      const minutesSinceLastInvite = lastInviteAt > 0 ? (Date.now() - lastInviteAt) / (1000 * 60) : Infinity;
      const inviteSentCount = session.invite_sent_count || 0;

      const shouldInvite =
        minutesSinceFirst >= 30 &&
        minutesSinceLastInvite >= REGISTRATION_INVITE_MIN_INTERVAL_MIN &&
        inviteSentCount < 2;

      if (shouldInvite) {
        console.log(`[whatsapp-chatbot] 30+ min passed, triggering registration invite for ${normalizedPhone}`);

        const regInviteMsg = `Que bom que você está por aqui! 😊\n\nGostaria de se cadastrar para ficar por dentro de mais notícias, informações e ações que podem te ajudar e beneficiar?\n\nResponda *SIM* para se cadastrar! ✅`;

        await supabase
          .from("whatsapp_chatbot_sessions")
          .update({
            registration_state: "awaiting_confirmation",
            registration_asked_at: new Date().toISOString(),
            last_invite_at: new Date().toISOString(),
            invite_sent_count: inviteSentCount + 1,
          })
          .eq("id", session.id);

        await sendResponseToUser(supabase, integrationSettings, provider, normalizedPhone, regInviteMsg);

        await supabase.from("whatsapp_chatbot_logs").insert({
          leader_id: null, phone: normalizedPhone, message_in: "[auto-trigger-30min]",
          message_out: regInviteMsg, keyword_matched: null, response_type: "registration_invite",
          processing_time_ms: Date.now() - startTime,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        responseType,
        keywordMatched: matchedKeyword?.keyword || null,
        flowId: matchedFlowId || null,
        flowName: matchedFlowName || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[whatsapp-chatbot] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getFirstName(leader: Leader | null): string {
  if (!leader?.nome_completo) return "amigo(a)";
  return leader.nome_completo.split(" ")[0] || "amigo(a)";
}

function normalizeTextForMatch(value: string): string {
  return value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function sanitizeKeywordCandidate(value: string): string {
  return value.replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isKeywordMatch(
  messageForMatch: string,
  keyword: string,
  aliases: string[],
  isCommandLikeMessage: boolean
): boolean {
  const candidates = [keyword, ...aliases]
    .map(sanitizeKeywordCandidate)
    .filter((candidate, index, arr) => candidate.length >= 2 && arr.indexOf(candidate) === index);

  const messageTokens = new Set(messageForMatch.split(" ").filter(Boolean));

  return candidates.some((candidate) => {
    if (messageForMatch === candidate) return true;
    if (messageTokens.has(candidate)) return true;
    if (isCommandLikeMessage && candidate.length >= 4 && messageForMatch.includes(candidate)) return true;
    return false;
  });
}

function isEventRegistrationStatusIntent(message: string): boolean {
  const normalized = normalizeTextForMatch(message)
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const explicitPhrases = [
    "EM QUAL EVENTO ESTOU CADASTRADO", "EM QUAL EVENTO ESTOU INSCRITO",
    "QUAL EVENTO ESTOU CADASTRADO", "QUAL EVENTO ESTOU INSCRITO",
    "EM QUE EVENTO ESTOU CADASTRADO", "EM QUE EVENTO ESTOU INSCRITO",
    "QUAIS EVENTOS ESTOU CADASTRADO", "QUAIS EVENTOS ESTOU INSCRITO",
    "MEUS EVENTOS", "MINHAS INSCRICOES", "MINHAS INSCRICOES EM EVENTOS",
  ];

  if (explicitPhrases.some((phrase) => normalized.includes(phrase))) return true;

  const hasEventContext = normalized.includes("EVENTO") || normalized.includes("INSCRICAO") || normalized.includes("CADASTRADO") || normalized.includes("INSCRITO");
  const hasLookupIntent = normalized.includes("QUAL") || normalized.includes("QUAIS") || normalized.includes("ESTOU") || normalized.includes("TENHO");

  return hasEventContext && hasLookupIntent;
}

function buildPhoneLookupVariants(phone: string): string[] {
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  if (!digitsOnly) return [];
  const withCountry = digitsOnly.startsWith("55") ? digitsOnly : `55${digitsOnly}`;
  const withoutCountry = withCountry.startsWith("55") ? withCountry.slice(2) : withCountry;
  return Array.from(new Set([`+${withCountry}`, withCountry, withoutCountry].filter(Boolean)));
}

async function getEventRegistrationStatusResponse(supabase: any, tenantId: string, normalizedPhone: string): Promise<string> {
  const phoneVariants = buildPhoneLookupVariants(normalizedPhone);
  const phoneOrFilter = phoneVariants.map((p) => `whatsapp.eq.${p}`).join(",");
  let registrations: any[] = [];

  if (phoneOrFilter) {
    const { data: byWhatsapp } = await supabase
      .from("event_registrations")
      .select("id, event_id, created_at, event:events(name, date, time, location)")
      .eq("tenant_id", tenantId)
      .or(phoneOrFilter)
      .order("created_at", { ascending: false })
      .limit(10);
    registrations = byWhatsapp || [];
  }

  if (registrations.length === 0 && phoneVariants.length > 0) {
    const contactFilter = phoneVariants.map((p) => `telefone_norm.eq.${p}`).join(",");
    const { data: contact } = await supabase
      .from("office_contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .or(contactFilter)
      .limit(1)
      .maybeSingle();

    if (contact?.id) {
      const { data: byContact } = await supabase
        .from("event_registrations")
        .select("id, event_id, created_at, event:events(name, date, time, location)")
        .eq("tenant_id", tenantId)
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(10);
      registrations = byContact || [];
    }
  }

  if (!registrations || registrations.length === 0) {
    return "No momento, não encontrei nenhuma inscrição de evento para este número.\n\nSe quiser se inscrever agora, digite *EVENTO*.";
  }

  const uniqueByEvent: any[] = [];
  const seenEvents = new Set<string>();
  for (const reg of registrations) {
    const eventId = reg?.event_id || reg?.id;
    if (!eventId || seenEvents.has(eventId)) continue;
    seenEvents.add(eventId);
    uniqueByEvent.push(reg);
  }

  const maxRows = 5;
  const lines = uniqueByEvent.slice(0, maxRows).map((reg: any, idx: number) => {
    const eventData = Array.isArray(reg.event) ? reg.event[0] : reg.event;
    const eventName = eventData?.name || "Evento sem nome";
    let dateText = "Data não informada";
    if (eventData?.date) {
      const parsed = new Date(`${eventData.date}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) dateText = parsed.toLocaleDateString("pt-BR");
    }
    const timeText = eventData?.time ? ` às ${String(eventData.time).slice(0, 5)}` : "";
    const locationText = eventData?.location ? `\n   📍 ${eventData.location}` : "";
    return `${idx + 1}. *${eventName}*\n   🗓️ ${dateText}${timeText}${locationText}`;
  });

  const extraCount = uniqueByEvent.length - maxRows;
  const extraLine = extraCount > 0 ? `\n\n... e mais ${extraCount} inscrição(ões).` : "";
  return `📌 *Encontrei suas inscrições em evento:*\n\n${lines.join("\n\n")}${extraLine}\n\nSe quiser fazer uma nova inscrição, digite *EVENTO*.`;
}

function normalizePhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("55") && clean.length > 11) clean = clean.substring(2);
  if (clean.length === 10 && clean.startsWith("61")) clean = "61" + "9" + clean.substring(2);
  return "+55" + clean;
}

async function sendWhatsAppMessage(instanceId: string, token: string, clientToken: string | null, phone: string, message: string): Promise<boolean> {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  const messageParts = splitLongMessage(message);
  for (const part of messageParts) {
    const sent = await withRetry(async () => {
      const response = await fetch(zapiUrl, { method: "POST", headers, body: JSON.stringify({ phone: cleanPhone, message: part }) });
      if (!response.ok) { const errorText = await response.text(); throw new Error(`Z-API HTTP ${response.status}: ${errorText}`); }
      return true;
    }, SEND_RETRY_ATTEMPTS, SEND_RETRY_BASE_DELAY_MS, 'Z-API send').catch(err => { console.error("[whatsapp-chatbot] Z-API send failed after retries:", err); return false; });
    if (!sent) return false;
    if (messageParts.length > 1) await sleep(500);
  }
  console.log("[whatsapp-chatbot] Message sent successfully via Z-API");
  return true;
}

function splitLongMessage(message: string, maxLen = 1500): string[] {
  if (message.length <= maxLen) return [message];
  const parts: string[] = [];
  let remaining = message;
  while (remaining.length > maxLen) {
    let cutAt = remaining.lastIndexOf('\n', maxLen);
    if (cutAt < maxLen * 0.5) cutAt = remaining.lastIndexOf(' ', maxLen);
    if (cutAt < maxLen * 0.5) cutAt = maxLen;
    parts.push(remaining.substring(0, cutAt).trim());
    remaining = remaining.substring(cutAt).trim();
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}

async function sendWhatsAppMessageMetaCloud(phoneNumberId: string, apiVersion: string, accessToken: string, phone: string, message: string, supabase?: any): Promise<boolean> {
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) cleanPhone = "55" + cleanPhone;
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const messageParts = splitLongMessage(message);

  for (const part of messageParts) {
    const sent = await withRetry(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: cleanPhone, type: "text", text: { body: part } }),
      });
      if (!response.ok) { const errorText = await response.text(); throw new Error(`Meta Cloud HTTP ${response.status}: ${errorText}`); }
      const result = await response.json();
      const wamid = result.messages?.[0]?.id;
      console.log("[whatsapp-chatbot] Message sent via Meta Cloud API:", wamid);
      if (supabase && wamid) {
        try { await supabase.from("whatsapp_messages").insert({ phone: cleanPhone, message: part, direction: "outgoing", status: "sent", provider: "meta_cloud", metadata: { wamid } }); } catch (e) { console.warn("[whatsapp-chatbot] Failed to log Meta message:", e); }
      }
      return true;
    }, SEND_RETRY_ATTEMPTS, SEND_RETRY_BASE_DELAY_MS, 'Meta Cloud send').catch(err => { console.error("[whatsapp-chatbot] Meta Cloud send failed after retries:", err); return false; });
    if (!sent) return false;
    if (messageParts.length > 1) await sleep(500);
  }
  return true;
}

// Search Knowledge Base for relevant context
interface RankedKBChunk { content: string; source: string; score: number; }

const KB_STOP_WORDS = new Set([
  "que", "como", "para", "por", "com", "uma", "dos", "das", "nos", "nas", "foi", "ser", "ter", "seu", "sua", "são", "tem", "mais", "quando", "onde", "qual", "quem", "ele", "ela", "sobre", "essa", "esse", "isso", "esta", "este", "isto", "muito", "pode", "pelo", "pela", "ainda", "bem", "sem", "data",
  "mas", "não", "nao", "sim", "nao", "voce", "você", "meu", "minha", "tudo", "aqui", "ali", "tambem", "também", "porque", "pois", "então", "entao", "depois", "antes", "agora", "sempre", "nunca", "outro", "outra", "cada", "todo", "toda", "entre", "acho", "quero", "saber", "favor", "diga", "fale", "conte", "explique"
]);

function normalizeForKb(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractSearchTerms(question: string): string[] {
  const rawTerms = question.toLowerCase().replace(/[^\w\sáéíóúãõâêîôûç]/g, " ").split(/\s+/).filter((w: string) => w.length > 2 && !KB_STOP_WORDS.has(w));
  const termSet = new Set<string>();
  for (const term of rawTerms) { termSet.add(term); const normalized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); if (normalized !== term) termSet.add(normalized); }
  return Array.from(termSet);
}

async function searchKnowledgeBase(supabase: any, question: string, tenantId: string): Promise<{ context: string; sources: string[]; rankedChunks: RankedKBChunk[] }> {
  try {
    const searchTerms = extractSearchTerms(question);
    if (searchTerms.length === 0) return { context: "", sources: [], rankedChunks: [] };
    const searchPattern = searchTerms.join(" | ");
    const { data: documents } = await supabase.from("kb_documents").select("id, title, category").eq("tenant_id", tenantId).eq("status", "processed");
    if (!documents || documents.length === 0) return { context: "", sources: [], rankedChunks: [] };
    const docMap = new Map<string, { title: string; category: string }>();
    for (const doc of documents) docMap.set(doc.id, { title: doc.title, category: doc.category });

    const { data: chunks } = await supabase.from("kb_chunks").select("content, document_id, metadata").eq("tenant_id", tenantId).textSearch("content", searchPattern, { config: "simple" });
    let allChunks = chunks || [];
    if (allChunks.length === 0 && searchTerms.length > 0) {
      const { data: ilikeChunks } = await supabase.from("kb_chunks").select("content, document_id, metadata").eq("tenant_id", tenantId).ilike("content", `%${searchTerms[0]}%`).limit(20);
      allChunks = ilikeChunks || [];
    }
    if (allChunks.length === 0) return { context: "", sources: [], rankedChunks: [] };

    const intentBonusTerms: Record<string, string[]> = {
      nascimento: ["nascimento", "nasceu", "nascido", "nascida", "data de nascimento"],
      formacao: ["formacao", "formou", "graduacao", "graduou", "universidade", "faculdade"],
      partido: ["partido", "filiacao", "filiado", "sigla"],
      cargo: ["cargo", "eleito", "mandato", "deputado", "senador", "vereador"],
      comissao: ["comissao", "comissoes", "membro", "presidente"],
      projeto: ["projeto", "pl", "pec", "plp", "proposta", "autoria"],
    };

    const rankedChunks: RankedKBChunk[] = allChunks.map((chunk: any) => {
      const normalizedContent = normalizeForKb(chunk.content);
      let score = 0;
      for (const term of searchTerms) { if (normalizedContent.includes(normalizeForKb(term))) score += 10; }
      const metadata = chunk.metadata as any;
      if (metadata?.topics) {
        const topics = Array.isArray(metadata.topics) ? metadata.topics : [metadata.topics];
        for (const topic of topics) { const normalizedTopic = normalizeForKb(String(topic)); for (const term of searchTerms) { if (normalizedTopic.includes(normalizeForKb(term))) score += 20; } }
      }
      for (const [, bonusTerms] of Object.entries(intentBonusTerms)) {
        const questionNorm = normalizeForKb(question);
        if (bonusTerms.some(bt => questionNorm.includes(bt)) && bonusTerms.some(bt => normalizedContent.includes(bt))) score += 30;
      }
      const docInfo = docMap.get(chunk.document_id);
      return { content: chunk.content, source: docInfo?.title || "Documento", score };
    }).filter((c: RankedKBChunk) => c.score > 0).sort((a: RankedKBChunk, b: RankedKBChunk) => b.score - a.score).slice(0, 5);

    if (rankedChunks.length === 0) return { context: "", sources: [], rankedChunks: [] };
    console.log(`[whatsapp-chatbot] KB ranked: ${rankedChunks.map((c: RankedKBChunk) => `score=${c.score}`).join(", ")}`);
    const sources = [...new Set<string>(rankedChunks.map((c: RankedKBChunk) => c.source))];
    const context = rankedChunks.map((c: RankedKBChunk) => c.content).join("\n\n");
    return { context, sources, rankedChunks };
  } catch (err) { console.error("[whatsapp-chatbot] KB search error:", err); return { context: "", sources: [], rankedChunks: [] }; }
}

function responseDeniesKnowledge(answer: string): boolean {
  const normalized = normalizeForKb(answer);
  return ["nao tenho informacao", "nao encontrei informacao", "informacao nao esta disponivel", "nao esta disponivel na minha base", "nao consta na base", "nao tenho dados", "nao possuo informacao", "nao ha informacao", "nao encontrei dados", "nao tenho detalhes", "nao possuo detalhes", "nao localizei informacao", "nao disponivel na base", "nao consta na minha base", "nao tenho essa informacao", "fora do meu conhecimento", "alem do meu conhecimento", "nao tenho acesso a essa informacao", "base de conhecimento nao contem", "documentos disponiveis nao mencionam", "nao ha mencao", "nao foi possivel encontrar"].some((pattern) => normalized.includes(pattern));
}

function responseIsOutOfScope(answer: string): boolean {
  const normalized = normalizeForKb(answer);
  return ["so posso responder sobre assuntos relacionados ao mandato", "desculpe so posso responder", "fora do escopo", "nao tenho como ajudar com esse tema"].some((pattern) => normalized.includes(pattern));
}

function kbLacksSpecificAnswer(userMessage: string, rankedChunks: RankedKBChunk[]): boolean {
  if (!rankedChunks.length) return true;
  const specificPatterns = userMessage.match(/\b(?:PEC|PL|PLP|PDL|MPV|EC)\s*\d+[\w\/]*/gi) || [];
  const numberPatterns = userMessage.match(/\b\d{2,}\b/g) || [];
  const allSpecifics = [...specificPatterns, ...numberPatterns];
  if (allSpecifics.length === 0) return false;
  const topChunks = rankedChunks.slice(0, 3);
  const chunksText = topChunks.map(c => normalizeForKb(c.content)).join(" ");
  for (const specific of allSpecifics) { if (chunksText.includes(normalizeForKb(specific))) return false; }
  console.log(`[whatsapp-chatbot] KB lacks specific answer for: ${allSpecifics.join(", ")}`);
  return true;
}

async function searchPerplexityFallback(question: string, supabase?: any, tenantId?: string): Promise<string | null> {
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!perplexityKey) return null;
  let orgName = "", orgCargo = "";
  if (supabase && tenantId) {
    try { const { data: org } = await supabase.from("organization").select("nome, cargo").eq("tenant_id", tenantId).limit(1).single(); orgName = org?.nome || ""; orgCargo = org?.cargo || ""; } catch { /* ignore */ }
  }
  const scopeEntity = orgName ? `${orgCargo} ${orgName}`.trim() : "";
  if (!scopeEntity) { console.log("[whatsapp-chatbot] Perplexity skipped: no org context"); return null; }
  try {
    console.log("[whatsapp-chatbot] Trying Perplexity fallback (scoped to: " + scopeEntity + ")...");
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${perplexityKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: `Você é o assistente virtual do gabinete de ${scopeEntity}. Você SOMENTE responde perguntas relacionadas a ${scopeEntity}, mandato parlamentar, projetos de lei, ações políticas, eventos ou temas legislativos. Se NÃO tem relação, retorne EXATAMENTE: FORA_DO_ESCOPO. Responda de forma clara (máximo 800 chars). Cite fontes. Use emojis moderadamente.` },
          { role: "user", content: question },
        ],
        max_tokens: 500,
      }),
    });
    if (!response.ok) { console.error("[whatsapp-chatbot] Perplexity error:", response.status); return null; }
    const data = await response.json();
    const answer = (data.choices?.[0]?.message?.content || "").trim();
    const citations = data.citations || [];
    const cleanAnswer = answer.replace(/[*_`#]/g, "").trim();
    if (!answer || cleanAnswer.includes("NO_RESULT") || cleanAnswer.includes("FORA_DO_ESCOPO") || answer.length < 15) return null;
    const citationSuffix = citations.length > 0 ? `\n\n🔗 Fonte: ${citations[0]}` : "";
    return `${answer}${citationSuffix}`;
  } catch (err) { console.error("[whatsapp-chatbot] Perplexity fallback error:", err); return null; }
}

function extractBestSentence(content: string, searchTerms: string[]): string {
  const compactContent = content.replace(/\s+/g, " ").trim();
  const sentences = compactContent.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return compactContent.slice(0, 320);
  const normalizedTerms = searchTerms.map((t) => normalizeForKb(t)).filter((t) => t.length > 2);
  let bestSentence = sentences[0], bestScore = -1;
  for (const sentence of sentences) {
    const normalizedSentence = normalizeForKb(sentence);
    let score = 0;
    for (const term of normalizedTerms) { if (normalizedSentence.includes(term)) score += 2; }
    if (/(nascimento|nasceu|nascido|nascida|presidente|comissao|eleito)/.test(normalizedSentence)) score += 4;
    if (score > bestScore) { bestScore = score; bestSentence = sentence; }
  }
  return bestSentence.length > 320 ? `${bestSentence.slice(0, 317)}...` : bestSentence;
}

function buildGroundedFallbackResponse(userMessage: string, rankedChunks: RankedKBChunk[]): string | null {
  if (!rankedChunks.length) return null;
  const topChunk = rankedChunks[0];
  const sentence = extractBestSentence(topChunk.content, extractSearchTerms(userMessage));
  if (!sentence) return null;
  return `${sentence} (Fonte: ${topChunk.source})`;
}

async function generateAIResponse(apiKey: string, userMessage: string, leader: Leader | null, keywordContext: string, systemPrompt: string, supabase?: any, tenantId?: string, conversationHistory?: Array<{ role: string; content: string; ts?: number }>): Promise<string> {
  let orgScope = "";
  if (supabase && tenantId) {
    try { const { data: org } = await supabase.from("organization").select("nome, cargo").eq("tenant_id", tenantId).limit(1).single(); if (org?.nome) orgScope = `${org.cargo || ""} ${org.nome}`.trim(); } catch { /* ignore */ }
  }

  let kbContext = "", kbSources: string[] = [], kbRankedChunks: RankedKBChunk[] = [];
  if (supabase && tenantId) {
    const kb = await searchKnowledgeBase(supabase, userMessage, tenantId);
    kbContext = kb.context; kbSources = kb.sources; kbRankedChunks = kb.rankedChunks;
    if (kbContext) console.log(`[whatsapp-chatbot] KB context found: ${kbSources.length} sources, ${kbContext.length} chars`);
  }

  const hasLeader = !!leader;
  const leaderName = getFirstName(leader);
  const fullLeaderName = leader?.nome_completo || "Visitante";
  const cadastros = leader?.cadastros || 0;
  const pontuacao = leader?.pontuacao_total || 0;
  const isCoordinator = !!leader?.is_coordinator;

  const leaderContext = hasLeader
    ? `\nO usuário é ${fullLeaderName}, um líder político com:\n- ${cadastros} cadastros realizados\n- ${pontuacao} pontos de gamificação\n- ${isCoordinator ? "É coordenador" : "Não é coordenador"}\n`
    : `\nO usuário é um contato do WhatsApp já registrado no fluxo de atendimento, mas não está cadastrado como líder.\nResponda com foco institucional, sem mencionar dados internos de liderança ou gamificação.\n`;

  const kbSection = kbContext
    ? `\n\nBASE DE CONHECIMENTO (INFORMAÇÕES VERIFICADAS - USE OBRIGATORIAMENTE):\n${kbContext}\nFontes: ${kbSources.join(", ")}\n\nREGRA ABSOLUTA: As informações acima são VERIFICADAS e CONFIÁVEIS. Você DEVE usá-las para responder. Se a resposta está na base de conhecimento acima, responda com base nela. NUNCA diga que "não tem a informação" se ela aparece no texto acima. Cite a fonte no formato (Fonte: Nome do Documento).`
    : "";

  const scopeRestriction = orgScope
    ? `\nREGRA DE ESCOPO ABSOLUTA: Você é o assistente exclusivo do gabinete de ${orgScope}. Você SOMENTE pode responder perguntas que sejam diretamente relacionadas a ${orgScope}, ao mandato parlamentar, projetos de lei, ações políticas, eventos, legislação ou temas que envolvam ${orgScope}. Se a pergunta NÃO tem relação com ${orgScope} ou com o mandato, responda EXATAMENTE: "Desculpe, só posso responder sobre assuntos relacionados ao mandato de ${orgScope}. 😊 Posso ajudar com algo nesse tema?"`
    : "";

  const fullPrompt = `${systemPrompt}\n${scopeRestriction}\n${leaderContext}\n${keywordContext ? `Contexto adicional: ${keywordContext}` : ""}\n${kbSection}\n\nREGRAS OBRIGATÓRIAS:\n- Responda de forma breve (máximo 600 caracteres) e amigável. Use emojis moderadamente.\n- ${kbContext ? "A BASE DE CONHECIMENTO ACIMA CONTÉM INFORMAÇÕES REAIS. Leia com atenção e USE-AS para responder. NÃO ignore o conteúdo da base. Se a pergunta do usuário pode ser respondida com as informações acima, RESPONDA. SEMPRE cite a fonte." : "Se não houver contexto suficiente, diga que não encontrou essa informação na base disponível."}\n- REGRA CRÍTICA SOBRE ESPECIFICIDADE: Se o usuário perguntar sobre algo ESPECÍFICO e a base de conhecimento NÃO contém informação sobre esse item específico, diga EXATAMENTE: "Não encontrei informação específica sobre [item] na base disponível."\n- ${hasLeader ? "Se a pergunta for sobre dados específicos que você não tem, sugira usar comandos como ARVORE, CADASTROS, PONTOS ou RANKING." : "Se a pergunta for sobre acompanhamento individual de liderança, diga que é exclusivo para líderes cadastrados."}\n- ${!hasLeader ? "REGRA CRÍTICA: Este usuário NÃO é um líder cadastrado. NUNCA sugira funcionalidades internas. Responda APENAS sobre o conteúdo institucional." : ""}\n- NUNCA afirme que o líder "não tem cadastros" ou que "precisa encontrar/adicionar pessoas no sistema".\n- Se o líder não tem cadastros, diga que pode compartilhar seu link de indicação.\n- NUNCA faça suposições sobre dados que você não tem.`;

  try {
    const messages: Array<{ role: string; content: string }> = [{ role: "system", content: fullPrompt }];
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-MAX_CONVERSATION_TURNS * 2);
      for (const turn of recentHistory) { if (turn.role === 'user' || turn.role === 'assistant') messages.push({ role: turn.role, content: turn.content }); }
    }
    messages.push({ role: "user", content: userMessage });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 600 })
    });

    if (!response.ok) {
      console.error("[whatsapp-chatbot] AI API error:", await response.text());
      const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
      if (groundedFallback) return groundedFallback;
      return hasLeader ? `Olá ${leaderName}! Digite AJUDA para ver os comandos disponíveis.` : "Olá! Não consegui processar sua mensagem agora.";
    }

    const data = await response.json();
    const aiAnswer = (data.choices?.[0]?.message?.content || "").trim();
    const kbMissesSpecific = kbLacksSpecificAnswer(userMessage, kbRankedChunks);

    if (responseIsOutOfScope(aiAnswer)) { console.log("[whatsapp-chatbot] AI correctly rejected as out-of-scope"); return aiAnswer; }
    if (kbContext && responseDeniesKnowledge(aiAnswer) && !kbMissesSpecific) {
      const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
      if (groundedFallback) { console.log("[whatsapp-chatbot] AI denied known info, returning grounded fallback"); return groundedFallback; }
    }
    if (responseDeniesKnowledge(aiAnswer) || !aiAnswer || kbMissesSpecific) {
      const perplexityResult = await searchPerplexityFallback(userMessage, supabase, tenantId);
      if (perplexityResult) { console.log("[whatsapp-chatbot] Using Perplexity web search fallback"); return perplexityResult; }
    }
    if (!aiAnswer) { const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks); if (groundedFallback) return groundedFallback; }
    return aiAnswer || "Não consegui processar sua mensagem.";
  } catch (err) {
    console.error("[whatsapp-chatbot] AI error:", err);
    const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
    if (groundedFallback) return groundedFallback;
    const perplexityResult = await searchPerplexityFallback(userMessage, supabase, tenantId);
    if (perplexityResult) return perplexityResult;
    return hasLeader ? `Olá ${leaderName}! Digite AJUDA para ver os comandos disponíveis.` : "Olá! Não consegui processar sua mensagem agora.";
  }
}
