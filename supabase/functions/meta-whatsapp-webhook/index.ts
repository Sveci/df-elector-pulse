import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = "LOVABLE_META_WEBHOOK_2024";

function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  return "+" + clean;
}

// Resolve tenant_id from the phone_number_id in the webhook payload
async function resolveTenantFromPhoneNumberId(supabase: any, phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  
  const { data } = await supabase
    .from('integrations_settings')
    .select('tenant_id')
    .eq('meta_cloud_phone_number_id', phoneNumberId)
    .limit(1)
    .single();
  
  return data?.tenant_id || null;
}

async function sendMetaCloudMessage(supabase: any, phone: string, message: string, tenantId?: string | null) {
  const accessToken = Deno.env.get('META_WA_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.error('[Meta Webhook] META_WA_ACCESS_TOKEN not configured');
    return { success: false, error: 'META_WA_ACCESS_TOKEN not configured' };
  }

  // Get Meta Cloud settings - filtered by tenant
  let settingsQuery = supabase
    .from('integrations_settings')
    .select('meta_cloud_phone_number_id, meta_cloud_api_version');
  if (tenantId) settingsQuery = settingsQuery.eq('tenant_id', tenantId);
  const { data: settings } = await settingsQuery.limit(1).single();

  if (!settings?.meta_cloud_phone_number_id) {
    console.error('[Meta Webhook] meta_cloud_phone_number_id not configured');
    return { success: false, error: 'Phone Number ID not configured' };
  }

  const apiVersion = settings.meta_cloud_api_version || 'v20.0';
  const graphUrl = `https://graph.facebook.com/${apiVersion}/${settings.meta_cloud_phone_number_id}/messages`;

  const formattedPhone = phone.replace(/\D/g, '');

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'text',
    text: { body: message },
  };

  try {
    console.log('[Meta Webhook] Sending message to:', formattedPhone);
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[Meta Webhook] Graph API response:', JSON.stringify(data));

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Graph API error' };
    }

    // Log outbound message
    const insertData: Record<string, any> = {
      phone: formattedPhone,
      message: message,
      direction: 'outgoing',
      status: 'sent',
      provider: 'meta_cloud',
      metadata: { wamid: data.messages?.[0]?.id },
    };
    if (tenantId) insertData.tenant_id = tenantId;

    await supabase.from('whatsapp_messages').insert(insertData);

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('[Meta Webhook] sendMetaCloudMessage error:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ===== WEBHOOK VERIFICATION (GET) =====
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[Meta Webhook] Verification request:', { mode, token, challenge: challenge?.substring(0, 20) + '...' });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Meta Webhook] ✅ Verification successful');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    } else {
      console.error('[Meta Webhook] ❌ Verification failed - token mismatch');
      return new Response('Forbidden', { status: 403 });
    }
  }

  // ===== MESSAGE PROCESSING (POST) =====
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('[Meta Webhook] Received payload:', JSON.stringify(body, null, 2));

      if (body.object !== 'whatsapp_business_account') {
        console.log('[Meta Webhook] Not a WhatsApp event, ignoring');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          
          // Resolve tenant from phone_number_id in the webhook metadata
          const webhookPhoneNumberId = value?.metadata?.phone_number_id;
          const tenantId = await resolveTenantFromPhoneNumberId(supabase, webhookPhoneNumberId);
          console.log(`[Meta Webhook] Resolved tenant: ${tenantId} from phone_number_id: ${webhookPhoneNumberId}`);

          // Process incoming messages
          if (value.messages) {
            for (const message of value.messages) {
              const from = message.from;
              const messageId = message.id;
              const timestamp = message.timestamp;
              const messageType = message.type;
              
              let messageText = '';
              if (messageType === 'text') {
                messageText = message.text?.body || '';
              } else if (messageType === 'button') {
                messageText = message.button?.text || '';
              } else if (messageType === 'interactive') {
                messageText = message.interactive?.button_reply?.title || 
                              message.interactive?.list_reply?.title || '';
              }

              const normalizedPhone = normalizePhone(from);

              console.log('[Meta Webhook] Processing message:', {
                from,
                normalizedPhone,
                messageId,
                messageType,
                messageText: messageText.substring(0, 100),
                tenantId,
              });

              // Log the incoming message
              const incomingInsert: Record<string, any> = {
                phone: from,
                message: messageText,
                direction: 'incoming',
                status: 'received',
                provider: 'meta_cloud',
                metadata: {
                  type: messageType,
                  timestamp,
                  raw: message,
                },
              };
              if (tenantId) incomingInsert.tenant_id = tenantId;

              await supabase.from('whatsapp_messages').insert(incomingInsert);

              // Try to find associated contact by phone
              let contactQuery = supabase
                .from('office_contacts')
                .select('id, nome, is_verified, verification_code, is_active, telefone_norm')
                .eq('telefone_norm', normalizedPhone)
                .limit(1);
              if (tenantId) contactQuery = contactQuery.eq('tenant_id', tenantId);
              
              const { data: contact } = await contactQuery.single();

              // Clean message for keyword matching
              const cleanMessage = messageText
                .replace(/[*_~`]/g, '')
                .trim()
                .toUpperCase();

              // === OPT-OUT COMMANDS ===
              const optOutCommands = ["SAIR", "PARAR", "CANCELAR", "DESCADASTRAR", "STOP", "UNSUBSCRIBE"];
              if (optOutCommands.includes(cleanMessage)) {
                console.log(`[Meta Webhook] Opt-out command detected: ${cleanMessage}`);
                if (contact && contact.is_active !== false) {
                  await supabase
                    .from('office_contacts')
                    .update({
                      is_active: false,
                      opted_out_at: new Date().toISOString(),
                      opt_out_reason: `Solicitação via WhatsApp: ${cleanMessage}`,
                      opt_out_channel: 'whatsapp',
                    })
                    .eq('id', contact.id);
                  
                  await sendMetaCloudMessage(supabase, normalizedPhone, 
                    `Você foi removido(a) da nossa lista. Para voltar a receber mensagens, envie VOLTAR.`,
                    tenantId
                  );
                }
                continue;
              }

              // === RE-SUBSCRIBE COMMAND ===
              if (cleanMessage === "VOLTAR" && contact && contact.is_active === false) {
                await supabase
                  .from('office_contacts')
                  .update({
                    is_active: true,
                    opted_out_at: null,
                    opt_out_reason: null,
                    opt_out_channel: null,
                  })
                  .eq('id', contact.id);
                
                await sendMetaCloudMessage(supabase, normalizedPhone,
                  `Você foi adicionado(a) novamente à nossa lista. Bem-vindo(a) de volta!`,
                  tenantId
                );
                continue;
              }

              // === RETIRAR [CODE] - Material withdrawal confirmation ===
              const retirarMatch = cleanMessage.match(/^RETIRAR\s+([A-Z0-9]{6})$/);
              if (retirarMatch) {
                const code = retirarMatch[1];
                console.log(`[Meta Webhook] Detected RETIRAR command with code: ${code}`);

                const { data: reservation, error: resErr } = await supabase
                  .from('material_reservations')
                  .select('id, status, leader_id, quantidade, material_id, confirmation_code')
                  .eq('confirmation_code', code)
                  .single();

                if (resErr || !reservation) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `❌ Código de retirada *${code}* não encontrado. Verifique se digitou corretamente.`,
                    tenantId
                  );
                  continue;
                }

                const last8 = from.replace(/\D/g, '').slice(-8);
                const { data: leader } = await supabase
                  .from('lideres')
                  .select('id, nome_completo, telefone')
                  .eq('id', reservation.leader_id)
                  .single();

                if (!leader || !leader.telefone || leader.telefone.replace(/\D/g, '').slice(-8) !== last8) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `⚠️ Este código de retirada não pertence a este número de telefone.`,
                    tenantId
                  );
                  continue;
                }

                if (reservation.status === 'withdrawn') {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Esta retirada já foi confirmada anteriormente.`,
                    tenantId
                  );
                  continue;
                }

                if (reservation.status !== 'reserved') {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `⚠️ Esta reserva não está mais ativa (status: ${reservation.status}).`,
                    tenantId
                  );
                  continue;
                }

                const { error: updateErr } = await supabase
                  .from('material_reservations')
                  .update({
                    status: 'withdrawn',
                    confirmed_via: 'whatsapp',
                    confirmed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', reservation.id);

                if (updateErr) {
                  console.error('[Meta Webhook] Error confirming withdrawal:', updateErr);
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `❌ Erro ao confirmar retirada. Tente novamente.`,
                    tenantId
                  );
                } else {
                  const { data: material } = await supabase
                    .from('campaign_materials')
                    .select('nome')
                    .eq('id', reservation.material_id)
                    .single();

                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Retirada confirmada com sucesso!\n\n📦 *${material?.nome || 'Material'}*\n📊 Quantidade: ${reservation.quantidade}\n👤 ${leader.nome_completo}\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                    tenantId
                  );
                  console.log(`[Meta Webhook] ✅ Withdrawal confirmed for reservation ${reservation.id}`);
                }
                continue;
              }

              // === DEVOLVER [CODE] - Material return confirmation ===
              const devolverMatch = cleanMessage.match(/^DEVOLVER\s+([A-Z0-9]{6})$/);
              if (devolverMatch) {
                const code = devolverMatch[1];
                console.log(`[Meta Webhook] Detected DEVOLVER command with code: ${code}`);

                const { data: reservation, error: resErr } = await supabase
                  .from('material_reservations')
                  .select('id, status, leader_id, quantidade, material_id, returned_quantity, return_confirmation_code, return_confirmed_via, return_requested_quantity')
                  .eq('return_confirmation_code', code)
                  .single();

                if (resErr || !reservation) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `❌ Código de devolução *${code}* não encontrado. Verifique se digitou corretamente.`,
                    tenantId
                  );
                  continue;
                }

                const last8ret = from.replace(/\D/g, '').slice(-8);
                const { data: leaderRet } = await supabase
                  .from('lideres')
                  .select('id, nome_completo, telefone')
                  .eq('id', reservation.leader_id)
                  .single();

                if (!leaderRet || !leaderRet.telefone || leaderRet.telefone.replace(/\D/g, '').slice(-8) !== last8ret) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `⚠️ Este código de devolução não pertence a este número de telefone.`,
                    tenantId
                  );
                  continue;
                }

                if (reservation.status !== 'withdrawn') {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `⚠️ Esta reserva não está no status de retirada (status: ${reservation.status}).`,
                    tenantId
                  );
                  continue;
                }

                if (reservation.return_confirmed_via) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Esta devolução já foi confirmada anteriormente.`,
                    tenantId
                  );
                  continue;
                }

                const returnable = reservation.quantidade - (reservation.returned_quantity || 0);
                if (returnable <= 0) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Todo o material já foi devolvido.`,
                    tenantId
                  );
                  continue;
                }

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
                  console.error('[Meta Webhook] Error confirming return:', updateErr);
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `❌ Erro ao confirmar devolução. Tente novamente.`,
                    tenantId
                  );
                } else {
                  const { data: material } = await supabase
                    .from('campaign_materials')
                    .select('nome')
                    .eq('id', reservation.material_id)
                    .single();

                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Devolução confirmada com sucesso!\n\n📦 *${material?.nome || 'Material'}*\n📊 Quantidade devolvida: ${returnQty}\n👤 ${leaderRet.nome_completo}\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                    tenantId
                  );
                  console.log(`[Meta Webhook] ✅ Return confirmed for reservation ${reservation.id}`);
                }
                continue;
              }

              // === CONFIRMAR [TOKEN] FLOW ===
              const confirmMatch = cleanMessage.match(/^CONFIRMAR\s+([A-Z0-9]{5,6})$/);
              if (confirmMatch) {
                const token = confirmMatch[1];
                console.log(`[Meta Webhook] Detected CONFIRMAR command with token: ${token}`);

                const { data: verifyResult, error: verifyError } = await supabase.rpc("process_verification_keyword", {
                  _token: token,
                  _phone: normalizedPhone,
                });

                const verificationData = Array.isArray(verifyResult)
                  ? verifyResult[0]
                  : verifyResult;

                console.log(`[Meta Webhook] process_verification_keyword result:`, verificationData, verifyError);

                if (verificationData?.success) {
                  const consentMessage = `Olá ${verificationData.contact_name}! 👋\n\nPara confirmar seu cadastro como apoiador(a), responda *SIM* para esta mensagem.`;
                  console.log(`[Meta Webhook] Sending consent question to ${normalizedPhone}`);

                  try {
                    await sendMetaCloudMessage(supabase, normalizedPhone, consentMessage, tenantId);
                    
                    await supabase
                      .from('contact_verifications')
                      .update({ consent_question_sent_at: new Date().toISOString() })
                      .eq('token', token);
                  } catch (sendError) {
                    console.error(`[Meta Webhook] Failed to send consent message:`, sendError);
                  }
                } else {
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
                  await sendMetaCloudMessage(supabase, normalizedPhone, errorMessage, tenantId);
                }
                continue;
              }

              // === SIM (CONSENT CONFIRMATION) ===
              if (cleanMessage === "SIM") {
                console.log(`[Meta Webhook] Detected SIM consent response from ${normalizedPhone}`);

                const { data: consentResult, error: consentError } = await supabase.rpc("process_verification_consent", {
                  _phone: normalizedPhone,
                });

                const consentData = Array.isArray(consentResult)
                  ? consentResult[0]
                  : consentResult;

                console.log(`[Meta Webhook] process_verification_consent result:`, consentData, consentError);

                if (consentData?.success) {
                  const confirmMessage = `✅ Cadastro confirmado com sucesso!\n\nVocê receberá seu link de indicação em instantes.`;
                  await sendMetaCloudMessage(supabase, normalizedPhone, confirmMessage, tenantId);

                  try {
                    console.log(`[Meta Webhook] Calling send-leader-affiliate-links for ${consentData.contact_type} ${consentData.contact_id}`);

                    const response = await fetch(
                      `${supabaseUrl}/functions/v1/send-leader-affiliate-links`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${supabaseKey}`,
                        },
                        body: JSON.stringify({
                          leader_id: consentData.contact_id,
                        }),
                      }
                    );

                    const result = await response.json();
                    console.log(`[Meta Webhook] send-leader-affiliate-links result:`, result);
                  } catch (affiliateError) {
                    console.error(`[Meta Webhook] Error sending affiliate links:`, affiliateError);
                  }
                  continue;
                }
                // If no pending consent found, fall through to chatbot
              }

              // === LEGACY CODE DETECTION (5-6 char codes) ===
              const codeMatch = cleanMessage.match(/^[A-Z0-9]{5,6}$/);
              if (codeMatch && cleanMessage !== "SIM") {
                const code = codeMatch[0];
                console.log(`[Meta Webhook] Detected potential code: ${code}. Guiding to CONFIRMAR flow.`);

                let contactVerifyQuery = supabase
                  .from('office_contacts')
                  .select('id')
                  .eq('verification_code', code)
                  .limit(1);
                if (tenantId) contactVerifyQuery = contactVerifyQuery.eq('tenant_id', tenantId);

                const { data: contactToVerify } = await contactVerifyQuery.single();

                const { data: leaderToVerify } = !contactToVerify ? await supabase
                  .from('lideres')
                  .select('id, is_verified')
                  .eq('verification_code', code)
                  .limit(1)
                  .single() : { data: null };

                if (contactToVerify || leaderToVerify) {
                  if (leaderToVerify?.is_verified) {
                    await sendMetaCloudMessage(supabase, normalizedPhone,
                      `Seu cadastro já foi verificado! Se você precisa do seu link de indicação, entre em contato com nossa equipe.`,
                      tenantId
                    );
                  } else {
                    await sendMetaCloudMessage(supabase, normalizedPhone,
                      `Para confirmar seu cadastro, use o formato: CONFIRMAR [código]\n\nExemplo: CONFIRMAR ${code}`,
                      tenantId
                    );
                  }
                  continue;
                }
              }

              // === CHECK VERIFICATION SETTINGS (simple keyword flow) ===
              let verSettingsQuery = supabase
                .from('integrations_settings')
                .select('verification_wa_keyword, verification_wa_enabled');
              if (tenantId) verSettingsQuery = verSettingsQuery.eq('tenant_id', tenantId);
              const { data: settings } = await verSettingsQuery.limit(1).single();

              let handledAsVerification = false;

              if (settings?.verification_wa_enabled) {
                const keyword = settings.verification_wa_keyword?.toUpperCase() || 'CONFIRMAR';
                
                if (cleanMessage === keyword || cleanMessage.startsWith(keyword + ' ')) {
                  if (cleanMessage === keyword) {
                    console.log('[Meta Webhook] Bare keyword detected without token from:', from);
                    handledAsVerification = true;
                    
                    let verQuery = supabase
                      .from('contact_verifications')
                      .select('*')
                      .eq('phone', normalizedPhone)
                      .eq('status', 'pending')
                      .order('created_at', { ascending: false })
                      .limit(1);
                    if (tenantId) verQuery = verQuery.eq('tenant_id', tenantId);

                    const { data: verification } = await verQuery.single();

                    if (verification) {
                      await supabase
                        .from('contact_verifications')
                        .update({
                          status: 'verified',
                          verified_at: new Date().toISOString(),
                          keyword_received_at: new Date().toISOString(),
                          consent_channel: 'whatsapp',
                          consent_received_at: new Date().toISOString(),
                        })
                        .eq('id', verification.id);

                      if (verification.contact_type === 'contact') {
                        await supabase
                          .from('office_contacts')
                          .update({
                            is_verified: true,
                            verified_at: new Date().toISOString(),
                          })
                          .eq('id', verification.contact_id);
                      } else if (verification.contact_type === 'leader') {
                        await supabase
                          .from('lideres')
                          .update({
                            is_verified: true,
                            verified_at: new Date().toISOString(),
                          })
                          .eq('id', verification.contact_id);
                      }

                      console.log('[Meta Webhook] ✅ Verification completed for:', from);
                    }
                  }
                }
              }

              // === CHATBOT FALLBACK ===
              if (!handledAsVerification && messageText.trim()) {
                console.log('[Meta Webhook] Forwarding to chatbot for:', from);
                try {
                  const chatbotResponse = await fetch(
                    `${supabaseUrl}/functions/v1/whatsapp-chatbot`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseKey}`,
                      },
                      body: JSON.stringify({
                        phone: from,
                        message: messageText,
                        messageId: messageId,
                        provider: 'meta_cloud',
                        tenantId: tenantId, // Pass tenant to chatbot
                      }),
                    }
                  );
                  const chatbotResult = await chatbotResponse.json();
                  console.log('[Meta Webhook] Chatbot response:', chatbotResult);
                } catch (chatbotError) {
                  console.error('[Meta Webhook] Chatbot error:', chatbotError);
                }
              }
            }
          }

          // Process status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              const messageId = status.id;
              const statusValue = status.status;
              const recipientId = status.recipient_id;

              console.log('[Meta Webhook] Status update:', { messageId, status: statusValue, recipientId });

              const { data: msgs } = await supabase
                .from('whatsapp_messages')
                .select('id, metadata')
                .eq('direction', 'outgoing')
                .eq('phone', recipientId)
                .order('created_at', { ascending: false })
                .limit(20);

              if (msgs) {
                for (const msg of msgs) {
                  const meta = msg.metadata as any;
                  if (meta?.wamid === messageId || meta?.messageId === messageId) {
                    await supabase
                      .from('whatsapp_messages')
                      .update({
                        status: statusValue,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', msg.id);
                    console.log(`[Meta Webhook] Updated status for message ${msg.id} to ${statusValue}`);
                    break;
                  }
                }
              }
            }
          }
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error('[Meta Webhook] Error processing webhook:', error);
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
});
