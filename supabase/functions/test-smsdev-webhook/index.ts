import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[test-smsdev-webhook] Starting webhook test...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find a recent SMS message to use for testing
    const { data: messages, error: fetchError } = await supabase
      .from('sms_messages')
      .select('id, message_id, status, phone')
      .not('message_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[test-smsdev-webhook] Error fetching messages:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar mensagens SMS' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      console.log('[test-smsdev-webhook] No SMS messages found for testing');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nenhuma mensagem SMS encontrada para testar. Envie pelo menos uma mensagem primeiro.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testMessage = messages[0];
    const originalStatus = testMessage.status;
    console.log('[test-smsdev-webhook] Using message:', testMessage.id, 'Current status:', originalStatus);

    // 2. Simulate a webhook callback by calling the smsdev-webhook function
    const testPayload = {
      id: testMessage.message_id,
      status: 'RECEBIDA', // Simulating a "delivered" status from SMSDEV
      descricao: 'Mensagem recebida pelo destinatário (TESTE)',
    };

    console.log('[test-smsdev-webhook] Calling smsdev-webhook with test payload:', testPayload);

    // Call the webhook function directly
    const webhookUrl = `${supabaseUrl}/functions/v1/smsdev-webhook`;
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const webhookResult = await webhookResponse.json();
    console.log('[test-smsdev-webhook] Webhook response:', webhookResult);

    if (!webhookResponse.ok || !webhookResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: webhookResult.error || 'Webhook retornou erro',
          details: webhookResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Verify the status was updated
    const { data: updatedMessage, error: verifyError } = await supabase
      .from('sms_messages')
      .select('id, status, updated_at')
      .eq('id', testMessage.id)
      .single();

    if (verifyError) {
      console.error('[test-smsdev-webhook] Error verifying update:', verifyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar atualização' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusChanged = updatedMessage.status !== originalStatus;
    console.log('[test-smsdev-webhook] Test complete. Status changed:', statusChanged,
      'From:', originalStatus, 'To:', updatedMessage.status);

    // 4. Restore original status if it was changed
    if (statusChanged) {
      await supabase
        .from('sms_messages')
        .update({ status: originalStatus })
        .eq('id', testMessage.id);
      console.log('[test-smsdev-webhook] Restored original status:', originalStatus);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook funcionando corretamente!',
        details: {
          message_id: testMessage.message_id,
          original_status: originalStatus,
          test_status: updatedMessage.status,
          status_updated: statusChanged,
          restored: statusChanged,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[test-smsdev-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
