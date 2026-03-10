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

    if (leaderError || !leader) {
      console.log(`[whatsapp-chatbot] No leader found for phone ${phone}`);
      await supabase.from("whatsapp_chatbot_logs").insert({
        phone: normalizedPhone,
        message_in: message,
        message_out: null,
        error_message: "Líder não encontrado",
        processing_time_ms: Date.now() - startTime,
        ...(requestTenantId ? { tenant_id: requestTenantId } : {}),
      });
      return new Response(
        JSON.stringify({ success: false, reason: "not_a_leader" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use leader's tenant_id as the resolved tenant
    const tenantId = requestTenantId || leader.tenant_id;
    console.log(`[whatsapp-chatbot] Found leader: ${leader.nome_completo} (${leader.id}), tenant: ${tenantId}`);

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
    const { count: recentMessages } = await supabase
      .from("whatsapp_chatbot_logs")
      .select("id", { count: "exact", head: true })
      .eq("leader_id", leader.id)
      .gte("created_at", oneHourAgo);

    if (recentMessages && recentMessages >= (chatbotConfig.max_messages_per_hour || 20)) {
      console.log(`[whatsapp-chatbot] Rate limit exceeded for leader ${leader.id}`);
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
    const normalizedMessage = message.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // === INTERCEPT VERIFICATION CODES ===
    const confirmMatchChatbot = normalizedMessage.match(/^CONFIRMAR\s+([A-Z0-9]{5,6})$/);
    const bareCodeMatch = normalizedMessage.match(/^[A-Z0-9]{5,6}$/);

    if (confirmMatchChatbot || (bareCodeMatch && normalizedMessage !== "AJUDA" && normalizedMessage !== "PONTOS" && normalizedMessage !== "SIM")) {
      const code = confirmMatchChatbot ? confirmMatchChatbot[1] : bareCodeMatch![0];
      console.log(`[whatsapp-chatbot] Detected verification code: ${code} from leader ${leader.id}`);

      const { data: leaderVerificationStatus } = await supabase
        .from("lideres")
        .select("is_verified, verification_code")
        .eq("id", leader.id)
        .single();

      if (leaderVerificationStatus?.is_verified) {
        const responseAlready = `Olá ${leader.nome_completo.split(" ")[0]}! ✅\n\nSeu cadastro já foi verificado anteriormente. Você já pode usar todos os comandos disponíveis.\n\nDigite *AJUDA* para ver a lista de comandos.`;
        
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
          leader_id: leader.id, phone: normalizedPhone, message_in: message,
          message_out: responseAlready, keyword_matched: "CONFIRMAR", response_type: "verification_already",
          processing_time_ms: Date.now() - startTime,
          ...(tenantId ? { tenant_id: tenantId } : {}),
        });

        return new Response(JSON.stringify({ success: true, responseType: "verification_already" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (leaderVerificationStatus?.verification_code && leaderVerificationStatus.verification_code !== code) {
        const responseWrongCode = `Olá ${leader.nome_completo.split(" ")[0]}! ⚠️\n\nEsse código não pertence ao seu número de telefone. Por favor, utilize o código que foi enviado para você.`;

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
          leader_id: leader.id, phone: normalizedPhone, message_in: message,
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

    let matchedKeyword: ChatbotKeyword | null = null;

    for (const kw of activeKeywords) {
      const keywordNorm = kw.keyword.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const aliasesNorm = (kw.aliases || []).map(a => a.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      
      if (normalizedMessage === keywordNorm || 
          normalizedMessage.includes(keywordNorm) ||
          aliasesNorm.some(a => normalizedMessage === a || normalizedMessage.includes(a))) {
        matchedKeyword = kw;
        break;
      }
    }

    let responseMessage = "";
    let responseType = "unknown";

    if (matchedKeyword) {
      console.log(`[whatsapp-chatbot] Matched keyword: ${matchedKeyword.keyword} (${matchedKeyword.response_type})`);
      responseType = matchedKeyword.response_type;

      if (matchedKeyword.response_type === "static" && matchedKeyword.static_response) {
        responseMessage = matchedKeyword.static_response
          .replace("{{nome}}", leader.nome_completo.split(" ")[0])
          .replace("{{nome_completo}}", leader.nome_completo)
          .replace("{{pontos}}", String(leader.pontuacao_total))
          .replace("{{cadastros}}", String(leader.cadastros));
      } else if (matchedKeyword.response_type === "dynamic" && matchedKeyword.dynamic_function) {
        const fn = dynamicFunctions[matchedKeyword.dynamic_function];
        if (fn) {
          responseMessage = await fn(supabase, leader as Leader);
        } else {
          responseMessage = chatbotConfig.fallback_message || "Função não encontrada.";
        }
      } else if (matchedKeyword.response_type === "ai") {
        if (lovableApiKey && chatbotConfig.use_ai_for_unknown) {
          responseMessage = await generateAIResponse(
            lovableApiKey,
            message,
            leader as Leader,
            matchedKeyword.description || "",
            chatbotConfig.ai_system_prompt || ""
          );
        } else {
          responseMessage = chatbotConfig.fallback_message || "Não consegui processar sua mensagem.";
        }
      }
    } else if (chatbotConfig.use_ai_for_unknown && lovableApiKey) {
      console.log("[whatsapp-chatbot] No keyword match, using AI");
      responseType = "ai";
      responseMessage = await generateAIResponse(
        lovableApiKey,
        message,
        leader as Leader,
        "",
        chatbotConfig.ai_system_prompt || ""
      );
    } else {
      responseType = "fallback";
      responseMessage = chatbotConfig.fallback_message || 
        `Olá ${leader.nome_completo.split(" ")[0]}! Digite AJUDA para ver os comandos disponíveis.`;
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

    // Log the interaction
    await supabase.from("whatsapp_chatbot_logs").insert({
      leader_id: leader.id,
      phone: normalizedPhone,
      message_in: message,
      message_out: responseMessage,
      keyword_matched: matchedKeyword?.keyword || null,
      response_type: responseType,
      processing_time_ms: Date.now() - startTime,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });

    console.log(`[whatsapp-chatbot] Response sent in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        responseType,
        keywordMatched: matchedKeyword?.keyword || null
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

// Normalize phone number
function normalizePhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  
  if (clean.startsWith("55") && clean.length > 11) {
    clean = clean.substring(2);
  }
  
  // Add 9 if missing for Brasília
  if (clean.length === 10 && clean.startsWith("61")) {
    clean = "61" + "9" + clean.substring(2);
  }
  
  return "+55" + clean;
}

// Send WhatsApp message via Z-API
async function sendWhatsAppMessage(
  instanceId: string,
  token: string,
  clientToken: string | null,
  phone: string,
  message: string
): Promise<boolean> {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  
  const headers: Record<string, string> = { 
    "Content-Type": "application/json" 
  };
  
  if (clientToken) {
    headers["Client-Token"] = clientToken;
  }
  
  try {
    const response = await fetch(zapiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[whatsapp-chatbot] Z-API error:", errorText);
      return false;
    } else {
      console.log("[whatsapp-chatbot] Message sent successfully via Z-API");
      return true;
    }
  } catch (err) {
    console.error("[whatsapp-chatbot] Error sending via Z-API:", err);
    return false;
  }
}

// Send WhatsApp message via Meta Cloud API
async function sendWhatsAppMessageMetaCloud(
  phoneNumberId: string,
  apiVersion: string,
  accessToken: string,
  phone: string,
  message: string,
  supabase?: any
): Promise<boolean> {
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    cleanPhone = "55" + cleanPhone;
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[whatsapp-chatbot] Meta Cloud API error:", errorText);
      return false;
    }
    
    const result = await response.json();
    const wamid = result.messages?.[0]?.id;
    console.log("[whatsapp-chatbot] Message sent successfully via Meta Cloud API:", wamid);

    if (supabase) {
      await supabase.from("whatsapp_messages").insert({
        phone: cleanPhone,
        message: message,
        direction: "outgoing",
        status: "sent",
        provider: "meta_cloud",
        metadata: { wamid },
      });
    }

    return true;
  } catch (err) {
    console.error("[whatsapp-chatbot] Error sending via Meta Cloud:", err);
    return false;
  }
}

// Generate AI response using Lovable AI
async function generateAIResponse(
  apiKey: string,
  userMessage: string,
  leader: Leader,
  keywordContext: string,
  systemPrompt: string
): Promise<string> {
  const leaderContext = `
O usuário é ${leader.nome_completo}, um líder político com:
- ${leader.cadastros} cadastros realizados
- ${leader.pontuacao_total} pontos de gamificação
- ${leader.is_coordinator ? "É coordenador" : "Não é coordenador"}
`;

  const fullPrompt = `${systemPrompt}

${leaderContext}

${keywordContext ? `Contexto adicional: ${keywordContext}` : ""}

REGRAS OBRIGATÓRIAS:
- Responda de forma breve (máximo 300 caracteres) e amigável. Use emojis moderadamente.
- Se a pergunta for sobre dados específicos que você não tem, sugira usar comandos como ARVORE, CADASTROS, PONTOS ou RANKING.
- NUNCA afirme que o líder "não tem cadastros" ou que "precisa encontrar/adicionar pessoas no sistema". Os cadastros são feitos por terceiros que se cadastram através do link de indicação do líder, NÃO pelo líder manualmente.
- NUNCA sugira que o líder pode buscar, encontrar ou adicionar contatos/pessoas no sistema. O sistema NÃO permite isso.
- Se o líder não tem cadastros ainda, diga apenas que ele pode compartilhar seu link de indicação para que novas pessoas se cadastrem.
- NUNCA faça suposições sobre dados que você não tem. Se não sabe, diga que não tem a informação.
- Se a mensagem parecer ser um código de verificação (ex: "CONFIRMAR ABC123"), NÃO responda como conversa normal. Informe que o sistema de verificação tratará a solicitação.`;

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
        max_tokens: 200
      })
    });

    if (!response.ok) {
      console.error("[whatsapp-chatbot] AI API error:", await response.text());
      return `Olá ${leader.nome_completo.split(" ")[0]}! Digite AJUDA para ver os comandos disponíveis.`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Não consegui processar sua mensagem.";
  } catch (err) {
    console.error("[whatsapp-chatbot] AI error:", err);
    return `Olá ${leader.nome_completo.split(" ")[0]}! Digite AJUDA para ver os comandos disponíveis.`;
  }
}
