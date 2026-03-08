import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  templateSlug?: string;
  templateId?: string;
  to: string;
  toName?: string;
  subject?: string;
  html?: string;
  variables?: Record<string, string>;
  contactId?: string;
  leaderId?: string;
  eventId?: string;
}

// Templates públicos que podem ser enviados sem autenticação
const PUBLIC_TEMPLATES = [
  'evento-cadastro-confirmado',
  'captacao-boas-vindas',
  'lider-cadastro-confirmado',
  'visita-link-formulario',
  'membro-cadastro-boas-vindas',
  'lideranca-boas-vindas', // Template para promoção automática de líderes
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body first to check if it's a public template
    const body: SendEmailRequest = await req.json();
    const { templateSlug, templateId, to, toName, subject: customSubject, html: customHtml, variables = {}, contactId, leaderId, eventId } = body;

    const isPublicTemplate = templateSlug && PUBLIC_TEMPLATES.includes(templateSlug);

    // ============ AUTHENTICATION CHECK (skip for public templates) ============
    if (!isPublicTemplate) {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        console.error("[send-email] Missing authorization header");
        return new Response(
          JSON.stringify({ success: false, error: "Não autenticado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.error("[send-email] Invalid token:", authError);
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check user has admin, super_admin, or atendente role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin", "atendente"])
        .limit(1)
        .single();

      if (roleError || !roleData) {
        console.error("[send-email] User lacks required role:", user.id);
        return new Response(
          JSON.stringify({ success: false, error: "Acesso não autorizado. Requer permissão de admin ou atendente." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[send-email] Authenticated user: ${user.email} with role: ${roleData.role}`);
    } else {
      console.log(`[send-email] Public template '${templateSlug}' - skipping authentication`);
    }
    // ============ END AUTHENTICATION CHECK ============

    // Get integration settings
    const { data: settings, error: settingsError } = await supabase
      .from('integrations_settings')
      .select('resend_api_key, resend_from_email, resend_from_name, resend_enabled')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Failed to fetch settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações de email não encontradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.resend_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'Integração de email está desabilitada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings.resend_api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'API Key do Resend não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      console.error('Invalid email address:', to);
      return new Response(
        JSON.stringify({ success: false, error: `Email inválido: "${to}". O email deve seguir o formato email@exemplo.com` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalHtml = customHtml || '';
    let finalSubject = customSubject || '';
    let templateDbId: string | null = null;

    // If using a template, fetch it
    if (templateSlug || templateId) {
      const query = supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true);

      if (templateSlug) {
        query.eq('slug', templateSlug);
      } else if (templateId) {
        query.eq('id', templateId);
      }

      const { data: template, error: templateError } = await query.single();

      if (templateError || !template) {
        console.error('Template not found:', templateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Template de email não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      templateDbId = template.id;
      finalHtml = template.conteudo_html;
      finalSubject = template.assunto;

      // Replace variables in HTML and subject
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        finalHtml = finalHtml.replace(regex, value || '');
        finalSubject = finalSubject.replace(regex, value || '');
      });

      // Clean up any remaining unreplaced variables (safety net)
      finalHtml = finalHtml.replace(/\{\{[a-zA-Z_]+\}\}/g, (match) => {
        console.warn(`[send-email] Unreplaced variable found: ${match} in template ${templateSlug || templateId}`);
        return '';
      });
      finalSubject = finalSubject.replace(/\{\{[a-zA-Z_]+\}\}/g, '');
    }

    // Generate unsubscribe link if contact exists
    if (contactId) {
      const { data: contactData } = await supabase
        .from('office_contacts')
        .select('unsubscribe_token')
        .eq('id', contactId)
        .single();
      
      if (contactData?.unsubscribe_token) {
        const emailBaseUrl = Deno.env.get("APP_BASE_URL") || "https://df-elector-pulse.lovable.app";
        const unsubscribeUrl = `${emailBaseUrl}/descadastro?token=${contactData.unsubscribe_token}`;
        // Replace unsubscribe placeholder in HTML
        finalHtml = finalHtml.replace(/{{link_descadastro}}/g, unsubscribeUrl);
        finalHtml = finalHtml.replace(/href="#"([^>]*>Se não deseja mais receber)/g, `href="${unsubscribeUrl}"$1`);
      }
    }

    if (!finalHtml || !finalSubject) {
      return new Response(
        JSON.stringify({ success: false, error: 'Conteúdo do email ou assunto não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create email log record with rendered HTML
    const { data: logRecord, error: logError } = await supabase
      .from('email_logs')
      .insert({
        template_id: templateDbId,
        to_email: to,
        to_name: toName,
        subject: finalSubject,
        status: 'pending',
        contact_id: contactId || null,
        leader_id: leaderId || null,
        event_id: eventId || null,
        body_html: finalHtml,
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create email log:', logError);
    }

    // Send email via Resend
    const resend = new Resend(settings.resend_api_key);
    const fromEmail = settings.resend_from_email || 'onboarding@resend.dev';
    const fromName = settings.resend_from_name || 'Sistema';

    console.log(`Sending email to ${to} with subject: ${finalSubject}`);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: finalSubject,
      html: finalHtml,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      
      // Update log with error
      if (logRecord) {
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: emailError.message,
          })
          .eq('id', logRecord.id);
      }

      return new Response(
        JSON.stringify({ success: false, error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully:', emailData);

    // Update log with success
    if (logRecord) {
      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          resend_id: emailData?.id,
          sent_at: new Date().toISOString(),
        })
        .eq('id', logRecord.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailData?.id,
        logId: logRecord?.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
