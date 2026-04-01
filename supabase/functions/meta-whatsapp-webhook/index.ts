import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "LOVABLE_META_WEBHOOK_2024";

function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (!clean.startsWith("55") && clean.length <= 11) {
    clean = "55" + clean;
  }
  return "+" + clean;
}

// Resolve tenant_id from the phone_number_id in the webhook payload (checks both numbers)
async function resolveTenantFromPhoneNumberId(supabase: any, phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;

  // Try primary number first
  const { data } = await supabase
    .from('integrations_settings')
    .select('tenant_id')
    .eq('meta_cloud_phone_number_id', phoneNumberId)
    .limit(1)
    .single();

  if (data?.tenant_id) return data.tenant_id;

  // Try second number
  const { data: data2 } = await supabase
    .from('integrations_settings')
    .select('tenant_id')
    .eq('meta_cloud_phone_number_id_2', phoneNumberId)
    .eq('meta_cloud_enabled_2', true)
    .limit(1)
    .single();

  return data2?.tenant_id || null;
}

async function sendMetaCloudMessage(supabase: any, phone: string, message: string, tenantId?: string | null, phoneNumberIdOverride?: string | null) {
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

  // Use override (the number that received the message) or fall back to primary
  const effectivePhoneNumberId = phoneNumberIdOverride || settings?.meta_cloud_phone_number_id;

  if (!effectivePhoneNumberId) {
    console.error('[Meta Webhook] No phone_number_id available for sending');
    return { success: false, error: 'Phone Number ID not configured' };
  }

  const apiVersion = settings?.meta_cloud_api_version || 'v20.0';
  const graphUrl = `https://graph.facebook.com/${apiVersion}/${effectivePhoneNumberId}/messages`;

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
// =====================================================
// KNOWLEDGE BASE QUERY (for menu options)
// =====================================================
async function queryKnowledgeBase(supabase: any, query: string, tenantId: string | null): Promise<string | null> {
  if (!tenantId) return null;

  try {
    // Search KB chunks using text similarity
    const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const orConditions = searchTerms.map(t => `content.ilike.%${t}%`).join(',');

    const { data: chunks } = await supabase
      .from('kb_chunks')
      .select('content, document_id')
      .eq('tenant_id', tenantId)
      .or(orConditions)
      .limit(3);

    if (!chunks || chunks.length === 0) return null;

    // Get document names for sources
    const docIds = [...new Set(chunks.map((c: any) => c.document_id))];
    const { data: docs } = await supabase
      .from('kb_documents')
      .select('id, title')
      .in('id', docIds);

    const docMap = new Map((docs || []).map((d: any) => [d.id, d.title]));

    // Build a concise summary (limit to ~800 chars for WhatsApp)
    let combined = chunks.map((c: any) => c.content).join('\n\n');
    if (combined.length > 800) {
      combined = combined.substring(0, 797) + '...';
    }

    const sources = [...new Set(chunks.map((c: any) => docMap.get(c.document_id)).filter(Boolean))];
    if (sources.length > 0) {
      combined += `\n\n📄 Fonte: ${sources.join(', ')}`;
    }

    return combined;
  } catch (err) {
    console.error('[Meta Webhook] KB query error:', err);
    return null;
  }
}

// =====================================================
// CONVERSATIONAL FLOW: Welcome → Municipality → Community
// =====================================================
async function handleConversationalFlow(
  supabase: any,
  from: string,
  normalizedPhone: string,
  messageText: string,
  tenantId: string | null,
  replyPhoneNumberId?: string | null
): Promise<boolean> {
  if (!tenantId) return false;

  // Get or create chat state for this phone
  const { data: chatState } = await supabase
    .from('whatsapp_chat_state')
    .select('*')
    .eq('phone', from)
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  // Get communities for this tenant
  const { data: communities } = await supabase
    .from('whatsapp_communities')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('numero_lista');

  if (!communities || communities.length === 0) {
    console.log('[Meta Webhook] No communities configured, skipping conversational flow');
    return false;
  }

  const cleanMessage = messageText.trim();
  const upperMessage = cleanMessage.toUpperCase();

  // === CHECK IF MESSAGE IS A KEYWORD — keywords always take priority over conversational flow ===
  const { data: activeKeywords } = await supabase
    .from('whatsapp_chatbot_keywords')
    .select('keyword, aliases')
    .eq('is_active', true)
    .eq('tenant_id', tenantId);

  if (activeKeywords && activeKeywords.length > 0) {
    const normalizedUpper = upperMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    for (const kw of activeKeywords) {
      const kwNorm = (kw.keyword || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (kwNorm && normalizedUpper === kwNorm) {
        console.log(`[Meta Webhook] Keyword "${kw.keyword}" detected, skipping conversational flow`);
        // If new contact, create chat state as registered so next time flow doesn't trigger welcome again
        if (!chatState) {
          await supabase.from('whatsapp_chat_state').insert({
            phone: from,
            tenant_id: tenantId,
            state: 'registered',
          });
        } else if (chatState.state === 'awaiting_municipality') {
          await supabase.from('whatsapp_chat_state').update({ state: 'registered', updated_at: new Date().toISOString() }).eq('id', chatState.id);
        }
        return false;
      }
      // Check aliases too
      const aliases = (kw.aliases || []) as string[];
      for (const alias of aliases) {
        const aliasNorm = alias.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        if (aliasNorm && normalizedUpper === aliasNorm) {
          console.log(`[Meta Webhook] Keyword alias "${alias}" detected, skipping conversational flow`);
          if (!chatState) {
            await supabase.from('whatsapp_chat_state').insert({
              phone: from,
              tenant_id: tenantId,
              state: 'registered',
            });
          } else if (chatState.state === 'awaiting_municipality') {
            await supabase.from('whatsapp_chat_state').update({ state: 'registered', updated_at: new Date().toISOString() }).eq('id', chatState.id);
          }
          return false;
        }
      }
    }
  }

  // === STATE: NEW CONTACT (no chat state yet) ===
  if (!chatState) {
    // Check if this is an existing leader — if so, skip flow and let chatbot handle
    const { data: existingLeader } = await supabase
      .from('lideres')
      .select('id')
      .or(`telefone.eq.${normalizedPhone},telefone.eq.${from}`)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (existingLeader) {
      console.log('[Meta Webhook] Existing leader, skipping conversational flow');
      return false;
    }

    // Create new chat state
    await supabase.from('whatsapp_chat_state').insert({
      phone: from,
      tenant_id: tenantId,
      state: 'awaiting_municipality',
    });

    // Fetch organization name dynamically (no hardcoded names)
    let orgNome = 'nosso gabinete';
    let orgCargo = 'Deputado(a)';
    let orgEstado = '';
    try {
      const { data: org } = await supabase
        .from('organization')
        .select('nome, cargo, estado')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();
      if (org?.nome) orgNome = org.nome;
      if (org?.cargo) orgCargo = org.cargo;
      if (org?.estado) orgEstado = org.estado;
    } catch { /* use defaults */ }

    const orgTitle = `${orgCargo} ${orgNome}`.trim();

    // Send welcome + municipality list
    let welcomeMsg = `Olá, seja bem-vindo(a) ao WhatsApp oficial ${orgTitle.length > 5 ? `d${orgCargo.startsWith('A') ? 'a' : 'o'} ${orgTitle}` : 'ao nosso gabinete'}! 🏛️\n\n`;
    welcomeMsg += `Aqui você recebe informações diretas sobre projetos, programas e oportunidades${orgEstado ? ` para o ${orgEstado}` : ''}.\n\n`;
    welcomeMsg += `📍 *De qual município você é?*\n`;
    welcomeMsg += `Digite o número correspondente:\n\n`;

    for (const c of communities) {
      welcomeMsg += `*${c.numero_lista}* - ${c.municipio}\n`;
    }

    await sendMetaCloudMessage(supabase, normalizedPhone, welcomeMsg, tenantId, replyPhoneNumberId);
    console.log('[Meta Webhook] Sent welcome message with municipality list');
    return true;
  }

  // === STATE: AWAITING MUNICIPALITY ===
  if (chatState.state === 'awaiting_municipality') {
    // Try to match by number
    const selectedNumber = parseInt(cleanMessage);
    let matchedCommunity = null;

    if (!isNaN(selectedNumber)) {
      matchedCommunity = communities.find((c: any) => c.numero_lista === selectedNumber);
    }

    if (!matchedCommunity) {
      // Try fuzzy name match
      const normalizedInput = upperMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      matchedCommunity = communities.find((c: any) => {
        const normalizedName = c.municipio.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normalizedName === normalizedInput || normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName);
      });
    }

    if (!matchedCommunity) {
      // Not recognized — resend the list
      let retryMsg = `Não reconheci o município. Por favor, digite apenas o *número* correspondente:\n\n`;
      for (const c of communities) {
        retryMsg += `*${c.numero_lista}* - ${c.municipio}\n`;
      }
      await sendMetaCloudMessage(supabase, normalizedPhone, retryMsg, tenantId, replyPhoneNumberId);
      return true;
    }

    // Municipality matched! Update state
    await supabase
      .from('whatsapp_chat_state')
      .update({
        state: 'registered',
        municipio: matchedCommunity.municipio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatState.id);

    // Send community link or confirmation
    if (matchedCommunity.community_link) {
      let successMsg = `✅ Ótimo! Você é de *${matchedCommunity.municipio}*!\n\n`;
      successMsg += `🔗 Entre na nossa Comunidade WhatsApp do seu município:\n${matchedCommunity.community_link}\n\n`;
      successMsg += `Lá você vai receber informações específicas da sua região! 📢`;
      await sendMetaCloudMessage(supabase, normalizedPhone, successMsg, tenantId, replyPhoneNumberId);
    } else {
      let successMsg = `✅ Ótimo! Você é de *${matchedCommunity.municipio}*!\n\n`;
      successMsg += `A Comunidade WhatsApp do seu município está sendo preparada. Assim que estiver pronta, enviaremos o link para você! 📢`;
      await sendMetaCloudMessage(supabase, normalizedPhone, successMsg, tenantId, replyPhoneNumberId);
    }

    console.log(`[Meta Webhook] User ${from} registered for municipality: ${matchedCommunity.municipio}`);
    return true;
  }

  // === STATE: REGISTERED (already selected a municipality) ===
  if (chatState.state === 'registered') {
    // Check if user wants to see menu or specific options
    if (upperMessage === 'MENU' || upperMessage === 'OPCOES' || upperMessage === 'OPÇÕES') {
      await sendMenuMessage(supabase, normalizedPhone, chatState.municipio, tenantId, replyPhoneNumberId);
      return true;
    }

    if (upperMessage === 'PROJETOS' || upperMessage === '1') {
      // Query KB for projects/programs info
      try {
        const kbResponse = await queryKnowledgeBase(supabase, "projetos programas do deputado", tenantId);
        if (kbResponse) {
          const msg = `📋 *Projetos e Programas*\n\n${kbResponse}\n\nDigite *MENU* para ver outras opções ou faça uma pergunta específica.`;
          await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
        } else {
          const msg = `📋 *Projetos e Programas*\n\nNo momento não encontrei informações detalhadas na base. Faça uma pergunta específica sobre um projeto e tentarei ajudar!\n\nDigite *MENU* para ver outras opções.`;
          await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
        }
      } catch (err) {
        console.error('[Meta Webhook] Error querying KB for projects:', err);
        const msg = `📋 *Projetos e Programas*\n\nOcorreu um erro ao buscar as informações. Tente novamente ou faça uma pergunta específica.\n\nDigite *MENU* para ver outras opções.`;
        await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
      }
      return true;
    }

    if (upperMessage === 'EVENTOS' || upperMessage === '2') {
      // List upcoming events from the events table
      try {
        const today = new Date().toISOString().split('T')[0];
        let eventsQuery = supabase
          .from('events')
          .select('name, date, time, location, slug')
          .gte('date', today)
          .eq('status', 'published')
          .order('date', { ascending: true })
          .limit(5);
        if (tenantId) eventsQuery = eventsQuery.eq('tenant_id', tenantId);

        const { data: events } = await eventsQuery;

        if (events && events.length > 0) {
          let msg = `📅 *Próximos Eventos*\n\n`;
          for (const event of events) {
            const dateFormatted = new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            msg += `🔹 *${event.name}*\n`;
            msg += `   📆 ${dateFormatted} às ${event.time || 'A definir'}\n`;
            msg += `   📍 ${event.location || 'Local a confirmar'}\n\n`;
          }
          msg += `Digite *MENU* para ver outras opções.`;
          await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
        } else {
          const msg = `📅 *Eventos*\n\nNo momento não há eventos programados. Fique atento às nossas comunicações!\n\nDigite *MENU* para ver outras opções.`;
          await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
        }
      } catch (err) {
        console.error('[Meta Webhook] Error fetching events:', err);
        const msg = `📅 *Eventos*\n\nOcorreu um erro ao buscar os eventos. Tente novamente mais tarde.\n\nDigite *MENU* para ver outras opções.`;
        await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
      }
      return true;
    }

    if (upperMessage === 'COMUNIDADE' || upperMessage === '3') {
      const { data: community } = await supabase
        .from('whatsapp_communities')
        .select('community_link, municipio')
        .eq('tenant_id', tenantId)
        .eq('municipio', chatState.municipio)
        .limit(1)
        .single();

      if (community?.community_link) {
        const msg = `🔗 *Comunidade ${community.municipio}*\n\n${community.community_link}\n\nDigite *MENU* para ver outras opções.`;
        await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
      } else {
        const msg = `A Comunidade do seu município ainda está sendo preparada. Em breve enviaremos o link!\n\nDigite *MENU* para ver outras opções.`;
        await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
      }
      return true;
    }

    if (upperMessage === 'FALAR' || upperMessage === '4') {
      try {
        await supabase.from('whatsapp_messages').insert({
          phone: from,
          message: '[SOLICITAÇÃO DE ATENDIMENTO] Usuário solicitou falar com atendente',
          direction: 'system',
          status: 'pending_human',
          provider: 'meta_cloud',
          tenant_id: tenantId,
          metadata: { type: 'human_request', municipio: chatState.municipio },
        });
      } catch (e) {
        console.error('[Meta Webhook] Error logging human request:', e);
      }
      const msg = `📞 *Falar com um atendente*\n\n` +
        `Sua solicitação foi registrada! Um membro da nossa equipe entrará em contato em breve.\n\n` +
        `Enquanto isso, você pode fazer perguntas diretamente aqui que tentarei ajudar.\n\n` +
        `Digite *MENU* para ver outras opções.`;
      await sendMetaCloudMessage(supabase, normalizedPhone, msg, tenantId, replyPhoneNumberId);
      return true;
    }

    // For short messages, check if it matches a chatbot keyword before showing menu
    // This allows dynamic functions like "EVENTO" to work properly
    if (cleanMessage.length <= 15 && !cleanMessage.includes(' ')) {
      // Check if this matches any chatbot keyword
      const normalizedCheck = upperMessage.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let kwQuery = supabase
        .from("whatsapp_chatbot_keywords")
        .select("id, keyword, aliases")
        .eq("is_active", true);
      if (tenantId) kwQuery = kwQuery.eq("tenant_id", tenantId);
      const { data: keywords } = await kwQuery;

      const matchesKeyword = keywords?.some((kw: any) => {
        const kwNorm = kw.keyword?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
        if (kwNorm === normalizedCheck) return true;
        const aliases = (kw.aliases || []).map((a: string) =>
          a.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        );
        return aliases.includes(normalizedCheck);
      });

      if (matchesKeyword) {
        // Fall through to chatbot to handle the keyword (AUTOMATION MODE)
        console.log(`[Meta Webhook] [AUTOMAÇÃO] Message "${upperMessage}" matches chatbot keyword, forwarding to chatbot`);
        return false;
      }

      // Check if it's a known menu option (1-4, MENU, etc.) — show menu
      const menuCommands = ["MENU", "OPCOES", "OPÇÕES", "OI", "OLA", "BOM DIA", "BOA TARDE", "BOA NOITE"];
      if (menuCommands.includes(upperMessage) || /^[1-4]$/.test(upperMessage.trim())) {
        // Let menu options be handled above (they already are for 1-4)
        // For other short non-keyword messages, forward to AI chatbot
        await sendMenuMessage(supabase, normalizedPhone, chatState.municipio, tenantId, replyPhoneNumberId);
        return true;
      }

      // Short message that is NOT a keyword and NOT a menu command → forward to AI chatbot
      console.log(`[Meta Webhook] [IA] Short message "${upperMessage}" not a keyword/menu, forwarding to AI chatbot`);
      return false;
    }

    // Fall through to AI chatbot for natural language questions
    console.log(`[Meta Webhook] [IA] Open question detected, forwarding to AI chatbot`);
    return false;
  }

  return false;
}

async function sendMenuMessage(supabase: any, phone: string, municipio: string | null, tenantId: string | null, replyPhoneNumberId?: string | null) {
  let menuMsg = `🏛️ *Menu Principal*\n\n`;
  menuMsg += `Escolha uma opção:\n\n`;
  menuMsg += `*1* - 📋 Projetos e Programas\n`;
  menuMsg += `*2* - 📅 Eventos\n`;
  menuMsg += `*3* - 🔗 Comunidade${municipio ? ` (${municipio})` : ''}\n`;
  menuMsg += `*4* - 📞 Falar com atendente\n`;
  menuMsg += `\nDigite o número da opção desejada.`;
  await sendMetaCloudMessage(supabase, phone, menuMsg, tenantId, replyPhoneNumberId);
}

// ===== EVAdesk PAYLOAD HANDLER =====
async function handleEvadeskPayload(body: any): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Extract fields from EVAdesk format
    const channelKey = body.channel?.key; // e.g. "5596920007557"
    const contactPhone = body.contact?.phonenumber; // e.g. "+55|96999014846"
    const contactName = body.contact?.name || '';
    const messageText = (body.lastMessage?.text || body.lastContactMessage || '').trim();
    const sessionId = body.sessionId;

    if (!messageText) {
      console.log('[Meta Webhook] [EVAdesk] Empty message, ignoring');
      return new Response(JSON.stringify({ response: '', messages: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize phone: "+55|96999014846" → "+5596999014846"
    const rawPhone = (contactPhone || '').replace(/\|/g, '').replace(/[^0-9+]/g, '');
    const normalizedPhone = normalizePhone(rawPhone);
    const from = normalizedPhone.replace('+', '');

    console.log(`[Meta Webhook] [EVAdesk] Message from ${normalizedPhone}: "${messageText.substring(0, 100)}" via channel ${channelKey}`);

    // Resolve tenant from channel key (the EVAdesk channel phone number)
    const normalizedChannel = normalizePhone(channelKey || '');
    // Look up tenant by matching channel phone to meta_cloud_phone or meta_cloud_phone_2
    const { data: tenantRow } = await supabase
      .from('integrations_settings')
      .select('tenant_id, meta_cloud_phone_number_id_2')
      .or(`meta_cloud_phone.eq.${normalizedChannel},meta_cloud_phone_2.eq.${normalizedChannel},meta_cloud_phone.eq.${channelKey},meta_cloud_phone_2.eq.${channelKey}`)
      .limit(1)
      .maybeSingle();

    let tenantId = tenantRow?.tenant_id || null;

    // Fallback: try to find any tenant with this channel phone in the phone fields
    if (!tenantId) {
      const { data: fallbackTenant } = await supabase
        .from('integrations_settings')
        .select('tenant_id')
        .limit(1)
        .single();
      tenantId = fallbackTenant?.tenant_id || null;
    }

    console.log(`[Meta Webhook] [EVAdesk] Resolved tenant: ${tenantId}`);

    if (!tenantId) {
      console.log('[Meta Webhook] [EVAdesk] No tenant found, ignoring');
return new Response(JSON.stringify({ response: '' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the incoming message
    await supabase.from('whatsapp_messages').insert({
      phone: from,
      message: messageText,
      direction: 'incoming',
      status: 'received',
      provider: 'evadesk',
      tenant_id: tenantId,
      metadata: {
        evadesk_session_id: sessionId,
        evadesk_channel_key: channelKey,
        contact_name: contactName,
      },
    });

    // === Forward to chatbot engine (same as primary number) ===
    console.log(`[Meta Webhook] [EVAdesk] Forwarding to chatbot for ${normalizedPhone}`);
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
            provider: 'evadesk',
            tenantId: tenantId,
          }),
        }
      );
      const chatbotResult = await chatbotResponse.json();
      console.log('[Meta Webhook] [EVAdesk] Chatbot result:', JSON.stringify(chatbotResult));

      const responseText = chatbotResult.response || '';
      if (responseText) {
        console.log(`[Meta Webhook] [EVAdesk] Returning response: "${responseText.substring(0, 100)}"`);
        // Log outbound message
        await supabase.from('whatsapp_messages').insert({
          phone: from,
          message: responseText,
          direction: 'outgoing',
          status: 'sent',
          provider: 'evadesk',
          tenant_id: tenantId,
          metadata: {
            evadesk_session_id: sessionId,
            evadesk_channel_key: channelKey,
          },
        });
        return new Response(JSON.stringify({ response: responseText }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // No response from chatbot (silent)
      console.log('[Meta Webhook] [EVAdesk] No response from chatbot, staying silent');
return new Response(JSON.stringify({ response: '' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (chatbotError) {
      console.error('[Meta Webhook] [EVAdesk] Chatbot error:', chatbotError);
return new Response(JSON.stringify({ response: '' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[Meta Webhook] [EVAdesk] Error:', error);
return new Response(JSON.stringify({ response: '' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

      // ===== EVAdesk PAYLOAD DETECTION =====
      if (body.companyId && body.channel && (body.lastContactMessage !== undefined || body.lastMessage)) {
        console.log('[Meta Webhook] EVAdesk payload detected');
        return await handleEvadeskPayload(body);
      }

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

          // Determine if this is a secondary number (disable conversational flow + hardcoded responses)
          let isSecondaryNumber = false;
          if (tenantId && webhookPhoneNumberId) {
            const { data: intSet } = await supabase
              .from('integrations_settings')
              .select('meta_cloud_phone_number_id')
              .eq('tenant_id', tenantId)
              .limit(1)
              .single();
            if (intSet && intSet.meta_cloud_phone_number_id !== webhookPhoneNumberId) {
              isSecondaryNumber = true;
              console.log(`[Meta Webhook] Secondary number detected: ${webhookPhoneNumberId} (primary: ${intSet.meta_cloud_phone_number_id})`);
            }
          }

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

              // ── INPUT SANITIZATION ──────────────────────────────
              messageText = messageText
                .replace(/\0/g, '')
                .replace(/[\u200B-\u200F\uFEFF]/g, '')
                .substring(0, 4096)
                .trim();

              if (!messageText && messageType !== 'image' && messageType !== 'audio' && messageType !== 'video' && messageType !== 'document') {
                console.log(`[Meta Webhook] Empty message text for type ${messageType}, skipping`);
                continue;
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

              // === EXIT FLOW COMMANDS (SAIR/CANCELAR) ===
              const exitFlowCommands = ["SAIR", "CANCELAR", "CANCEL", "EXIT"];
              if (exitFlowCommands.includes(cleanMessage)) {
                console.log(`[Meta Webhook] Exit flow command detected: ${cleanMessage}`);
                
                // Check if user has an active chatbot session/flow
                let sessionQuery = supabase
                  .from('whatsapp_chatbot_sessions')
                  .select('id, registration_state, event_reg_state')
                  .eq('phone', normalizedPhone);
                if (tenantId) sessionQuery = sessionQuery.eq('tenant_id', tenantId);
                const { data: activeSession } = await sessionQuery.single();
                
                const hasActiveFlow = activeSession && (activeSession.registration_state || activeSession.event_reg_state);
                
                if (hasActiveFlow) {
                  // Clear session flow states
                  await supabase
                    .from('whatsapp_chatbot_sessions')
                    .update({
                      registration_state: null,
                      event_reg_state: null,
                    })
                    .eq('id', activeSession.id);
                  
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Você saiu do fluxo atual.\n\nSe precisar de algo, é só digitar:\n📋 *AJUDA* - Ver comandos disponíveis\n🎫 *EVENTO* - Inscrição em eventos\n\nOu envie qualquer pergunta que responderei com prazer! 😊`,
                    tenantId, webhookPhoneNumberId
                  );
                  console.log(`[Meta Webhook] Active flow cleared for ${normalizedPhone}`);
                } else {
                  // No active flow - just acknowledge
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `Não há nenhum fluxo ativo no momento.\n\nDigite *AJUDA* para ver os comandos disponíveis. 😊`,
                    tenantId, webhookPhoneNumberId
                  );
                  console.log(`[Meta Webhook] No active flow for ${normalizedPhone}, sent info message`);
                }
                continue;
              }

              // === OPT-OUT COMMANDS (unsubscribe from list) ===
              const optOutCommands = ["PARAR", "DESCADASTRAR", "STOP", "UNSUBSCRIBE"];
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
                    tenantId, webhookPhoneNumberId
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
                  tenantId, webhookPhoneNumberId
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
                    tenantId, webhookPhoneNumberId
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
                    tenantId, webhookPhoneNumberId
                  );
                  continue;
                }

                if (reservation.status === 'withdrawn') {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Esta retirada já foi confirmada anteriormente.`,
                    tenantId, webhookPhoneNumberId
                  );
                  continue;
                }

                if (reservation.status !== 'reserved') {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `⚠️ Esta reserva não está mais ativa (status: ${reservation.status}).`,
                    tenantId, webhookPhoneNumberId
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
                    tenantId, webhookPhoneNumberId
                  );
                } else {
                  const { data: material } = await supabase
                    .from('campaign_materials')
                    .select('nome')
                    .eq('id', reservation.material_id)
                    .single();

                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Retirada confirmada com sucesso!\n\n📦 *${material?.nome || 'Material'}*\n📊 Quantidade: ${reservation.quantidade}\n👤 ${leader.nome_completo}\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                    tenantId, webhookPhoneNumberId
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
                    tenantId, webhookPhoneNumberId
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
                    tenantId, webhookPhoneNumberId
                  );
                  continue;
                }

                if (reservation.status !== 'withdrawn') {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `⚠️ Esta reserva não está no status de retirada (status: ${reservation.status}).`,
                    tenantId, webhookPhoneNumberId
                  );
                  continue;
                }

                if (reservation.return_confirmed_via) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Esta devolução já foi confirmada anteriormente.`,
                    tenantId, webhookPhoneNumberId
                  );
                  continue;
                }

                const returnable = reservation.quantidade - (reservation.returned_quantity || 0);
                if (returnable <= 0) {
                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Todo o material já foi devolvido.`,
                    tenantId, webhookPhoneNumberId
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
                    tenantId, webhookPhoneNumberId
                  );
                } else {
                  const { data: material } = await supabase
                    .from('campaign_materials')
                    .select('nome')
                    .eq('id', reservation.material_id)
                    .single();

                  await sendMetaCloudMessage(supabase, normalizedPhone,
                    `✅ Devolução confirmada com sucesso!\n\n📦 *${material?.nome || 'Material'}*\n📊 Quantidade devolvida: ${returnQty}\n👤 ${leaderRet.nome_completo}\n🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                    tenantId, webhookPhoneNumberId
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
                    await sendMetaCloudMessage(supabase, normalizedPhone, consentMessage, tenantId, webhookPhoneNumberId);

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
                  await sendMetaCloudMessage(supabase, normalizedPhone, errorMessage, tenantId, webhookPhoneNumberId);
                }
                continue;
              }

              // === CHECK ACTIVE REGISTRATION OR EVENT REGISTRATION FLOW ===
              let inRegistrationFlow = false;
              if (tenantId) {
                const phoneWithPlus = from.startsWith('+') ? from : `+${from}`;
                const phoneWithoutPlus = from.startsWith('+') ? from.substring(1) : from;
                const { data: regSession } = await supabase
                  .from('whatsapp_chatbot_sessions')
                  .select('registration_state, event_reg_state')
                  .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
                  .eq('tenant_id', tenantId)
                  .limit(1)
                  .maybeSingle();

                if (regSession?.registration_state) {
                  inRegistrationFlow = true;
                  console.log(`[Meta Webhook] User ${from} is in registration flow (state: ${regSession.registration_state}), forwarding to chatbot`);
                }
                if (regSession?.event_reg_state) {
                  inRegistrationFlow = true;
                  console.log(`[Meta Webhook] User ${from} is in event registration flow (state: ${regSession.event_reg_state}), forwarding to chatbot`);
                }
              }

              if (inRegistrationFlow) {
                // Forward directly to chatbot for registration flow
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
                        tenantId: tenantId,
                        phoneNumberId: webhookPhoneNumberId,
                      }),
                    }
                  );
                  const chatbotResult = await chatbotResponse.json();
                  console.log('[Meta Webhook] Registration chatbot response:', chatbotResult);
                } catch (chatbotError) {
                  console.error('[Meta Webhook] Registration chatbot error:', chatbotError);
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
                  await sendMetaCloudMessage(supabase, normalizedPhone, confirmMessage, tenantId, webhookPhoneNumberId);

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
                // If no pending consent found, fall through to conversational flow / chatbot
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
                      tenantId, webhookPhoneNumberId
                    );
                  } else {
                    await sendMetaCloudMessage(supabase, normalizedPhone,
                      `Para confirmar seu cadastro, use o formato: CONFIRMAR [código]\n\nExemplo: CONFIRMAR ${code}`,
                      tenantId, webhookPhoneNumberId
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

              // === CONVERSATIONAL FLOW (Welcome → Municipality → Community) ===
              // Skip conversational flow and chatbot for secondary numbers
              if (isSecondaryNumber) {
                console.log(`[Meta Webhook] Secondary number — no keyword/flow match, staying silent`);
                continue;
              }

              if (!handledAsVerification && messageText.trim()) {
                const handledByFlow = await handleConversationalFlow(
                  supabase, from, normalizedPhone, messageText, tenantId, webhookPhoneNumberId
                );

                if (handledByFlow) {
                  console.log('[Meta Webhook] Handled by conversational flow');
                  continue;
                }

                // === CHATBOT FALLBACK ===
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
                        tenantId: tenantId,
                        phoneNumberId: webhookPhoneNumberId,
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
