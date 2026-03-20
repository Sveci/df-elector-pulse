import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOfficialWhatsAppRequest {
  leaderId: string;
  template: 'bemvindo1' | 'confirmar1';
  nome: string;
  telefone: string;
  // For bemvindo1
  affiliateToken?: string;
  // For confirmar1
  verificationCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SendOfficialWhatsAppRequest = await req.json();
    const { leaderId, template, nome, telefone, affiliateToken, verificationCode } = body;

    console.log(`[send-whatsapp-official] Processing request for leader ${leaderId}, template: ${template}`);

    // Validate required fields
    if (!leaderId || !template || !nome || !telefone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate template-specific fields
    if (template === 'bemvindo1' && !affiliateToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'affiliateToken is required for bemvindo1 template' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template === 'confirmar1' && !verificationCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'verificationCode is required for confirmar1 template' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch SMSBarato API key from settings
    const { data: settings, error: settingsError } = await supabase
      .from('integrations_settings')
      .select('smsbarato_api_key, smsbarato_enabled')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('[send-whatsapp-official] Failed to fetch settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch integration settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.smsbarato_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'SMSBarato integration is not enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.smsbarato_api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'SMSBarato API key is not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits and country code 55)
    let cleanPhone = telefone.replace(/\D/g, '');
    // Remove country code 55 if present (API expects phone without it)
    if (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
      cleanPhone = cleanPhone.substring(2);
    }

    // Build URL with parameters
    const url = new URL('https://sistema81.smsbarato.com.br/sendwa');
    url.searchParams.set('chave', settings.smsbarato_api_key);
    url.searchParams.set('dest', cleanPhone);
    url.searchParams.set('template', template);

    // Add template-specific parameters
    if (template === 'bemvindo1') {
      // Parameters: Nome, Token de Afiliado
      url.searchParams.append('prm[]', nome);
      url.searchParams.append('prm[]', affiliateToken!);
    } else if (template === 'confirmar1') {
      // Parameters: Nome, "sua conta", Código de Verificação
      url.searchParams.append('prm[]', nome);
      url.searchParams.append('prm[]', 'sua conta');
      url.searchParams.append('prm[]', verificationCode!);
    }

    // Log request details without exposing API key
    const safeUrl = new URL(url.toString());
    safeUrl.searchParams.set('chave', '***');
    console.log(
      `[send-whatsapp-official] Sending to ${cleanPhone} (len=${cleanPhone.length}) template=${template} url=${safeUrl.toString()}`
    );

    // Make the API call
    const response = await fetch(url.toString());
    const responseText = await response.text();

    console.log(`[send-whatsapp-official] API Response: ${responseText}`);

    // Parse response - SMSBarato returns different codes
    // Success codes typically start with numbers, errors with "ERRO"
    const isSuccess = !responseText.startsWith('ERRO') && !responseText.includes('erro');

    // Log the message to whatsapp_messages table for history
    const templateMessage = template === 'bemvindo1' 
      ? `[API Oficial] Boas-vindas enviada para ${nome}`
      : `[API Oficial] Verificação enviada para ${nome}`;

    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: cleanPhone,
        message: templateMessage,
        status: isSuccess ? 'sent' : 'failed',
        direction: 'outgoing',
        template_slug: `official-${template}`,
        sent_at: new Date().toISOString(),
        error_message: isSuccess ? null : responseText,
      });

    if (insertError) {
      console.error('[send-whatsapp-official] Failed to log message:', insertError);
    }

    // IMPORTANT: Return 200 even on API failures so the frontend can handle gracefully
    // (Supabase client treats non-2xx as an exception-like error, which can lead to blank screens)
    if (!isSuccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `API error: ${responseText}`,
          apiResponse: responseText,
          debug: {
            dest: cleanPhone,
            destLength: cleanPhone.length,
            template,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent successfully',
        apiResponse: responseText 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-whatsapp-official] Unexpected error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});