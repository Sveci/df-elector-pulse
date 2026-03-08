import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meta Template structures for Cloud API
interface MetaTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: number;
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    text?: string;
  }>;
}

interface MetaTemplatePayload {
  name: string;
  language: { code: string };
  components?: MetaTemplateComponent[];
}

interface SendWhatsAppRequest {
  phone: string;
  message?: string;
  templateSlug?: string;
  variables?: Record<string, string>;
  visitId?: string;
  contactId?: string;
  imageUrl?: string;
  providerOverride?: 'zapi' | 'meta_cloud'; // Admin override
  clientMessageId?: string; // For idempotency
  metaTemplate?: MetaTemplatePayload; // For direct template sending via Meta Cloud API
  bypassAutoCheck?: boolean; // Bypass automatic message category check (e.g., for WhatsApp verification flow)
}

// Replace template variables {{var}} with actual values
function replaceTemplateVariables(
  mensagem: string,
  variables: Record<string, string>
): string {
  let result = mensagem;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

// Templates que usam variação com IA para evitar detecção de spam
const ANTI_SPAM_TEMPLATES = [
  'verificacao-sms-fallback',
  'verificacao-cadastro',
  'verificacao-codigo',
  'lider-cadastro-confirmado',
  'captacao-boas-vindas',
  'evento-inscricao-confirmada',
  'lideranca-cadastro-link',
  'membro-cadastro-boas-vindas',
  'visita-link-formulario',
  'reuniao-cancelada',
  'reuniao-reagendada',
  'descadastro-confirmado',
  'recadastro-confirmado',
  'link-indicacao-sms-fallback',
  'pesquisa-agradecimento',
];

// Gerar variação de mensagem com IA para evitar detecção de spam
async function generateMessageVariation(
  baseMessage: string,
  variables: Record<string, string>
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const filledMessage = replaceTemplateVariables(baseMessage, variables);
  
  if (!LOVABLE_API_KEY) {
    console.log("[send-whatsapp] LOVABLE_API_KEY não configurada, usando template original");
    return filledMessage;
  }
  
  try {
    const nome = variables.nome || variables.name || "Amigo(a)";
    const codigo = variables.codigo || variables.code || "";
    
    // Extract URLs/links from the message to preserve them exactly
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = filledMessage.match(urlRegex) || [];
    const urlPlaceholders = urls.map((url, i) => `[[URL_${i}]]`);
    
    let messageForAI = filledMessage;
    urls.forEach((url, i) => {
      messageForAI = messageForAI.replace(url, urlPlaceholders[i]);
    });

    const prompt = `Você é um assistente que cria variações naturais de mensagens de WhatsApp para evitar bloqueio por spam.

MENSAGEM ORIGINAL:
${messageForAI}

REGRAS OBRIGATÓRIAS:
1. Mantenha a saudação usando o nome "${nome}"
2. Se houver código de verificação "${codigo}", mantenha-o EXATAMENTE igual em destaque com *asteriscos*
3. Mantenha TODOS os placeholders [[URL_0]], [[URL_1]] etc EXATAMENTE como estão - NÃO os modifique
4. Mantenha o significado e a intenção da mensagem original
5. Varie: saudações, emojis (use DIFERENTES), estrutura de frases, sinônimos, pontuação
6. Use tom amigável e natural, como se fosse uma pessoa real
7. Mantenha entre 3-7 linhas
8. NÃO use formatação markdown além de *negrito*
9. NÃO repita a estrutura exata da mensagem original
10. Varie a ordem das informações quando possível
11. Use saudações variadas: Olá, Oi, E aí, Fala, Hey, Tudo bem, Bom dia/tarde

Gere UMA variação criativa mantendo a essência. Responda APENAS com a mensagem, sem explicações:`;

    console.log("[send-whatsapp] Gerando variação com IA...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.95,
      }),
    });

    if (!response.ok) {
      console.error("[send-whatsapp] Erro ao gerar variação:", response.status, await response.text());
      return filledMessage;
    }

    const data = await response.json();
    const variation = data.choices?.[0]?.message?.content?.trim();
    
    if (variation && variation.length > 20) {
      // Restore original URLs back into the variation
      let finalVariation = variation;
      urls.forEach((url, i) => {
        finalVariation = finalVariation.replace(urlPlaceholders[i], url);
      });
      console.log("[send-whatsapp] Variação gerada com IA com sucesso");
      return finalVariation;
    }
    
    console.log("[send-whatsapp] Variação vazia ou muito curta, usando original");
    return filledMessage;
  } catch (error) {
    console.error("[send-whatsapp] Exceção ao gerar variação:", error);
    return filledMessage;
  }
}

// Templates públicos que podem ser enviados sem autenticação
const PUBLIC_TEMPLATES = [
  'evento-inscricao-confirmada',
  'captacao-boas-vindas',
  'lider-cadastro-confirmado',
  'visita-link-formulario',
  'verificacao-cadastro',
  'verificacao-codigo',
  'membro-cadastro-boas-vindas',
  'lideranca-cadastro-link',
  'verificacao-sms-fallback',
  'link-indicacao-sms-fallback',
];

// Mapeamento de templates para colunas de configuração
const TEMPLATE_SETTINGS_MAP: Record<string, string> = {
  'verificacao-cadastro': 'wa_auto_verificacao_enabled',
  'verificacao-codigo': 'wa_auto_verificacao_enabled',
  'verificacao-confirmada': 'wa_auto_verificacao_enabled',
  'captacao-boas-vindas': 'wa_auto_captacao_enabled',
  'pesquisa-agradecimento': 'wa_auto_pesquisa_enabled',
  'evento-inscricao-confirmada': 'wa_auto_evento_enabled',
  'lideranca-cadastro-link': 'wa_auto_lideranca_enabled',
  'lider-cadastro-confirmado': 'wa_auto_lideranca_enabled',
  'membro-cadastro-boas-vindas': 'wa_auto_membro_enabled',
  'visita-link-formulario': 'wa_auto_visita_enabled',
  'reuniao-cancelada': 'wa_auto_visita_enabled',
  'reuniao-reagendada': 'wa_auto_visita_enabled',
  'descadastro-confirmado': 'wa_auto_optout_enabled',
  'recadastro-confirmado': 'wa_auto_optout_enabled',
  'verificacao-sms-fallback': 'wa_auto_sms_fallback_enabled',
  'link-indicacao-sms-fallback': 'wa_auto_sms_fallback_enabled',
};

interface IntegrationSettings {
  // Z-API
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_client_token: string | null;
  zapi_enabled: boolean | null;
  // Meta Cloud API
  whatsapp_provider_active: 'zapi' | 'meta_cloud' | null;
  meta_cloud_enabled: boolean | null;
  meta_cloud_test_mode: boolean | null;
  meta_cloud_whitelist: string[] | null;
  meta_cloud_phone_number_id: string | null;
  meta_cloud_api_version: string | null;
  meta_cloud_fallback_enabled: boolean | null;
  // Auto message settings
  wa_auto_verificacao_enabled: boolean | null;
  wa_auto_captacao_enabled: boolean | null;
  wa_auto_pesquisa_enabled: boolean | null;
  wa_auto_evento_enabled: boolean | null;
  wa_auto_lideranca_enabled: boolean | null;
  wa_auto_membro_enabled: boolean | null;
  wa_auto_visita_enabled: boolean | null;
  wa_auto_optout_enabled: boolean | null;
  wa_auto_sms_fallback_enabled: boolean | null;
}

// ============ PROVIDER ABSTRACTION ============

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerUsed: 'zapi' | 'meta_cloud';
}

async function sendViaZapi(
  settings: IntegrationSettings,
  phone: string,
  message: string
): Promise<SendResult> {
  if (!settings.zapi_instance_id || !settings.zapi_token) {
    return { success: false, error: "Credenciais Z-API não configuradas", providerUsed: 'zapi' };
  }

  const zapiUrl = `https://api.z-api.io/instances/${settings.zapi_instance_id}/token/${settings.zapi_token}/send-text`;
  
  const response = await fetch(zapiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.zapi_client_token && { "Client-Token": settings.zapi_client_token }),
    },
    body: JSON.stringify({
      phone: phone,
      message: message,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    return { 
      success: false, 
      error: data.error || data.message || "Erro ao enviar via Z-API",
      providerUsed: 'zapi'
    };
  }

  return { 
    success: true, 
    messageId: data.zapiMessageId || data.messageId,
    providerUsed: 'zapi'
  };
}

async function sendViaMetaCloud(
  settings: IntegrationSettings,
  phone: string,
  message: string,
  metaTemplate?: MetaTemplatePayload
): Promise<SendResult> {
  const accessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
  
  if (!accessToken) {
    return { 
      success: false, 
      error: "META_WA_ACCESS_TOKEN não está configurado nos secrets",
      providerUsed: 'meta_cloud'
    };
  }

  if (!settings.meta_cloud_phone_number_id) {
    return { 
      success: false, 
      error: "Phone Number ID não configurado",
      providerUsed: 'meta_cloud'
    };
  }

  const apiVersion = settings.meta_cloud_api_version || "v20.0";
  const graphUrl = `https://graph.facebook.com/${apiVersion}/${settings.meta_cloud_phone_number_id}/messages`;

  // Format phone for Graph API (needs country code without +)
  let formattedPhone = phone.replace(/\D/g, "");
  // Ensure it starts with country code (55 for Brazil)
  if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
    formattedPhone = "55" + formattedPhone;
  }

  // Build request body - template or text
  let body: object;

  if (metaTemplate) {
    // Send as structured template (for initiating conversations)
    body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "template",
      template: metaTemplate,
    };
    console.log(`[send-whatsapp] Sending Meta template: ${metaTemplate.name}`);
  } else {
    // Send as free-form text (only works within 24h window)
    body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "text",
      text: { body: message },
    };
  }

  console.log("[send-whatsapp] Meta Cloud API request body:", JSON.stringify(body));

  const response = await fetch(graphUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  
  console.log("[send-whatsapp] Meta Cloud API response:", JSON.stringify(data));

  if (!response.ok) {
    return { 
      success: false, 
      error: data.error?.message || "Erro ao enviar via Meta Cloud API",
      providerUsed: 'meta_cloud'
    };
  }

  return { 
    success: true, 
    messageId: data.messages?.[0]?.id,
    providerUsed: 'meta_cloud'
  };
}

function isPhoneInWhitelist(phone: string, whitelist: string[] | null): boolean {
  if (!whitelist || whitelist.length === 0) return false;
  
  const cleanPhone = phone.replace(/\D/g, "");
  
  return whitelist.some(whitelistedPhone => {
    const cleanWhitelisted = whitelistedPhone.replace(/\D/g, "");
    return cleanPhone === cleanWhitelisted || 
           cleanPhone.endsWith(cleanWhitelisted) || 
           cleanWhitelisted.endsWith(cleanPhone);
  });
}


// ============ END PROVIDER ABSTRACTION ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody: SendWhatsAppRequest = await req.json();
    const { phone, message, templateSlug, variables, visitId, contactId, imageUrl, providerOverride, clientMessageId, metaTemplate, bypassAutoCheck } = requestBody;

    console.log(`[send-whatsapp] REQUEST - templateSlug: ${templateSlug}, phone: ${phone?.substring(0, 6)}..., providerOverride: ${providerOverride}, bypassAutoCheck: ${bypassAutoCheck}`);

    const isPublicTemplate = templateSlug && PUBLIC_TEMPLATES.includes(templateSlug);

    // ============ AUTHENTICATION CHECK ============
    if (!isPublicTemplate) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: "Não autenticado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin", "atendente"])
        .limit(1)
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ success: false, error: "Acesso não autorizado. Requer permissão de admin ou atendente." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[send-whatsapp] Authenticated user with role: ${roleData.role}`);
    }

    // ============ LOAD SETTINGS ============
    const { data: settings, error: settingsError } = await supabase
      .from("integrations_settings")
      .select(`
        zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled,
        whatsapp_provider_active, meta_cloud_enabled, meta_cloud_test_mode,
        meta_cloud_whitelist, meta_cloud_phone_number_id, meta_cloud_api_version,
        meta_cloud_fallback_enabled,
        wa_auto_verificacao_enabled, wa_auto_captacao_enabled, wa_auto_pesquisa_enabled,
        wa_auto_evento_enabled, wa_auto_lideranca_enabled, wa_auto_membro_enabled,
        wa_auto_visita_enabled, wa_auto_optout_enabled, wa_auto_sms_fallback_enabled
      `)
      .limit(1)
      .single();

    if (settingsError) {
      console.error("[send-whatsapp] Erro ao buscar configurações:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configurações" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedSettings = settings as IntegrationSettings;

    // ============ DETERMINE PROVIDER ============
    let activeProvider: 'zapi' | 'meta_cloud' | 'dialog360' = providerOverride || typedSettings.whatsapp_provider_active || 'zapi';
    
    // Validate provider availability
    if (activeProvider === 'dialog360') {
      if (!typedSettings.dialog360_enabled) {
        console.log("[send-whatsapp] 360dialog disabled, falling back to Z-API");
        activeProvider = 'zapi';
      }
    }
    
    if (activeProvider === 'meta_cloud') {
      if (!typedSettings.meta_cloud_enabled) {
        console.log("[send-whatsapp] Meta Cloud disabled, falling back to Z-API");
        activeProvider = 'zapi';
      }
    }
    
    if (activeProvider === 'zapi') {
      if (!typedSettings.zapi_enabled) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum provedor WhatsApp está habilitado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[send-whatsapp] Active provider: ${activeProvider}`);

    // ============ TEST MODE CHECK FOR META CLOUD ============
    if (activeProvider === 'meta_cloud' && typedSettings.meta_cloud_test_mode) {
      const cleanPhone = phone.replace(/\D/g, "");
      const isWhitelisted = isPhoneInWhitelist(cleanPhone, typedSettings.meta_cloud_whitelist);
      
      if (!isWhitelisted) {
        console.log(`[send-whatsapp] Phone ${cleanPhone.substring(0, 6)}... not in whitelist, test mode active`);
        
        if (typedSettings.meta_cloud_fallback_enabled && typedSettings.zapi_enabled) {
          console.log("[send-whatsapp] Using Z-API as fallback (test mode restriction)");
          activeProvider = 'zapi';
        } else {
          return new Response(
            JSON.stringify({ success: false, error: "Número não está na whitelist do modo teste", testMode: true }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ============ TEST MODE CHECK FOR 360DIALOG ============
    if (activeProvider === 'dialog360' && typedSettings.dialog360_test_mode) {
      const cleanPhone = phone.replace(/\D/g, "");
      const isWhitelisted = isPhoneInWhitelist(cleanPhone, typedSettings.dialog360_whitelist);
      
      if (!isWhitelisted) {
        console.log(`[send-whatsapp] Phone ${cleanPhone.substring(0, 6)}... not in 360dialog whitelist, test mode active`);
        
        if (typedSettings.dialog360_fallback_enabled && typedSettings.zapi_enabled) {
          console.log("[send-whatsapp] Using Z-API as fallback (360dialog test mode restriction)");
          activeProvider = 'zapi';
        } else {
          return new Response(
            JSON.stringify({ success: false, error: "Número não está na whitelist do modo teste (360dialog)", testMode: true }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ============ CHECK AUTO MESSAGE CATEGORY ============
    // Templates de verificação NUNCA devem ser bloqueados quando o método de verificação é whatsapp_consent
    // Isso evita falhas silenciosas causadas por wa_auto_verificacao_enabled=false
    const VERIFICATION_TEMPLATES = ['verificacao-cadastro', 'verificacao-codigo', 'verificacao-confirmada', 'verificacao-sms-fallback', 'link-indicacao-sms-fallback'];
    const isVerificationTemplate = templateSlug && VERIFICATION_TEMPLATES.includes(templateSlug);
    
    // Auto-bypass para templates de verificação quando o método ativo é whatsapp_consent
    let effectiveBypass = bypassAutoCheck || false;
    if (isVerificationTemplate && !effectiveBypass) {
      // Buscar verification_method para decidir se deve fazer bypass automático
      const { data: verSettings } = await supabase
        .from("integrations_settings")
        .select("verification_method")
        .limit(1)
        .single();
      
      if (verSettings?.verification_method === 'whatsapp_consent') {
        effectiveBypass = true;
        console.log(`[send-whatsapp] Auto-bypassing check for verification template '${templateSlug}' (verification_method=whatsapp_consent)`);
      }
    }
    
    if (templateSlug && !effectiveBypass) {
      const settingColumn = TEMPLATE_SETTINGS_MAP[templateSlug];
      if (settingColumn) {
        const isEnabled = typedSettings[settingColumn as keyof IntegrationSettings];
        if (isEnabled === false) {
          console.log(`[send-whatsapp] Auto message '${templateSlug}' is disabled`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Mensagem automática '${templateSlug}' está desabilitada`,
              disabled: true
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } else if (effectiveBypass) {
      console.log(`[send-whatsapp] Bypassing auto check for template '${templateSlug}'`);
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ PROCESS MESSAGE ============
    let finalMessage = message;

    if (templateSlug) {
      console.log(`[send-whatsapp] Loading template: ${templateSlug}`);
      
      const { data: template, error: templateError } = await supabase
        .from("whatsapp_templates")
        .select("mensagem, is_active")
        .eq("slug", templateSlug)
        .single();

      if (templateError || !template) {
        return new Response(
          JSON.stringify({ success: false, error: `Template '${templateSlug}' não encontrado` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!template.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "Template está inativo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (ANTI_SPAM_TEMPLATES.includes(templateSlug) && variables) {
        finalMessage = await generateMessageVariation(template.mensagem, variables);
      } else {
        finalMessage = variables 
          ? replaceTemplateVariables(template.mensagem, variables)
          : template.mensagem;
      }
    }

    if (!finalMessage) {
      return new Response(
        JSON.stringify({ success: false, error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "");
    console.log(`[send-whatsapp] Sending to ${cleanPhone.substring(0, 6)}... via ${activeProvider}`);

    // ============ CREATE MESSAGE RECORD ============
    const { data: messageRecord, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert({
        phone: cleanPhone,
        message: finalMessage,
        direction: "outgoing",
        status: "pending",
        visit_id: visitId || null,
        contact_id: contactId || null,
        provider: activeProvider,
        client_message_id: clientMessageId || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[send-whatsapp] Error creating message record:", insertError);
    }

    // ============ SEND MESSAGE ============
    let result: SendResult;
    
    if (activeProvider === 'dialog360') {
      result = await sendVia360Dialog(typedSettings, cleanPhone, finalMessage, metaTemplate);
      
      // Fallback to Z-API if 360dialog fails and fallback is enabled
      if (!result.success && typedSettings.dialog360_fallback_enabled && typedSettings.zapi_enabled) {
        console.log(`[send-whatsapp] 360dialog failed: ${result.error}, trying Z-API fallback`);
        result = await sendViaZapi(typedSettings, cleanPhone, finalMessage);
      }
    } else if (activeProvider === 'meta_cloud') {
      result = await sendViaMetaCloud(typedSettings, cleanPhone, finalMessage, metaTemplate);
      
      // Fallback to Z-API if Meta Cloud fails and fallback is enabled
      if (!result.success && typedSettings.meta_cloud_fallback_enabled && typedSettings.zapi_enabled) {
        console.log(`[send-whatsapp] Meta Cloud failed: ${result.error}, trying Z-API fallback`);
        result = await sendViaZapi(typedSettings, cleanPhone, finalMessage);
      }
    } else {
      result = await sendViaZapi(typedSettings, cleanPhone, finalMessage);
    }

    // ============ UPDATE MESSAGE RECORD ============
    if (messageRecord?.id) {
      await supabase
        .from("whatsapp_messages")
        .update({
          status: result.success ? "sent" : "failed",
          sent_at: result.success ? new Date().toISOString() : null,
          message_id: result.messageId || null,
          error_message: result.success ? null : result.error,
          provider: result.providerUsed,
        })
        .eq("id", messageRecord.id);
    }

    // ============ UPDATE VISIT IF APPLICABLE ============
    if (visitId) {
      await supabase
        .from("office_visits")
        .update({
          webhook_sent_at: new Date().toISOString(),
          webhook_last_status: result.success ? 200 : 500,
          webhook_error: result.success ? null : result.error,
        })
        .eq("id", visitId);
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          providerUsed: result.providerUsed
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ SEND IMAGE IF PROVIDED ============
    if (imageUrl && result.success && activeProvider === 'zapi') {
      console.log(`[send-whatsapp] Sending image: ${imageUrl}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const zapiImageUrl = `https://api.z-api.io/instances/${typedSettings.zapi_instance_id}/token/${typedSettings.zapi_token}/send-image`;
      
      try {
        await fetch(zapiImageUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(typedSettings.zapi_client_token && { "Client-Token": typedSettings.zapi_client_token }),
          },
          body: JSON.stringify({
            phone: cleanPhone,
            image: imageUrl,
          }),
        });
      } catch (imageError) {
        console.error("[send-whatsapp] Error sending image:", imageError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messageId,
        providerUsed: result.providerUsed,
        recordId: messageRecord?.id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-whatsapp] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
