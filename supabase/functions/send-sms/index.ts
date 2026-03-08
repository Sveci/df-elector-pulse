import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSMSRequest {
  phone: string;
  message?: string;
  templateSlug?: string;
  variables?: Record<string, string>;
  contactId?: string;
  leaderId?: string;
}

// Production URL for verification links
const PRODUCTION_URL = "https://rafael-prudente.lovable.app";

function generateLeaderVerificationUrl(verificationCode: string): string {
  return `${PRODUCTION_URL}/verificar-lider/${verificationCode}`;
}

function generateContactVerificationUrl(verificationCode: string): string {
  return `${PRODUCTION_URL}/verificar-contato/${verificationCode}`;
}

// Extract only the first name from a full name
function getFirstName(fullName: string): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0];
}

// Truncate text to SMS limit (160 characters)
function truncateToSMSLimit(message: string, limit: number = 160): string {
  if (!message) return "";
  if (message.length <= limit) return message;
  return message.substring(0, limit - 3) + "...";
}

function replaceTemplateVariables(message: string, variables: Record<string, string>): string {
  let result = message;
  for (const [key, value] of Object.entries(variables)) {
    // For 'nome' variable, use only the first name to save characters
    const finalValue = key === "nome" ? getFirstName(value) : value;
    result = result.replace(new RegExp(`{{${key}}}`, "g"), finalValue || "");
  }
  // Ensure the final message respects the 160 character limit
  return truncateToSMSLimit(result);
}

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  let clean = phone.replace(/\D/g, "");
  
  // Remove country code if present
  if (clean.startsWith("55") && clean.length > 11) {
    clean = clean.substring(2);
  }
  
  // If 10 digits and starts with DF area code, add 9
  if (clean.length === 10 && clean.startsWith("61")) {
    clean = "61" + "9" + clean.substring(2);
  }
  
  return clean;
}

// Send SMS via SMSDEV API
async function sendViaSMSDev(
  phone: string,
  message: string,
  apiKey: string
): Promise<{ success: boolean; id?: string; error?: string; description?: string }> {
  const encodedMessage = encodeURIComponent(message);
  const smsdevUrl = `https://api.smsdev.com.br/v1/send?key=${apiKey}&type=9&number=${phone}&msg=${encodedMessage}`;

  console.log("[send-sms] Sending via SMSDEV...");
  
  const response = await fetch(smsdevUrl);
  const result = await response.json();
  
  console.log("[send-sms] SMSDEV response:", result);

  if (result.situacao === "OK") {
    return { 
      success: true, 
      id: result.id, 
      description: result.descricao 
    };
  }
  
  return { 
    success: false, 
    error: result.descricao || "Erro desconhecido SMSDEV" 
  };
}

// Send SMS via SMSBarato API
async function sendViaSMSBarato(
  phone: string,
  message: string,
  apiKey: string
): Promise<{ success: boolean; id?: string; error?: string; description?: string }> {
  const encodedMessage = encodeURIComponent(message);
  
  // Endpoint correto conforme documentação SMSBarato
  const endpoint = `https://sistema81.smsbarato.com.br/send?chave=${apiKey}&dest=${phone}&text=${encodedMessage}`;

  console.log("[send-sms] Sending via SMSBarato...");
  console.log("[send-sms] Endpoint:", endpoint.replace(apiKey, '***'));
  
  const response = await fetch(endpoint);
  const result = await response.text();
  
  console.log("[send-sms] SMSBarato response:", result.substring(0, 200));

  // Check if response is HTML (error page)
  if (result.includes("<!DOCTYPE html>") || result.includes("<html>")) {
    return { 
      success: false, 
      error: "Endpoint indisponível" 
    };
  }

  const trimmedResult = result.trim();
  
  // Código 900 = erro de autenticação
  if (trimmedResult === "900") {
    return { 
      success: false, 
      error: "Erro de autenticação - API Key inválida (código 900)" 
    };
  }
  
  // Código 010 = mensagem vazia
  if (trimmedResult === "010") {
    return { 
      success: false, 
      error: "Mensagem vazia (código 010)" 
    };
  }
  
  // Código 013 = número incorreto
  if (trimmedResult === "013") {
    return { 
      success: false, 
      error: "Número de telefone incorreto (código 013)" 
    };
  }

  // ERRO3 / Link não autorizado (filtro anti-spam / domínio não autorizado)
  if (
    trimmedResult === "ERRO3" ||
    /link\s+nao\s+autorizado/i.test(trimmedResult) ||
    /nao\s+autorizado/i.test(trimmedResult)
  ) {
    return {
      success: false,
      error:
        "Link não autorizado pelo provedor (ERRO3). Autorize o domínio do link no painel do provedor ou use outro provedor sem bloqueio de links.",
    };
  }

  // Retorno numérico positivo = ID do lote (sucesso)
  const messageId = parseInt(trimmedResult, 10);
  
  if (!isNaN(messageId) && messageId > 0) {
    return { 
      success: true, 
      id: trimmedResult, 
      description: "Mensagem enviada com sucesso" 
    };
  }
  
  return { 
    success: false, 
    error: `Resposta inesperada da API: ${trimmedResult}` 
  };
}

// Send SMS via Disparopro API (Bearer Token)
async function sendViaDisparopro(
  phone: string,
  message: string,
  token: string
): Promise<{ success: boolean; id?: string; error?: string; description?: string }> {
  console.log("[send-sms] Sending via Disparopro with Bearer token...");
  
  const response = await fetch("https://apihttp.disparopro.com.br:8433/mt", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      numero: phone,
      mensagem: message,
    }),
  });
  
  const result = await response.json();
  
  console.log("[send-sms] Disparopro response:", JSON.stringify(result));

  // Disparopro API returns status 200 with message ID on success
  if (response.ok && result.status === 200) {
    return { 
      success: true, 
      id: result.detail?.id || result.id || "sent", 
      description: "Mensagem enviada com sucesso" 
    };
  }
  
  // Map error responses
  let errorMessage = "Erro desconhecido Disparopro";
  
  if (response.status === 401 || response.status === 403) {
    errorMessage = "Erro de autenticação - verifique o token";
  } else if (result.detail || result.message) {
    errorMessage = result.detail || result.message;
  }
  
  return { 
    success: false, 
    error: errorMessage 
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, message, templateSlug, variables, contactId, leaderId }: SendSMSRequest = await req.json();

    console.log("[send-sms] Request received:", { phone, templateSlug, hasMessage: !!message });

    // Validate required fields
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message && !templateSlug) {
      return new Response(
        JSON.stringify({ success: false, error: "Message or templateSlug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get SMS settings including active provider
    const { data: settings, error: settingsError } = await supabase
      .from("integrations_settings")
      .select("smsdev_api_key, smsdev_enabled, smsbarato_api_key, smsbarato_enabled, disparopro_token, disparopro_enabled, sms_active_provider")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error("[send-sms] Settings error:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Configurações SMS não encontradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine active provider
    const activeProvider = settings.sms_active_provider || 'smsdev';
    console.log("[send-sms] Active provider:", activeProvider);

    // Validate provider configuration
    if (activeProvider === 'smsdev') {
      if (!settings.smsdev_enabled) {
        return new Response(
          JSON.stringify({ success: false, error: "Integração SMSDEV não está habilitada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!settings.smsdev_api_key) {
        return new Response(
          JSON.stringify({ success: false, error: "API Key SMSDEV não configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (activeProvider === 'smsbarato') {
      if (!settings.smsbarato_enabled) {
        return new Response(
          JSON.stringify({ success: false, error: "Integração SMSBarato não está habilitada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!settings.smsbarato_api_key) {
        return new Response(
          JSON.stringify({ success: false, error: "API Key SMSBarato não configurada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (activeProvider === 'disparopro') {
      if (!settings.disparopro_enabled) {
        return new Response(
          JSON.stringify({ success: false, error: "Integração Disparopro não está habilitada" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!settings.disparopro_token) {
        return new Response(
          JSON.stringify({ success: false, error: "Token Disparopro não configurado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get message content
    let finalMessage = message || "";

    // If message is provided directly (no template), apply a safe heuristic:
    // - If it starts with a full name followed by a comma, keep only the first name.
    //   Example: "Bruno Pereira da Silva, ..." -> "Bruno, ..."
    if (!templateSlug && finalMessage) {
      const m = finalMessage.match(/^([^,]{1,40}),\s*(.*)$/);
      if (m) {
        const firstName = getFirstName(m[1] || "");
        finalMessage = `${firstName}, ${m[2]}`;
      }
    }

    if (templateSlug) {
      const { data: template, error: templateError } = await supabase
        .from("sms_templates")
        .select("*")
        .eq("slug", templateSlug)
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        console.error("[send-sms] Template error:", templateError);
        return new Response(
          JSON.stringify({ success: false, error: `Template '${templateSlug}' não encontrado` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create a mutable copy of variables for fallback injection
      const finalVariables = { ...(variables || {}) };

      // Auto-inject organization data (politico + cargo) into all messages
      if (!finalVariables.politico || !finalVariables.cargo) {
        const { data: org } = await supabase
          .from("organization")
          .select("nome, cargo")
          .limit(1)
          .single();

        if (org) {
          if (!finalVariables.politico && org.nome) {
            finalVariables.politico = org.nome;
          }
          if (!finalVariables.cargo && org.cargo) {
            finalVariables.cargo = org.cargo;
          }
        }
      }

      // FALLBACK: If template is leader verification and link_verificacao is missing, generate it
      if (templateSlug === "verificacao-lider-sms" && !finalVariables.link_verificacao && leaderId) {
        console.log("[send-sms] Fallback: generating link_verificacao for leader", leaderId);
        
        // Fetch leader to get/generate verification_code
        const { data: leader, error: leaderError } = await supabase
          .from("lideres")
          .select("id, verification_code, nome_completo")
          .eq("id", leaderId)
          .single();

        if (!leaderError && leader) {
          let verificationCode = leader.verification_code;

          // Generate new code ONLY if missing (never overwrite existing codes)
          if (!verificationCode) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            verificationCode = Array(6)
              .fill(0)
              .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
              .join("");

            // Persist code
            await supabase
              .from("lideres")
              .update({
                verification_code: verificationCode,
                verification_sent_at: new Date().toISOString(),
              })
              .eq("id", leaderId);

            console.log("[send-sms] Generated new verification_code for leader:", leaderId);
          } else {
            console.log("[send-sms] Using existing verification_code for leader:", leaderId);
          }

          finalVariables.link_verificacao = generateLeaderVerificationUrl(verificationCode);
          
          // Also ensure nome is available
          if (!finalVariables.nome && leader.nome_completo) {
            finalVariables.nome = leader.nome_completo;
          }
          
          console.log("[send-sms] Injected link_verificacao:", finalVariables.link_verificacao);
        } else {
          console.error("[send-sms] Could not fetch leader for fallback:", leaderError);
        }
      }

      // FALLBACK: If template is contact verification and link_verificacao is missing, generate it
      if (templateSlug === "verificacao-link-sms" && !finalVariables.link_verificacao && contactId) {
        console.log("[send-sms] Fallback: generating link_verificacao for contact", contactId);
        
        // Fetch contact to get/generate verification_code
        const { data: contact, error: contactError } = await supabase
          .from("office_contacts")
          .select("id, verification_code, nome")
          .eq("id", contactId)
          .single();

        if (!contactError && contact) {
          let verificationCode = contact.verification_code;

          // Generate new code ONLY if missing (never overwrite existing codes)
          if (!verificationCode) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            verificationCode = Array(6)
              .fill(0)
              .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
              .join("");

            // Persist code
            await supabase
              .from("office_contacts")
              .update({
                verification_code: verificationCode,
                verification_sent_at: new Date().toISOString(),
              })
              .eq("id", contactId);

            console.log("[send-sms] Generated new verification_code for contact:", contactId);
          } else {
            console.log("[send-sms] Using existing verification_code for contact:", contactId);
          }

          finalVariables.link_verificacao = generateContactVerificationUrl(verificationCode);
          
          // Also ensure nome is available
          if (!finalVariables.nome && contact.nome) {
            finalVariables.nome = contact.nome;
          }
          
          console.log("[send-sms] Injected link_verificacao:", finalVariables.link_verificacao);
        } else {
          console.error("[send-sms] Could not fetch contact for fallback:", contactError);
        }
      }

      // Validate: if template still has unreplaced {{link_verificacao}}, block sending
      const templateHasLinkVar = template.mensagem.includes("{{link_verificacao}}");
      if (templateHasLinkVar && !finalVariables.link_verificacao) {
        console.error("[send-sms] BLOCKED: template requires link_verificacao but it's missing");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Template requer link_verificacao mas não foi possível gerá-lo. Verifique se leaderId ou contactId foi informado." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalMessage = replaceTemplateVariables(template.mensagem, finalVariables);
    }

    // Enforce 160 character SMS limit for ALL messages (template or direct)
    finalMessage = truncateToSMSLimit(finalMessage);

    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);
    console.log("[send-sms] Normalized phone:", normalizedPhone);

    // Create message record with pending status and provider
    const { data: messageRecord, error: insertError } = await supabase
      .from("sms_messages")
      .insert({
        phone: normalizedPhone,
        message: finalMessage,
        direction: "outgoing",
        status: "pending",
        contact_id: contactId || null,
        provider: activeProvider,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[send-sms] Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao registrar mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via the active provider
    let sendResult: { success: boolean; id?: string; error?: string; description?: string };
    let usedProvider = activeProvider;
    
    try {
      if (activeProvider === 'smsdev') {
        sendResult = await sendViaSMSDev(normalizedPhone, finalMessage, settings.smsdev_api_key!);
      } else if (activeProvider === 'smsbarato') {
        sendResult = await sendViaSMSBarato(normalizedPhone, finalMessage, settings.smsbarato_api_key!);

        // Fallback automático: se o provedor bloquear links (ERRO3 / não autorizado), tenta SMSDEV
        if (
          !sendResult.success &&
          settings.smsdev_enabled &&
          settings.smsdev_api_key &&
          (sendResult.error || "").toLowerCase().includes("link não autorizado")
        ) {
          console.log("[send-sms] SMSBarato bloqueou link; tentando fallback via SMSDEV...");
          const fallbackResult = await sendViaSMSDev(normalizedPhone, finalMessage, settings.smsdev_api_key);
          if (fallbackResult.success) {
            usedProvider = 'smsdev';
            sendResult = fallbackResult;
          }
        }
      } else {
        sendResult = await sendViaDisparopro(normalizedPhone, finalMessage, settings.disparopro_token!);
      }
    } catch (fetchError) {
      console.error("[send-sms] Fetch error:", fetchError);
      
      // Update message to failed status due to connection error
      await supabase
        .from("sms_messages")
        .update({
          status: "failed",
          error_message: `Erro de conexão com API ${activeProvider.toUpperCase()}: ` + 
            (fetchError instanceof Error ? fetchError.message : "Unknown error"),
        })
        .eq("id", messageRecord.id);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro de conexão com API ${activeProvider.toUpperCase()}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update message record based on response
    if (sendResult.success) {
      await supabase
        .from("sms_messages")
        .update({
          message_id: sendResult.id,
          status: "queued",
          sent_at: new Date().toISOString(),
          provider: usedProvider,
        })
        .eq("id", messageRecord.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: messageRecord.id,
            messageId: sendResult.id,
            status: "queued",
            provider: activeProvider,
            description: sendResult.description,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Update with error
      await supabase
        .from("sms_messages")
        .update({
          status: "failed",
          error_message: sendResult.error || "Erro desconhecido",
          provider: usedProvider,
        })
        .eq("id", messageRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: sendResult.error || "Erro ao enviar SMS",
          provider: activeProvider,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("[send-sms] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
