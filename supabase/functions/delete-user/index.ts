import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      console.error('[delete-user] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user: callingUser }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !callingUser) {
      console.error('[delete-user] Invalid token:', authError);
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
      console.error('[delete-user] User not authorized:', callingUser.id, roleError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Apenas administradores podem excluir usuários.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log(`[delete-user] Authorized user ${callingUser.email} with role ${userRole.role}`);
    // ========== END AUTHENTICATION CHECK ==========

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === callingUser.id) {
      console.error('[delete-user] User tried to delete themselves:', userId);
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir sua própria conta.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if target user is a super_admin - only super_admins can delete super_admins
    const { data: targetRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (targetRole && userRole.role !== 'super_admin') {
      console.error('[delete-user] Non-super_admin trying to delete super_admin');
      return new Response(
        JSON.stringify({ error: 'Apenas super administradores podem excluir outros super administradores.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log(`[delete-user] Excluindo usuário: ${userId}`);

    // Excluir usuário do Supabase Auth (cascade delete limpa outras tabelas)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`[delete-user] Erro ao excluir usuário:`, error);
      throw error;
    }

    console.log(`[delete-user] Usuário ${userId} excluído com sucesso`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[delete-user] Erro:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
