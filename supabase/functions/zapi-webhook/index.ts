import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZapiMessageStatus {
  zapiMessageId?: string;
  messageId?: string;
  ids?: string[];
  status?: string;
  type?: string;
  phone?: { user?: string } | string;
  chatId?: string;
  isStatusReply?: boolean;
}

interface ZapiReceivedMessage {
  zapiMessageId?: string;
  messageId?: string;
  phone?: string;
  chatId?: string;
  text?: { message?: string };
  fromMe?: boolean;
  senderName?: string;
  type?: string;
}

interface ZapiConnectionStatus {
  connected?: boolean;
  status?: string;
  error?: string;
  type?: string;
}

interface IntegrationSettings {
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_client_token?: string | null;
  zapi_enabled: boolean | null;
  resend_api_key: string | null;
  resend_enabled: boolean | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
  wa_auto_verificacao_enabled: boolean | null;
  wa_auto_optout_enabled: boolean | null;
  // Campos de verificação WhatsApp
  verification_method: string | null;
  verification_wa_enabled: boolean | null;
  verification_wa_keyword: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    console.log("[zapi-webhook] Received webhook:", JSON.stringify(body));

    // Detect webhook type based on payload structure
    const webhookType = detectWebhookType(body);
    console.log("[zapi-webhook] Detected webhook type:", webhookType, "| Z-API type:", body.type);

    switch (webhookType) {
      case "message-status":
        await handleMessageStatus(supabase, body as ZapiMessageStatus);
        break;
      case "received-message":
        await handleReceivedMessage(supabase, body as ZapiReceivedMessage);
        break;
      case "connection-status":
        await handleConnectionStatus(supabase, body as ZapiConnectionStatus);
        break;
      default:
        console.log("[zapi-webhook] Unknown webhook type, logging only");
    }

    return new Response(
      JSON.stringify({ success: true, type: webhookType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[zapi-webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function detectWebhookType(body: Record<string, unknown>): string {
  // Use Z-API's 'type' field as primary source
  const zapiType = body.type as string | undefined;
  
  if (zapiType) {
    switch (zapiType) {
      case "MessageStatusCallback":
      case "DeliveryCallback":
      case "ReadCallback":
        return "message-status";
      case "ReceivedCallback":
        return "received-message";
      case "DisconnectedCallback":
      case "ConnectedCallback":
        return "connection-status";
    }
  }
  
  // Fallback to previous logic if no 'type' field
  if (body.status && (body.zapiMessageId || body.messageId || body.ids)) {
    return "message-status";
  }
  
  if (body.text || (body.phone && !body.status && !zapiType)) {
    return "received-message";
  }
  
  if (body.connected !== undefined) {
    return "connection-status";
  }
  
  return "unknown";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMessageStatus(supabase: any, data: ZapiMessageStatus) {
  // Extract messageId from multiple possible sources
  const messageId = data.zapiMessageId || data.messageId || 
    (Array.isArray(data.ids) && data.ids.length > 0 ? data.ids[0] : null);
  
  if (!messageId) {
    console.log("[zapi-webhook] No messageId in status update, data:", JSON.stringify(data));
    return;
  }

  // Determine status based on callback type and status field
  let status = data.status?.toLowerCase();
  const zapiType = data.type;
  
  // If DeliveryCallback without explicit status, it's "delivered"
  if (zapiType === "DeliveryCallback" && !status) {
    status = "delivered";
  }
  // If ReadCallback without explicit status, it's "read"
  if (zapiType === "ReadCallback" && !status) {
    status = "read";
  }
  // Map common Z-API statuses
  if (status === "received") {
    status = "delivered";
  }

  console.log(`[zapi-webhook] Updating message ${messageId} status to ${status} (type: ${zapiType})`);

  const updateData: Record<string, unknown> = {
    status: mapZapiStatus(status),
    updated_at: new Date().toISOString(),
  };

  // Set timestamps based on status
  const mappedStatus = mapZapiStatus(status);
  if (mappedStatus === "delivered") {
    updateData.delivered_at = new Date().toISOString();
  } else if (mappedStatus === "read") {
    updateData.read_at = new Date().toISOString();
    // Also set delivered_at if not already set
    updateData.delivered_at = new Date().toISOString();
  } else if (mappedStatus === "failed") {
    updateData.error_message = data.status || "Failed";
  }

  const { error, count } = await supabase
    .from("whatsapp_messages")
    .update(updateData)
    .eq("message_id", messageId);

  if (error) {
    console.error("[zapi-webhook] Error updating message status:", error);
  } else {
    console.log(`[zapi-webhook] Message status updated successfully (matched: ${count})`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleReceivedMessage(supabase: any, data: ZapiReceivedMessage) {
  // Skip messages sent by us
  if (data.fromMe) {
    console.log("[zapi-webhook] Skipping outgoing message");
    return;
  }

  const phone = data.phone || data.chatId?.replace("@c.us", "");
  const message = data.text?.message || "";
  const messageId = data.zapiMessageId || data.messageId;

  if (!phone || !message) {
    console.log("[zapi-webhook] Missing phone or message in received message");
    return;
  }

  console.log(`[zapi-webhook] Received message from ${phone}: ${message.substring(0, 50)}...`);

  // Deduplication: check if this messageId was already processed
  if (messageId) {
    const { data: existingMsg } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("message_id", messageId)
      .limit(1)
      .single();
    
    if (existingMsg) {
      console.log(`[zapi-webhook] Duplicate messageId ${messageId} detected, skipping processing`);
      return;
    }
  }

  // Get integration settings to check category toggles
  const { data: settings } = await supabase
    .from("integrations_settings")
    .select("zapi_instance_id, zapi_token, zapi_client_token, zapi_enabled, wa_auto_verificacao_enabled, wa_auto_optout_enabled, resend_api_key, resend_enabled, resend_from_email, resend_from_name, verification_method, verification_wa_enabled, verification_wa_keyword")
    .limit(1)
    .single();

  const typedSettings = settings as IntegrationSettings | null;

  // Try to find associated contact by phone
  const normalizedPhone = normalizePhone(phone);
  const { data: contact } = await supabase
    .from("office_contacts")
    .select("id, nome, is_verified, verification_code, source_id, source_type, pending_messages, is_active, telefone_norm")
    .eq("telefone_norm", normalizedPhone)
    .limit(1)
    .single();

  // Check for opt-out commands
  const optOutCommands = ["SAIR", "PARAR", "CANCELAR", "DESCADASTRAR", "STOP", "UNSUBSCRIBE"];
  const normalizedMessage = message.trim().toUpperCase();
  
  if (optOutCommands.includes(normalizedMessage)) {
    console.log(`[zapi-webhook] Opt-out command detected: ${normalizedMessage}`);
    
    if (contact && contact.is_active !== false) {
      // Mark contact as inactive
      const { error: optOutError } = await supabase
        .from("office_contacts")
        .update({
          is_active: false,
          opted_out_at: new Date().toISOString(),
          opt_out_reason: `Solicitação via WhatsApp: ${normalizedMessage}`,
          opt_out_channel: "whatsapp",
        })
        .eq("id", contact.id);
      
      if (optOutError) {
        console.error("[zapi-webhook] Error processing opt-out:", optOutError);
      } else {
        console.log(`[zapi-webhook] Contact ${contact.id} opted out successfully`);
        // Send confirmation message only if opt-out category is enabled
        if (typedSettings?.wa_auto_optout_enabled !== false) {
          await sendOptOutConfirmation(supabase, normalizedPhone, contact.nome, typedSettings);
        } else {
          console.log("[zapi-webhook] wa_auto_optout_enabled=false, skipping opt-out confirmation");
        }
      }
    } else if (contact && contact.is_active === false) {
      console.log("[zapi-webhook] Contact already opted out");
    }
    
    // Record incoming message regardless
    await supabase.from("whatsapp_messages").insert({
      message_id: messageId,
      phone: phone,
      message: message,
      direction: "incoming",
      status: "received",
      contact_id: contact?.id || null,
      sent_at: new Date().toISOString(),
    });
    
    return;
  }

  // Check for re-subscribe command
  if (normalizedMessage === "VOLTAR" && contact && contact.is_active === false) {
    console.log("[zapi-webhook] Re-subscribe command detected");
    
    const { error: resubError } = await supabase
      .from("office_contacts")
      .update({
        is_active: true,
        opted_out_at: null,
        opt_out_reason: null,
        opt_out_channel: null,
      })
      .eq("id", contact.id);
    
    if (!resubError) {
      console.log(`[zapi-webhook] Contact ${contact.id} re-subscribed successfully`);
      // Send confirmation only if opt-out category is enabled
      if (typedSettings?.wa_auto_optout_enabled !== false) {
        await sendResubscribeConfirmation(supabase, normalizedPhone, contact.nome, typedSettings);
      } else {
        console.log("[zapi-webhook] wa_auto_optout_enabled=false, skipping re-subscribe confirmation");
      }
    }
    
    await supabase.from("whatsapp_messages").insert({
      message_id: messageId,
      phone: phone,
      message: message,
      direction: "incoming",
      status: "received",
      contact_id: contact?.id || null,
      sent_at: new Date().toISOString(),
    });
    
    return;
  }

  // Check if message is a verification code (5-6 alphanumeric chars)
  // Clean WhatsApp formatting characters: * (bold), _ (italic), ~ (strikethrough), ` (monospace)
  const cleanMessage = message
    .replace(/[*_~`]/g, '')  // Remove WhatsApp formatting characters
    .trim()
    .toUpperCase();
  
  console.log(`[zapi-webhook] Original message: "${message}"`);
  console.log(`[zapi-webhook] Cleaned message: "${cleanMessage}"`);
  
  // === RETIRAR [CODE] - Material withdrawal confirmation ===
  const retirarMatch = cleanMessage.match(/^RETIRAR\s+([A-Z0-9]{6})$/);
  if (retirarMatch) {
    const code = retirarMatch[1];
    console.log(`[zapi-webhook] Detected RETIRAR command with code: ${code}`);

    await supabase.from("whatsapp_messages").insert({
      message_id: messageId, phone: phone, message: message,
      direction: "incoming", status: "received",
      contact_id: contact?.id || null, sent_at: new Date().toISOString(),
    });

    const { data: reservation, error: resErr } = await supabase
      .from('material_reservations')
      .select('id, status, leader_id, quantidade, material_id, confirmation_code')
      .eq('confirmation_code', code)
      .single();

    if (resErr || !reservation) {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `❌ Código de retirada *${code}* não encontrado. Verifique se digitou corretamente.`, typedSettings);
      return;
    }

    const last8 = phone.replace(/\D/g, '').slice(-8);
    const { data: leader } = await supabase
      .from('lideres').select('id, nome_completo, telefone')
      .eq('id', reservation.leader_id).single();

    if (!leader || !leader.telefone || leader.telefone.replace(/\D/g, '').slice(-8) !== last8) {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `⚠️ Este código de retirada não pertence a este número de telefone.`, typedSettings);
      return;
    }

    if (reservation.status === 'withdrawn') {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `✅ Esta retirada já foi confirmada anteriormente.`, typedSettings);
      return;
    }

    if (reservation.status !== 'reserved') {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `⚠️ Esta reserva não está mais ativa (status: ${reservation.status}).`, typedSettings);
      return;
    }

    const { error: updateErr } = await supabase
      .from('material_reservations')
      .update({
        status: 'withdrawn', confirmed_via: 'whatsapp',
        confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.id);

    if (updateErr) {
      console.error('[zapi-webhook] Error confirming withdrawal:', updateErr);
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `❌ Erro ao confirmar retirada. Tente novamente.`, typedSettings);
    } else {
      const { data: material } = await supabase
        .from('campaign_materials').select('nome')
        .eq('id', reservation.material_id).single();
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `✅ Retirada confirmada com sucesso!\n\n📦 *${material?.nome || 'Material'}*\n📊 Quantidade: ${reservation.quantidade}\n👤 ${leader.nome_completo}\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        typedSettings);
      console.log(`[zapi-webhook] ✅ Withdrawal confirmed for reservation ${reservation.id}`);
    }
    return;
  }

  // === DEVOLVER [CODE] - Material return confirmation ===
  const devolverMatch = cleanMessage.match(/^DEVOLVER\s+([A-Z0-9]{6})$/);
  if (devolverMatch) {
    const code = devolverMatch[1];
    console.log(`[zapi-webhook] Detected DEVOLVER command with code: ${code}`);

    await supabase.from("whatsapp_messages").insert({
      message_id: messageId, phone: phone, message: message,
      direction: "incoming", status: "received",
      contact_id: contact?.id || null, sent_at: new Date().toISOString(),
    });

    const { data: reservation, error: resErr } = await supabase
      .from('material_reservations')
      .select('id, status, leader_id, quantidade, material_id, returned_quantity, return_confirmation_code, return_confirmed_via, return_requested_quantity')
      .eq('return_confirmation_code', code)
      .single();

    if (resErr || !reservation) {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `❌ Código de devolução *${code}* não encontrado. Verifique se digitou corretamente.`, typedSettings);
      return;
    }

    const last8ret = phone.replace(/\D/g, '').slice(-8);
    const { data: leaderRet } = await supabase
      .from('lideres').select('id, nome_completo, telefone')
      .eq('id', reservation.leader_id).single();

    if (!leaderRet || !leaderRet.telefone || leaderRet.telefone.replace(/\D/g, '').slice(-8) !== last8ret) {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `⚠️ Este código de devolução não pertence a este número de telefone.`, typedSettings);
      return;
    }

    if (reservation.status !== 'withdrawn') {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `⚠️ Esta reserva não está no status de retirada (status: ${reservation.status}).`, typedSettings);
      return;
    }

    if (reservation.return_confirmed_via) {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `✅ Esta devolução já foi confirmada anteriormente.`, typedSettings);
      return;
    }

    const returnable = reservation.quantidade - (reservation.returned_quantity || 0);
    if (returnable <= 0) {
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `✅ Todo o material já foi devolvido.`, typedSettings);
      return;
    }

    // Confirm return of requested quantity (or all remaining if no specific request)
    const returnQty = reservation.return_requested_quantity && reservation.return_requested_quantity > 0
      ? Math.min(reservation.return_requested_quantity, returnable)
      : returnable;
    const newReturnedTotal = (reservation.returned_quantity || 0) + returnQty;
    const { error: updateErr } = await supabase
      .from('material_reservations')
      .update({
        returned_quantity: newReturnedTotal,
        return_confirmed_via: 'whatsapp',
        return_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.id);

    if (updateErr) {
      console.error('[zapi-webhook] Error confirming return:', updateErr);
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `❌ Erro ao confirmar devolução. Tente novamente.`, typedSettings);
    } else {
      const { data: material } = await supabase
        .from('campaign_materials').select('nome')
        .eq('id', reservation.material_id).single();
      await sendWhatsAppMessage(supabase, normalizedPhone,
        `✅ Devolução confirmada com sucesso!\n\n📦 *${material?.nome || 'Material'}*\n📊 Quantidade devolvida: ${returnQty}\n👤 ${leaderRet.nome_completo}\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        typedSettings);
      console.log(`[zapi-webhook] ✅ Return confirmed for reservation ${reservation.id}`);
    }
    return;
  }

  // Check for CONFIRMAR [TOKEN] command (WhatsApp consent verification flow)
  const confirmMatch = cleanMessage.match(/^CONFIRMAR\s+([A-Z0-9]{5,6})$/);
  if (confirmMatch) {
    const token = confirmMatch[1];
    console.log(`[zapi-webhook] Detected CONFIRMAR command with token: ${token}`);
    
    // Record incoming message FIRST (before any processing)
    await supabase.from("whatsapp_messages").insert({
      message_id: messageId,
      phone: phone,
      message: message,
      direction: "incoming",
      status: "received",
      contact_id: contact?.id || null,
      sent_at: new Date().toISOString(),
    });
    
    // Call RPC to process verification keyword
    const { data: verifyResult, error: verifyError } = await supabase.rpc("process_verification_keyword", {
      _token: token,
      _phone: normalizedPhone
    });

    const verificationData = Array.isArray(verifyResult)
      ? verifyResult[0]
      : verifyResult;

    console.log(`[zapi-webhook] process_verification_keyword result:`, verificationData, verifyError);

    if (verificationData?.success) {
      // Ask for consent
      const consentMessage = `Olá ${verificationData.contact_name}! 👋\n\nPara confirmar seu cadastro como apoiador(a), responda *SIM* para esta mensagem.`;
      console.log(`[zapi-webhook] Sending consent question to ${normalizedPhone}`);
      
      try {
        const sendResult = await sendWhatsAppMessage(supabase, normalizedPhone, consentMessage, typedSettings);
        console.log(`[zapi-webhook] Consent message send result:`, sendResult);
        
        // Update contact_verifications to record consent question was sent
        const { error: updateError } = await supabase
          .from("contact_verifications")
          .update({ consent_question_sent_at: new Date().toISOString() })
          .eq("token", token);
        
        if (updateError) {
          console.error(`[zapi-webhook] Error updating consent_question_sent_at:`, updateError);
        }
      } catch (sendError) {
        console.error(`[zapi-webhook] Failed to send consent message to ${normalizedPhone}:`, sendError);
      }
      
      return;
    } else {
      // Token not found, already verified, or phone mismatch
      let errorMessage: string;
      if (verificationData?.error_code === 'already_verified') {
        errorMessage = `Seu cadastro já foi verificado anteriormente. ✅\n\nSe precisar de ajuda, entre em contato conosco.`;
      } else if (verificationData?.error_code === 'phone_mismatch') {
        errorMessage = `⚠️ Esse código de verificação não pertence a este número de telefone.\n\nO código deve ser enviado pelo número que foi cadastrado. Se precisar de ajuda, entre em contato conosco.`;
      } else if (verificationData?.error_code === 'token_not_found') {
        errorMessage = `Código não encontrado. Por favor, verifique se você já completou seu cadastro e se digitou o código corretamente.`;
      } else {
        errorMessage = `Não encontramos um cadastro pendente com esse código. Verifique se digitou corretamente ou entre em contato conosco.`;
      }
      await sendWhatsAppMessage(supabase, normalizedPhone, errorMessage, typedSettings);
      return;
    }
  }
  
  // Check for SIM response (consent confirmation)
  if (cleanMessage === "SIM") {
    console.log(`[zapi-webhook] Detected SIM consent response from ${normalizedPhone}`);
    
    // Call RPC to process consent
    const { data: consentResult, error: consentError } = await supabase.rpc("process_verification_consent", {
      _phone: normalizedPhone
    });

    const consentData = Array.isArray(consentResult)
      ? consentResult[0]
      : consentResult;

    console.log(`[zapi-webhook] process_verification_consent result:`, consentData, consentError);

    if (consentData?.success) {
      // Send confirmation message
      const confirmMessage = `✅ Cadastro confirmado com sucesso!\n\nVocê receberá seu link de indicação em instantes.`;
      await sendWhatsAppMessage(supabase, normalizedPhone, confirmMessage, typedSettings);
      
      // Call edge function to send affiliate links
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      try {
        console.log(`[zapi-webhook] Calling send-leader-affiliate-links for ${consentData.contact_type} ${consentData.contact_id}`);
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-leader-affiliate-links`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              leader_id: consentData.contact_id,
            }),
          }
        );
        
        const result = await response.json();
        console.log(`[zapi-webhook] send-leader-affiliate-links result:`, result);
      } catch (affiliateError) {
        console.error(`[zapi-webhook] Error sending affiliate links:`, affiliateError);
      }
      
      // Record incoming message
      await supabase.from("whatsapp_messages").insert({
        message_id: messageId,
        phone: phone,
        message: message,
        direction: "incoming",
        status: "received",
        contact_id: contact?.id || null,
        sent_at: new Date().toISOString(),
      });
      
      return;
    }
    // If no pending consent found, continue to chatbot
  }
  
  // LEGACY FLOW DISABLED: Direct code verification via WhatsApp is no longer supported.
  // Users must use the new flow: "CONFIRMAR [TOKEN]" → "SIM"
  // This prevents confusion between the old (verification_code from lideres) and new (token from contact_verifications) flows.
  const codeMatch = cleanMessage.match(/^[A-Z0-9]{5,6}$/);
  let shouldCallChatbot = false;
  
  if (codeMatch) {
    const code = codeMatch[0];
    console.log(`[zapi-webhook] Detected 5-6 char code: ${code}. Legacy direct verification is DISABLED.`);
    console.log(`[zapi-webhook] User should use "CONFIRMAR ${code}" format instead.`);
    
    // Search for contact with this verification code (only for logging/context)
    const { data: contactToVerify } = await supabase
      .from("office_contacts")
      .select("id, nome, is_verified")
      .eq("verification_code", code)
      .limit(1)
      .single();
    
    if (contactToVerify) {
      console.log(`[zapi-webhook] Found contact with code ${code}: id=${contactToVerify.id}, is_verified=${contactToVerify.is_verified}`);
      // Instead of auto-verifying, inform user of correct flow
      const helpMessage = `Para confirmar seu cadastro, use o formato: CONFIRMAR [código]\n\nExemplo: CONFIRMAR ${code}`;
      await sendWhatsAppMessage(supabase, normalizedPhone, helpMessage, typedSettings);
      
      // Record incoming message
      await supabase.from("whatsapp_messages").insert({
        message_id: messageId,
        phone: phone,
        message: message,
        direction: "incoming",
        status: "received",
        contact_id: contactToVerify?.id || null,
        sent_at: new Date().toISOString(),
      });
      return;
    }
    
    // Check for leader with this code
    const { data: leaderToVerify } = await supabase
      .from("lideres")
      .select("id, nome_completo, is_verified")
      .eq("verification_code", code)
      .limit(1)
      .single();
    
    if (leaderToVerify) {
      console.log(`[zapi-webhook] Found leader with code ${code}: id=${leaderToVerify.id}, is_verified=${leaderToVerify.is_verified}`);
      
      if (leaderToVerify.is_verified) {
        // Already verified - inform user
        const infoMessage = `Seu cadastro já foi verificado! Se você precisa do seu link de indicação, entre em contato com nossa equipe.`;
        await sendWhatsAppMessage(supabase, normalizedPhone, infoMessage, typedSettings);
      } else {
        // Not verified yet - guide to correct flow
        const helpMessage = `Para confirmar seu cadastro, use o formato: CONFIRMAR [código]\n\nExemplo: CONFIRMAR ${code}`;
        await sendWhatsAppMessage(supabase, normalizedPhone, helpMessage, typedSettings);
      }
      
      // Record incoming message
      await supabase.from("whatsapp_messages").insert({
        message_id: messageId,
        phone: phone,
        message: message,
        direction: "incoming",
        status: "received",
        contact_id: contact?.id || null,
        sent_at: new Date().toISOString(),
      });
      return;
    }
    
    // No match found - might be chatbot keyword
    console.log(`[zapi-webhook] No pending verification found for code: ${code}, checking if sender is a leader for chatbot`);
    shouldCallChatbot = true;
  } else {
    // Not a potential verification code, should check for chatbot
    shouldCallChatbot = true;
  }

  // Check if sender is an active leader and call chatbot
  if (shouldCallChatbot) {
    // Try with normalized phone (with +) and without + prefix
    const phoneWithoutPlus = normalizedPhone.replace(/^\+/, "");
    
    const { data: leader } = await supabase
      .from("lideres")
      .select("id, nome_completo")
      .or(`telefone.eq.${normalizedPhone},telefone.eq.${phoneWithoutPlus}`)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (leader) {
      console.log(`[zapi-webhook] Message from leader ${leader.nome_completo}, calling chatbot`);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      try {
        const chatbotResponse = await fetch(
          `${supabaseUrl}/functions/v1/whatsapp-chatbot`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              phone: normalizedPhone,
              message: message,
              leaderId: leader.id,
              provider: 'zapi', // Respond via Z-API when message came from Z-API
            }),
          }
        );
        
        const chatbotResult = await chatbotResponse.json();
        console.log("[zapi-webhook] Chatbot response:", JSON.stringify(chatbotResult));
      } catch (chatbotError) {
        console.error("[zapi-webhook] Error calling chatbot:", chatbotError);
      }
    }
  }

  // Insert received message
  const { error } = await supabase
    .from("whatsapp_messages")
    .insert({
      message_id: messageId,
      phone: phone,
      message: message,
      direction: "incoming",
      status: "received",
      contact_id: contact?.id || null,
      sent_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[zapi-webhook] Error saving received message:", error);
  } else {
    console.log("[zapi-webhook] Received message saved successfully");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendPendingMessages(supabase: any, contact: any, settings: IntegrationSettings | null) {
  const pendingMessages = contact.pending_messages || [];
  
  if (pendingMessages.length === 0) {
    console.log("[zapi-webhook] No pending messages to send");
    return;
  }
  
  console.log(`[zapi-webhook] Sending ${pendingMessages.length} pending messages`);
  
  // Use passed settings or fetch if not available
  let typedSettings = settings;
  if (!typedSettings) {
    const { data: fetchedSettings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_enabled, resend_api_key, resend_enabled, resend_from_email, resend_from_name")
      .limit(1)
      .single();
    typedSettings = fetchedSettings as IntegrationSettings;
  }
  
  for (const pending of pendingMessages) {
    try {
      // Check if it's an email template (prefixed with "email:")
      if (pending.template.startsWith("email:")) {
        // Process email
        const emailTemplateSlug = pending.template.replace("email:", "");
        console.log(`[zapi-webhook] Processing pending email: ${emailTemplateSlug}`);
        
        if (!typedSettings?.resend_enabled || !typedSettings?.resend_api_key) {
          console.log("[zapi-webhook] Resend not configured, skipping email");
          continue;
        }
        
        // Get email template
        const { data: emailTemplate } = await supabase
          .from("email_templates")
          .select("assunto, conteudo_html")
          .eq("slug", emailTemplateSlug)
          .single();
        
        if (!emailTemplate) {
          console.log(`[zapi-webhook] Email template ${emailTemplateSlug} not found`);
          continue;
        }
        
        // Replace variables in subject and content
        let subject = emailTemplate.assunto;
        let htmlContent = emailTemplate.conteudo_html;
        
        for (const [key, value] of Object.entries(pending.variables || {})) {
          const regex = new RegExp(`{{${key}}}`, "g");
          subject = subject.replace(regex, value as string);
          htmlContent = htmlContent.replace(regex, value as string);
        }
        
        // Get recipient email from variables
        const recipientEmail = pending.variables?.email;
        if (!recipientEmail) {
          console.log("[zapi-webhook] No email in pending message variables");
          continue;
        }
        
        // Send email via Resend
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${typedSettings.resend_api_key}`,
          },
          body: JSON.stringify({
            from: typedSettings.resend_from_email 
              ? `${typedSettings.resend_from_name || 'Sistema'} <${typedSettings.resend_from_email}>`
              : "Sistema <onboarding@resend.dev>",
            to: [recipientEmail],
            subject: subject,
            html: htmlContent,
          }),
        });
        
        const resendResult = await resendResponse.json();
        console.log(`[zapi-webhook] Sent pending email ${emailTemplateSlug}:`, resendResult);
        
        // Record in email_logs
        await supabase.from("email_logs").insert({
          to_email: recipientEmail,
          to_name: pending.variables?.nome || null,
          subject: subject,
          status: resendResult.id ? "sent" : "failed",
          resend_id: resendResult.id || null,
          sent_at: resendResult.id ? new Date().toISOString() : null,
          error_message: resendResult.error?.message || null,
          contact_id: contact.id,
          event_id: pending.variables?.eventId || null,
        });
        
      } else {
        // Process WhatsApp message
        if (!typedSettings?.zapi_enabled || !typedSettings?.zapi_instance_id || !typedSettings?.zapi_token) {
          console.log("[zapi-webhook] Z-API not configured, skipping WhatsApp message");
          continue;
        }
        
        // Get template
        const { data: template } = await supabase
          .from("whatsapp_templates")
          .select("mensagem")
          .eq("slug", pending.template)
          .single();
        
        if (!template) {
          console.log(`[zapi-webhook] Template ${pending.template} not found`);
          continue;
        }
        
        // Replace variables
        let message = template.mensagem;
        for (const [key, value] of Object.entries(pending.variables || {})) {
          message = message.replace(new RegExp(`{{${key}}}`, "g"), value as string);
        }
        
        // Send via Z-API
        const zapiUrl = `https://api.z-api.io/instances/${typedSettings.zapi_instance_id}/token/${typedSettings.zapi_token}/send-text`;
        const response = await fetch(zapiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: contact.telefone_norm.replace("+", ""),
            message: message,
          }),
        });
        
        const result = await response.json();
        console.log(`[zapi-webhook] Sent pending message ${pending.template}:`, result);
        
        // Record in whatsapp_messages
        await supabase.from("whatsapp_messages").insert({
          message_id: result.messageId || result.zapiMessageId,
          phone: contact.telefone_norm,
          message: message,
          direction: "outgoing",
          status: "sent",
          contact_id: contact.id,
          sent_at: new Date().toISOString(),
        });
      }
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (err) {
      console.error(`[zapi-webhook] Error sending pending message:`, err);
    }
  }
  
  // Clear pending messages
  await supabase
    .from("office_contacts")
    .update({ pending_messages: [] })
    .eq("id", contact.id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendVerificationConfirmation(supabase: any, phone: string, nome: string, settings: IntegrationSettings | null) {
  // Use passed settings or fetch if not available
  let typedSettings = settings;
  if (!typedSettings) {
    const { data: fetchedSettings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_enabled")
      .limit(1)
      .single();
    typedSettings = fetchedSettings as IntegrationSettings;
  }
  
  if (!typedSettings?.zapi_enabled) {
    console.log("[zapi-webhook] Z-API not enabled, skipping confirmation");
    return;
  }
  
  // Get organization name
  const { data: org } = await supabase
    .from("organization")
    .select("nome")
    .limit(1)
    .single();
  
  // Get confirmation template
  const { data: template } = await supabase
    .from("whatsapp_templates")
    .select("mensagem")
    .eq("slug", "verificacao-confirmada")
    .single();
  
  if (!template) {
    console.log("[zapi-webhook] Confirmation template not found");
    return;
  }
  
  // Replace variables
  let message = template.mensagem;
  message = message.replace(/{{nome}}/g, nome);
  message = message.replace(/{{deputado_nome}}/g, org?.nome || "Deputado");
  
  // Send via Z-API
  try {
    const zapiUrl = `https://api.z-api.io/instances/${typedSettings.zapi_instance_id}/token/${typedSettings.zapi_token}/send-text`;
    const response = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace("+", ""),
        message: message,
      }),
    });
    
    const result = await response.json();
    console.log("[zapi-webhook] Sent verification confirmation:", result);
    
    // Record in whatsapp_messages
    const { data: contact } = await supabase
      .from("office_contacts")
      .select("id")
      .eq("telefone_norm", phone)
      .single();
    
    await supabase.from("whatsapp_messages").insert({
      message_id: result.messageId || result.zapiMessageId,
      phone: phone,
      message: message,
      direction: "outgoing",
      status: "sent",
      contact_id: contact?.id,
      sent_at: new Date().toISOString(),
    });
    
  } catch (err) {
    console.error("[zapi-webhook] Error sending confirmation:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendLeaderVerificationConfirmation(supabase: any, phone: string, nome: string, affiliateToken: string | null, settings: IntegrationSettings | null) {
  // Use passed settings or fetch if not available
  let typedSettings = settings;
  if (!typedSettings) {
    const { data: fetchedSettings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_enabled")
      .limit(1)
      .single();
    typedSettings = fetchedSettings as IntegrationSettings;
  }
  
  if (!typedSettings?.zapi_enabled) {
    console.log("[zapi-webhook] Z-API not enabled, skipping leader verification confirmation");
    return;
  }
  
  // Get organization name
  const { data: org } = await supabase
    .from("organization")
    .select("nome")
    .limit(1)
    .single();
  
  // Get confirmation template for leaders
  const { data: template } = await supabase
    .from("whatsapp_templates")
    .select("mensagem")
    .eq("slug", "lider-verificado")
    .single();
  
  // Default message if template not found
  let message = template?.mensagem || `Olá ${nome}! 🎉\n\nSeu cadastro como liderança foi *verificado com sucesso*!\n\nAgora você faz parte oficial da rede de apoio do ${org?.nome || "Deputado"}.\n\nDigite *AJUDA* para ver os comandos disponíveis.`;
  
  // Replace variables
  message = message.replace(/{{nome}}/g, nome);
  message = message.replace(/{{deputado_nome}}/g, org?.nome || "Deputado");
  if (affiliateToken) {
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://df-elector-pulse.lovable.app";
    message = message.replace(/{{link_afiliado}}/g, `${appBaseUrl}/i/${affiliateToken}`);
  }
  
  // Send via Z-API
  try {
    const zapiUrl = `https://api.z-api.io/instances/${typedSettings.zapi_instance_id}/token/${typedSettings.zapi_token}/send-text`;
    const response = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace("+", ""),
        message: message,
      }),
    });
    
    const result = await response.json();
    console.log("[zapi-webhook] Sent leader verification confirmation:", result);
    
    // Record in whatsapp_messages
    await supabase.from("whatsapp_messages").insert({
      message_id: result.messageId || result.zapiMessageId,
      phone: phone,
      message: message,
      direction: "outgoing",
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    
  } catch (err) {
    console.error("[zapi-webhook] Error sending leader verification confirmation:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendOptOutConfirmation(supabase: any, phone: string, nome: string, settings: IntegrationSettings | null) {
  // Use passed settings or fetch if not available
  let typedSettings = settings;
  if (!typedSettings) {
    const { data: fetchedSettings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_enabled")
      .limit(1)
      .single();
    typedSettings = fetchedSettings as IntegrationSettings;
  }
  
  if (!typedSettings?.zapi_enabled) {
    console.log("[zapi-webhook] Z-API not enabled, skipping opt-out confirmation");
    return;
  }
  
  // Get template or use default message
  const { data: template } = await supabase
    .from("whatsapp_templates")
    .select("mensagem")
    .eq("slug", "descadastro-confirmado")
    .single();
  
  let message = template?.mensagem || `Olá ${nome}! 👋\n\nVocê foi descadastrado(a) com sucesso e não receberá mais nossas comunicações.\n\nSe desejar voltar a receber, basta enviar "VOLTAR" para este número.\n\nObrigado pelo tempo que esteve conosco! 🙏`;
  message = message.replace(/{{nome}}/g, nome);
  
  try {
    const zapiUrl = `https://api.z-api.io/instances/${typedSettings.zapi_instance_id}/token/${typedSettings.zapi_token}/send-text`;
    const response = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace("+", ""),
        message: message,
      }),
    });
    
    const result = await response.json();
    console.log("[zapi-webhook] Sent opt-out confirmation:", result);
    
    // Record in whatsapp_messages
    const { data: contact } = await supabase
      .from("office_contacts")
      .select("id")
      .eq("telefone_norm", phone.startsWith("+") ? phone : "+" + phone)
      .single();
    
    await supabase.from("whatsapp_messages").insert({
      message_id: result.messageId || result.zapiMessageId,
      phone: phone,
      message: message,
      direction: "outgoing",
      status: "sent",
      contact_id: contact?.id,
      sent_at: new Date().toISOString(),
    });
    
  } catch (err) {
    console.error("[zapi-webhook] Error sending opt-out confirmation:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendResubscribeConfirmation(supabase: any, phone: string, nome: string, settings: IntegrationSettings | null) {
  // Use passed settings or fetch if not available
  let typedSettings = settings;
  if (!typedSettings) {
    const { data: fetchedSettings } = await supabase
      .from("integrations_settings")
      .select("zapi_instance_id, zapi_token, zapi_enabled")
      .limit(1)
      .single();
    typedSettings = fetchedSettings as IntegrationSettings;
  }
  
  if (!typedSettings?.zapi_enabled) return;
  
  const message = `Olá ${nome}! 🎉\n\nVocê voltou a receber nossas comunicações!\n\nSe precisar de algo, estamos à disposição.`;
  
  try {
    const zapiUrl = `https://api.z-api.io/instances/${typedSettings.zapi_instance_id}/token/${typedSettings.zapi_token}/send-text`;
    await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace("+", ""),
        message: message,
      }),
    });
    console.log("[zapi-webhook] Sent re-subscribe confirmation");
  } catch (err) {
    console.error("[zapi-webhook] Error sending re-subscribe confirmation:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendWhatsAppMessage(supabase: any, phone: string, message: string, settings: IntegrationSettings | null) {
  if (!settings?.zapi_enabled || !settings?.zapi_instance_id || !settings?.zapi_token) {
    console.log("[zapi-webhook] Z-API not configured, cannot send message");
    return;
  }
  
  try {
    const zapiUrl = `https://api.z-api.io/instances/${settings.zapi_instance_id}/token/${settings.zapi_token}/send-text`;
    const response = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.zapi_client_token ? { "client-token": settings.zapi_client_token } : {}),
      },
      body: JSON.stringify({
        phone: phone.replace("+", ""),
        message: message,
      }),
    });
    
    const result = await response.json();
    console.log(`[zapi-webhook] Sent message to ${phone}:`, result);
    
    // Record in whatsapp_messages
    await supabase.from("whatsapp_messages").insert({
      message_id: result.messageId || result.zapiMessageId,
      phone: phone,
      message: message,
      direction: "outgoing",
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    
    return result;
  } catch (err) {
    console.error("[zapi-webhook] Error sending message:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleConnectionStatus(supabase: any, data: ZapiConnectionStatus) {
  const isConnected = data.connected || data.status === "connected" || data.type === "ConnectedCallback";
  const isDisconnected = data.type === "DisconnectedCallback" || data.status === "disconnected" || data.connected === false;
  
  console.log(`[zapi-webhook] Connection status: ${isConnected ? "connected" : "disconnected"} (type: ${data.type})`);
  
  // Update verification fallback status based on connection
  if (isConnected) {
    // Z-API connected - disable fallback
    const { error } = await supabase
      .from("integrations_settings")
      .update({
        verification_fallback_active: false,
        zapi_last_connected_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all rows
    
    if (error) {
      console.error("[zapi-webhook] Error updating connection status:", error);
    } else {
      console.log("[zapi-webhook] Verification fallback DISABLED - Z-API connected");
    }
  } else if (isDisconnected) {
    // Z-API disconnected - enable fallback to SMS
    const { error } = await supabase
      .from("integrations_settings")
      .update({
        verification_fallback_active: true,
        zapi_disconnected_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all rows
    
    if (error) {
      console.error("[zapi-webhook] Error updating disconnection status:", error);
    } else {
      console.log("[zapi-webhook] Verification fallback ENABLED - Z-API disconnected, switching to SMS");
    }
  }
}

function mapZapiStatus(status: string | undefined): string {
  if (!status) return "unknown";
  
  const statusMap: Record<string, string> = {
    "sent": "sent",
    "delivered": "delivered",
    "received": "delivered",
    "read": "read",
    "viewed": "read",
    "played": "read",
    "read_by_me": "read",
    "failed": "failed",
    "error": "failed",
    "pending": "pending",
  };
  
  return statusMap[status.toLowerCase()] || status.toLowerCase();
}

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  let clean = phone.replace(/\D/g, "");
  
  // Add +55 if not present
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  
  return "+" + clean;
}
