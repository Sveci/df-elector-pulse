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

// Dynamic function implementations
const dynamicFunctions: Record<string, (supabase: any, leader: Leader) => Promise<string>> = {
  
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
    response += `❓ *AJUDA* - Ver esta lista\n`;
    response += `\nOu digite sua pergunta e tentarei ajudar! 😊`;
    
    return response;
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
    const { phone, message, messageId, provider, tenantId: requestTenantId } = body;

    console.log(`[whatsapp-chatbot] Received: phone=${phone}, message=${message.substring(0, 50)}..., provider=${provider || 'auto'}, tenantId=${requestTenantId || 'auto'}`);

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
    
    // Upsert session to track first_message_at
    const { data: existingSession } = await supabase
      .from("whatsapp_chatbot_sessions")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    let session = existingSession;
    if (!session) {
      const { data: newSession } = await supabase
        .from("whatsapp_chatbot_sessions")
        .insert({ phone: normalizedPhone, tenant_id: tenantId, first_message_at: new Date().toISOString() })
        .select()
        .single();
      session = newSession;
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
    const confirmMatchChatbot = normalizedMessage.match(/^CONFIRMAR\s+([A-Z0-9]{5,6})$/);
    const bareCodeMatch = normalizedMessage.match(/^[A-Z0-9]{5,6}$/);

    if (confirmMatchChatbot || (bareCodeMatch && normalizedMessage !== "AJUDA" && normalizedMessage !== "PONTOS" && normalizedMessage !== "SIM")) {
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

    console.log(`[whatsapp-chatbot] KB ranked: ${rankedChunks.map((c: RankedKBChunk) => `score=${c.score}`).join(", ")}`);

    const sources: string[] = [...new Set(rankedChunks.map((c: RankedKBChunk) => c.source))];
    const context = rankedChunks.map((c: RankedKBChunk) => c.content).join("\n\n");

    return { context, sources, rankedChunks };
  } catch (err) {
    console.error("[whatsapp-chatbot] KB search error:", err);
    return { context: "", sources: [], rankedChunks: [] };
  }
}

function responseDeniesKnowledge(answer: string): boolean {
  const normalized = normalizeForKb(answer);
  return [
    "nao tenho informacao",
    "nao encontrei informacao",
    "informacao nao esta disponivel",
    "nao esta disponivel na minha base",
    "nao consta na base",
    "nao tenho dados",
    "nao possuo informacao",
    "nao ha informacao",
    "nao encontrei dados",
    "nao tenho detalhes",
    "nao possuo detalhes",
    "nao localizei informacao",
    "nao disponivel na base",
    "nao consta na minha base",
    "nao tenho essa informacao",
    "fora do meu conhecimento",
    "alem do meu conhecimento",
    "nao tenho acesso a essa informacao",
    "base de conhecimento nao contem",
    "documentos disponiveis nao mencionam",
    "nao ha mencao",
    "nao foi possivel encontrar",
  ].some((pattern) => normalized.includes(pattern));
}

// Detect if AI correctly rejected as out-of-scope (should NOT trigger Perplexity)
function responseIsOutOfScope(answer: string): boolean {
  const normalized = normalizeForKb(answer);
  return [
    "so posso responder sobre assuntos relacionados ao mandato",
    "desculpe so posso responder",
    "fora do escopo",
    "nao tenho como ajudar com esse tema",
  ].some((pattern) => normalized.includes(pattern));
}

// Check if KB chunks actually contain the specific topic the user asked about
function kbLacksSpecificAnswer(userMessage: string, rankedChunks: RankedKBChunk[]): boolean {
  if (!rankedChunks.length) return true;
  
  // Extract specific identifiers from user message (numbers, acronyms+numbers, proper nouns)
  const specificPatterns = userMessage.match(/\b(?:PEC|PL|PLP|PDL|MPV|EC)\s*\d+[\w\/]*/gi) || [];
  const numberPatterns = userMessage.match(/\b\d{2,}\b/g) || [];
  const allSpecifics = [...specificPatterns, ...numberPatterns];
  
  if (allSpecifics.length === 0) return false; // No specific identifiers to check
  
  // Check if any top KB chunk actually contains the specific identifier
  const topChunks = rankedChunks.slice(0, 3);
  const chunksText = topChunks.map(c => normalizeForKb(c.content)).join(" ");
  
  for (const specific of allSpecifics) {
    const normalizedSpecific = normalizeForKb(specific);
    if (chunksText.includes(normalizedSpecific)) {
      return false; // Found specific match in KB
    }
  }
  
  console.log(`[whatsapp-chatbot] KB lacks specific answer for: ${allSpecifics.join(", ")}`);
  return true; // KB has generic content but not the specific topic
}

// Perplexity web search fallback - restricted to tenant/political scope
async function searchPerplexityFallback(question: string, supabase?: any, tenantId?: string): Promise<string | null> {
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!perplexityKey) return null;

  // Fetch org name to scope the search
  let orgName = "";
  let orgCargo = "";
  if (supabase && tenantId) {
    try {
      const { data: org } = await supabase
        .from("organization")
        .select("nome, cargo")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();
      orgName = org?.nome || "";
      orgCargo = org?.cargo || "";
    } catch { /* ignore */ }
  }

  const scopeEntity = orgName ? `${orgCargo} ${orgName}`.trim() : "";

  // Check if question is related to the political scope
  // If there's no org context, we can't scope - skip fallback
  if (!scopeEntity) {
    console.log("[whatsapp-chatbot] Perplexity skipped: no org context for scoping");
    return null;
  }

  try {
    console.log("[whatsapp-chatbot] Trying Perplexity fallback (scoped to: " + scopeEntity + ")...");
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `Você é o assistente virtual do gabinete de ${scopeEntity}. Você SOMENTE responde perguntas que sejam diretamente relacionadas a ${scopeEntity}, ao mandato parlamentar, projetos de lei, ações políticas, eventos ou temas legislativos que envolvam ${scopeEntity}. Se a pergunta NÃO tem relação com ${scopeEntity} ou com política/legislação brasileira no contexto do mandato, retorne EXATAMENTE: FORA_DO_ESCOPO. Responda de forma clara e objetiva (máximo 800 caracteres). Cite fontes quando possível. Use emojis moderadamente.`,
          },
          { role: "user", content: question },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error("[whatsapp-chatbot] Perplexity error:", response.status);
      return null;
    }

    const data = await response.json();
    const answer = (data.choices?.[0]?.message?.content || "").trim();
    const citations = data.citations || [];

    // Detect out-of-scope or NO_RESULT responses
    const cleanAnswer = answer.replace(/[*_`#]/g, "").trim();
    if (!answer || cleanAnswer.startsWith("NO_RESULT") || cleanAnswer.includes("NO_RESULT") || 
        cleanAnswer.startsWith("FORA_DO_ESCOPO") || cleanAnswer.includes("FORA_DO_ESCOPO") || 
        answer.length < 15) {
      console.log("[whatsapp-chatbot] Perplexity: out of scope or no result");
      return null;
    }

    const citationSuffix = citations.length > 0 ? `\n\n🔗 Fonte: ${citations[0]}` : "";
    console.log(`[whatsapp-chatbot] Perplexity fallback success: ${answer.length} chars`);
    return `${answer}${citationSuffix}`;
  } catch (err) {
    console.error("[whatsapp-chatbot] Perplexity fallback error:", err);
    return null;
  }
}

function extractBestSentence(content: string, searchTerms: string[]): string {
  const compactContent = content.replace(/\s+/g, " ").trim();
  const sentences = compactContent
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return compactContent.slice(0, 320);

  const normalizedTerms = searchTerms.map((t) => normalizeForKb(t)).filter((t) => t.length > 2);

  let bestSentence = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    const normalizedSentence = normalizeForKb(sentence);
    let score = 0;

    for (const term of normalizedTerms) {
      if (normalizedSentence.includes(term)) score += 2;
    }

    if (/(nascimento|nasceu|nascido|nascida|presidente|comissao|eleito)/.test(normalizedSentence)) {
      score += 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
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

// Generate AI response using Lovable AI + Knowledge Base
async function generateAIResponse(
  apiKey: string,
  userMessage: string,
  leader: Leader | null,
  keywordContext: string,
  systemPrompt: string,
  supabase?: any,
  tenantId?: string
): Promise<string> {
  // Fetch org name for scope restriction
  let orgScope = "";
  if (supabase && tenantId) {
    try {
      const { data: org } = await supabase
        .from("organization")
        .select("nome, cargo")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();
      if (org?.nome) {
        orgScope = `${org.cargo || ""} ${org.nome}`.trim();
      }
    } catch { /* ignore */ }
  }

  // Search Knowledge Base for relevant context
  let kbContext = "";
  let kbSources: string[] = [];
  let kbRankedChunks: RankedKBChunk[] = [];
  
  if (supabase && tenantId) {
    const kb = await searchKnowledgeBase(supabase, userMessage, tenantId);
    kbContext = kb.context;
    kbSources = kb.sources;
    kbRankedChunks = kb.rankedChunks;
    if (kbContext) {
      console.log(`[whatsapp-chatbot] KB context found: ${kbSources.length} sources, ${kbContext.length} chars`);
    }
  }

  const hasLeader = !!leader;
  const leaderName = getFirstName(leader);
  const fullLeaderName = leader?.nome_completo || "Visitante";
  const cadastros = leader?.cadastros || 0;
  const pontuacao = leader?.pontuacao_total || 0;
  const isCoordinator = !!leader?.is_coordinator;

  const leaderContext = hasLeader
    ? `
O usuário é ${fullLeaderName}, um líder político com:
- ${cadastros} cadastros realizados
- ${pontuacao} pontos de gamificação
- ${isCoordinator ? "É coordenador" : "Não é coordenador"}
`
    : `
O usuário é um contato do WhatsApp já registrado no fluxo de atendimento, mas não está cadastrado como líder.
Responda com foco institucional, sem mencionar dados internos de liderança ou gamificação.
`;

  const kbSection = kbContext
    ? `\n\nBASE DE CONHECIMENTO (INFORMAÇÕES VERIFICADAS - USE OBRIGATORIAMENTE):\n${kbContext}\nFontes: ${kbSources.join(", ")}\n\nREGRA ABSOLUTA: As informações acima são VERIFICADAS e CONFIÁVEIS. Você DEVE usá-las para responder. Se a resposta está na base de conhecimento acima, responda com base nela. NUNCA diga que "não tem a informação" se ela aparece no texto acima. Cite a fonte no formato (Fonte: Nome do Documento).`
    : "";

  const scopeRestriction = orgScope 
    ? `\nREGRA DE ESCOPO ABSOLUTA: Você é o assistente exclusivo do gabinete de ${orgScope}. Você SOMENTE pode responder perguntas que sejam diretamente relacionadas a ${orgScope}, ao mandato parlamentar, projetos de lei, ações políticas, eventos, legislação ou temas que envolvam ${orgScope}. Se a pergunta NÃO tem relação com ${orgScope} ou com o mandato, responda EXATAMENTE: "Desculpe, só posso responder sobre assuntos relacionados ao mandato de ${orgScope}. 😊 Posso ajudar com algo nesse tema?"`
    : "";

  const fullPrompt = `${systemPrompt}
${scopeRestriction}

${leaderContext}

${keywordContext ? `Contexto adicional: ${keywordContext}` : ""}
${kbSection}

REGRAS OBRIGATÓRIAS:
- Responda de forma breve (máximo 600 caracteres) e amigável. Use emojis moderadamente.
- ${kbContext ? "A BASE DE CONHECIMENTO ACIMA CONTÉM INFORMAÇÕES REAIS. Leia com atenção e USE-AS para responder. NÃO ignore o conteúdo da base. Se a pergunta do usuário pode ser respondida com as informações acima, RESPONDA. SEMPRE cite a fonte." : "Se não houver contexto suficiente, diga que não encontrou essa informação na base disponível."}
- REGRA CRÍTICA SOBRE ESPECIFICIDADE: Se o usuário perguntar sobre algo ESPECÍFICO (ex: "PEC 47", "PL 1234", uma pessoa, uma data) e a base de conhecimento NÃO contém informação sobre esse item específico, diga EXATAMENTE: "Não encontrei informação específica sobre [item] na base disponível." NÃO tente dar uma resposta genérica usando informações sobre tópicos similares mas diferentes.
- ${hasLeader ? "Se a pergunta for sobre dados específicos que você não tem, sugira usar comandos como ARVORE, CADASTROS, PONTOS ou RANKING." : "Se a pergunta for sobre acompanhamento individual de liderança, diga que esse tipo de consulta é exclusivo para líderes cadastrados."}
- ${!hasLeader ? "REGRA CRÍTICA: Este usuário NÃO é um líder cadastrado. NUNCA sugira funcionalidades internas como ver pontuação, ver mensagens, ver contatos, ranking, cadastros, árvore, subordinados ou qualquer recurso exclusivo de líderes. NÃO inclua listas de sugestões com emojis de funcionalidades internas. Responda APENAS sobre o conteúdo institucional da base de conhecimento." : ""}
- NUNCA afirme que o líder "não tem cadastros" ou que "precisa encontrar/adicionar pessoas no sistema". Os cadastros são feitos por terceiros que se cadastram através do link de indicação do líder, NÃO pelo líder manualmente.
- NUNCA sugira que o líder pode buscar, encontrar ou adicionar contatos/pessoas no sistema. O sistema NÃO permite isso.
- Se o líder não tem cadastros ainda, diga apenas que ele pode compartilhar seu link de indicação para que novas pessoas se cadastrem.
- NUNCA faça suposições sobre dados que você não tem. Se não sabe, diga que não tem a informação.
- Se a mensagem parecer ser um código de verificação (ex: "CONFIRMAR ABC123"), NÃO responda como conversa normal. Informe que o sistema de verificação tratará a solicitação.
- Ignore chunks que descrevem estrutura de tabelas SQL (ex: "A tabela X armazena..."). Foque no conteúdo factual e informativo.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 600
      })
    });

    if (!response.ok) {
      console.error("[whatsapp-chatbot] AI API error:", await response.text());
      const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
      if (groundedFallback) return groundedFallback;
      return hasLeader ? `Olá ${leaderName}! Digite AJUDA para ver os comandos disponíveis.` : "Olá! Não consegui processar sua mensagem agora.";
    }

    const data = await response.json();
    const aiAnswer = (data.choices?.[0]?.message?.content || "").trim();

    // Check if KB actually has specific info for this query
    const kbMissesSpecific = kbLacksSpecificAnswer(userMessage, kbRankedChunks);
    
    // If AI correctly rejected as out-of-scope, return as-is (do NOT send to Perplexity)
    if (responseIsOutOfScope(aiAnswer)) {
      console.log("[whatsapp-chatbot] AI correctly rejected as out-of-scope, returning as-is");
      return aiAnswer;
    }

    // If AI denies having info but KB has it AND KB has specific content, use grounded fallback
    if (kbContext && responseDeniesKnowledge(aiAnswer) && !kbMissesSpecific) {
      const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
      if (groundedFallback) {
        console.log("[whatsapp-chatbot] AI denied known info, returning grounded fallback");
        return groundedFallback;
      }
    }

    // If AI denies knowledge OR KB lacks specific answer, try Perplexity web search
    if (responseDeniesKnowledge(aiAnswer) || !aiAnswer || kbMissesSpecific) {
      const perplexityResult = await searchPerplexityFallback(userMessage, supabase, tenantId);
      if (perplexityResult) {
        console.log("[whatsapp-chatbot] Using Perplexity web search fallback");
        return perplexityResult;
      }
    }

    if (!aiAnswer) {
      const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
      if (groundedFallback) return groundedFallback;
    }

    return aiAnswer || "Não consegui processar sua mensagem.";
  } catch (err) {
    console.error("[whatsapp-chatbot] AI error:", err);
    const groundedFallback = buildGroundedFallbackResponse(userMessage, kbRankedChunks);
    if (groundedFallback) return groundedFallback;
    // Try Perplexity as last resort
    const perplexityResult = await searchPerplexityFallback(userMessage, supabase, tenantId);
    if (perplexityResult) return perplexityResult;
    return hasLeader ? `Olá ${leaderName}! Digite AJUDA para ver os comandos disponíveis.` : "Olá! Não consegui processar sua mensagem agora.";
  }
}

