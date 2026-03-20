import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  templateSlug?: string;
  templateId?: string;
  tenantId?: string;
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

/**
 * Resolve tenant ID from multiple sources in priority order:
 * 1. Explicitly passed tenantId in request body
 * 2. JWT user's tenant (via user_tenants)
 * 3. contact_id → office_contacts.tenant_id
 * 4. leader_id → lideres.tenant_id
 * 5. Default (first) tenant in DB
 */
async function resolveTenantId(
  supabase: ReturnType<typeof createClient>,
  requestTenantId: string | undefined,
  userId: string | undefined,
  contactId: string | undefined,
  leaderId: string | undefined,
): Promise<string | null> {
  // 1. Explicitly provided
  if (requestTenantId) return requestTenantId;

  // 2. From authenticated user
  if (userId) {
    const { data: tenantRow } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (tenantRow?.tenant_id) return tenantRow.tenant_id;
  }

  // 3. From contact
  if (contactId) {
    const { data: contact } = await supabase
      .from('office_contacts')
      .select('tenant_id')
      .eq('id', contactId)
      .maybeSingle();
    if (contact?.tenant_id) return contact.tenant_id;
  }

  // 4. From leader
  if (leaderId) {
    const { data: leader } = await supabase
      .from('lideres')
      .select('tenant_id')
      .eq('id', leaderId)
      .maybeSingle();
    if (leader?.tenant_id) return leader.tenant_id;
  }

  // 5. Fallback: default tenant
  const { data: defaultTenant } = await supabase
    .from('tenants')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return defaultTenant?.id || null;
}

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
    const {
      templateSlug,
      templateId,
      tenantId: requestTenantId,
      to,
      toName,
      subject: customSubject,
      html: customHtml,
      variables = {},
      contactId,
      leaderId,
      eventId,
    } = body;

    const isPublicTemplate = templateSlug && PUBLIC_TEMPLATES.includes(templateSlug);

    // ============ AUTHENTICATION CHECK (skip for public templates) ============
    let authenticatedUserId: string | undefined;

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

      authenticatedUserId = user.id;
      console.log(`[send-email] Authenticated user: ${user.email} with role: ${roleData.role}`);
    } else {
      console.log(`[send-email] Public template '${templateSlug}' - skipping authentication`);
    }
    // ============ END AUTHENTICATION CHECK ============

    // ============ RESOLVE TENANT ID ============
    const resolvedTenantId = await resolveTenantId(
      supabase,
      requestTenantId,
      authenticatedUserId,
      contactId,
      leaderId,
    );

    console.log(`[send-email] Resolved tenant_id: ${resolvedTenantId}`);

    // ============ GET INTEGRATION SETTINGS (tenant-scoped) ============
    let settings: {
      resend_api_key: string | null;
      resend_from_email: string | null;
      resend_from_name: string | null;
      resend_enabled: boolean;
    } | null = null;

    // Try tenant-specific settings first
    if (resolvedTenantId) {
      const { data: tenantSettings, error: tenantSettingsError } = await supabase
        .from('integrations_settings')
        .select('resend_api_key, resend_from_email, resend_from_name, resend_enabled')
        .eq('tenant_id', resolvedTenantId)
        .maybeSingle();

      if (!tenantSettingsError && tenantSettings) {
        settings = tenantSettings;
        console.log(`[send-email] Using tenant-specific settings for tenant: ${resolvedTenantId}`);
      }
    }

    // Fallback: global settings row (for backward compat when resend_api_key is shared)
    if (!settings || !settings.resend_api_key) {
      console.log(`[send-email] Falling back to global settings row`);
      const { data: globalSettings, error: globalSettingsError } = await supabase
        .from('integrations_settings')
        .select('resend_api_key, resend_from_email, resend_from_name, resend_enabled')
        .not('resend_api_key', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (globalSettingsError || !globalSettings) {
        console.error('[send-email] Failed to fetch settings:', globalSettingsError);
        return new Response(
          JSON.stringify({ success: false, error: 'Configurações de email não encontradas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If tenant has its own from_email/from_name, prefer those
      settings = {
        resend_api_key: globalSettings.resend_api_key,
        resend_from_email: settings?.resend_from_email || globalSettings.resend_from_email,
        resend_from_name: settings?.resend_from_name || globalSettings.resend_from_name,
        resend_enabled: settings?.resend_enabled ?? globalSettings.resend_enabled,
      };
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
      console.error('[send-email] Invalid email address:', to);
      return new Response(
        JSON.stringify({ success: false, error: `Email inválido: "${to}". O email deve seguir o formato email@exemplo.com` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let finalHtml = customHtml || '';
    let finalSubject = customSubject || '';
    let templateDbId: string | null = null;

    // If using a template, fetch it (tenant override first, then global default)
    if (templateSlug || templateId) {
      let template: any = null;

      // Try tenant override first
      if (resolvedTenantId && templateSlug) {
        const { data: tenantTemplate } = await supabase
          .from('tenant_email_templates')
          .select('*')
          .eq('tenant_id', resolvedTenantId)
          .eq('slug', templateSlug)
          .eq('is_active', true)
          .single();

        if (tenantTemplate) {
          template = tenantTemplate;
          console.log(`[send-email] Using tenant template override for slug: ${templateSlug}, tenant: ${resolvedTenantId}`);
        }
      }

      // Fallback to global default
      if (!template) {
        const query = supabase
          .from('email_templates')
          .select('*')
          .eq('is_active', true);

        if (templateSlug) {
          query.eq('slug', templateSlug);
        } else if (templateId) {
          query.eq('id', templateId);
        }

        const { data: globalTemplate, error: templateError } = await query.single();

        if (templateError || !globalTemplate) {
          console.error('[send-email] Template not found:', templateError);
          return new Response(
            JSON.stringify({ success: false, error: 'Template de email não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        template = globalTemplate;
      }

      templateDbId = template.id;
      finalHtml = template.conteudo_html;
      finalSubject = template.assunto;

      // Auto-inject politico and cargo from organization table — TENANT-SCOPED
      if (!variables.politico || !variables.cargo) {
        let orgQuery = supabase
          .from('organization')
          .select('nome, cargo');

        // Filter by tenant if possible
        if (resolvedTenantId) {
          orgQuery = orgQuery.eq('tenant_id', resolvedTenantId);
        }

        const { data: orgData } = await orgQuery.limit(1).maybeSingle();

        if (orgData) {
          if (!variables.politico) variables.politico = orgData.nome || '';
          if (!variables.cargo) variables.cargo = orgData.cargo || '';
        }
      }

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
        const emailBaseUrl = Deno.env.get("APP_BASE_URL") || "https://app.eleitor360.ai";
        const unsubscribeUrl = `${emailBaseUrl}/descadastro?token=${contactData.unsubscribe_token}`;
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

    // Create email log record with rendered HTML and tenant_id
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
        tenant_id: resolvedTenantId || null,
      })
      .select()
      .single();

    if (logError) {
      console.error('[send-email] Failed to create email log:', logError);
    }

    // Send email via Resend
    const resend = new Resend(settings.resend_api_key);
    const fromEmail = settings.resend_from_email || 'onboarding@resend.dev';
    const fromName = settings.resend_from_name || 'Sistema';

    console.log(`[send-email] Sending to ${to} (tenant: ${resolvedTenantId}) subject: ${finalSubject}`);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: finalSubject,
      html: finalHtml,
    });

    if (emailError) {
      console.error('[send-email] Resend error:', emailError);

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

    console.log('[send-email] Sent successfully:', emailData);

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
        logId: logRecord?.id,
        tenantId: resolvedTenantId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-email] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
