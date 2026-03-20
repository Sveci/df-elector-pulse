import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapear role para label amigável
const roleLabels: Record<string, string> = {
  'super_admin': 'Super Administrador',
  'admin': 'Administrador',
  'atendente': 'Atendente',
  'checkin_operator': 'Operador de Check-in'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[create-admin-user] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a client to verify the user
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user: callingUser }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !callingUser) {
      console.error('[create-admin-user] Invalid token:', authError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if calling user has admin role
    const { data: userRole, error: roleError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();

    if (roleError || !userRole) {
      console.error('[create-admin-user] User not authorized:', callingUser.id, roleError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Apenas administradores podem criar usuários.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log(`[create-admin-user] Authorized user ${callingUser.email} with role ${userRole.role}`);
    // ========== END AUTHENTICATION CHECK ==========

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { email, password, name, role = 'admin', phone } = await req.json();

    // Validate that only admins can create super_admin users
    if (role === 'super_admin' && userRole.role !== 'super_admin') {
      console.error('[create-admin-user] Non-super_admin trying to create super_admin');
      return new Response(
        JSON.stringify({ error: 'Apenas super administradores podem criar outros super administradores.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('Creating admin user:', { email, name, role });

    // Create user in Supabase Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (createError) {
      console.error('Auth error:', createError);
      throw createError;
    }

    console.log('User created in auth:', authData.user.id);

    // Aguardar um pouco para o trigger executar
    await new Promise(resolve => setTimeout(resolve, 500));

    // Garantir que o perfil existe (upsert como fallback do trigger)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        name: name,
        role: role,
        telefone: phone || null
      }, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      console.error('Profile upsert error:', profileError);
    } else {
      console.log('Profile ensured:', profile);
    }

    // Create user_roles entry
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: authData.user.id,
        role: role
      }, { onConflict: 'user_id, role' });

    if (roleInsertError) {
      console.error('Role creation error:', roleInsertError);
    } else {
      console.log('Role created successfully:', role);
    }

    // Preparar variáveis para os templates
    const templateVariables = {
      nome: name,
      email: email,
      senha: password,
      nivel: roleLabels[role] || role,
      link_plataforma: Deno.env.get("APP_BASE_URL") || "https://app.eleitor360.ai"
    };

    // Enviar Email de boas-vindas
    let emailSent = false;
    try {
      console.log('Sending welcome email to:', email);

      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceRoleKey}`
        },
        body: JSON.stringify({
          templateSlug: 'membro-cadastro-boas-vindas',
          to: email,
          toName: name,
          variables: templateVariables
        })
      });

      const emailResult = await emailResponse.json();
      console.log('Email response:', emailResult);
      emailSent = emailResponse.ok;
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    // Enviar WhatsApp de boas-vindas (se telefone informado)
    let whatsappSent = false;
    if (phone) {
      try {
        console.log('Sending welcome WhatsApp to:', phone);

        const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceRoleKey}`
          },
          body: JSON.stringify({
            phone: phone,
            templateSlug: 'membro-cadastro-boas-vindas',
            variables: templateVariables
          })
        });

        const whatsappResult = await whatsappResponse.json();
        console.log('WhatsApp response:', whatsappResult);
        whatsappSent = whatsappResponse.ok;
      } catch (whatsappError) {
        console.error('Error sending welcome WhatsApp:', whatsappError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        profile,
        notifications: {
          emailSent,
          whatsappSent
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating admin user:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
