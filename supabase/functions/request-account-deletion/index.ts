/**
 * request-account-deletion
 *
 * LGPD Art. 18, VI – Eliminação dos dados pessoais tratados com o consentimento
 *
 * Allows an authenticated user to request deletion of their own account.
 * Flow:
 *   1. Validates JWT (user must be authenticated)
 *   2. Logs a LGPD rights request (type=deletion) in lgpd_rights_requests
 *   3. If the user is NOT an admin, deletes the auth user immediately
 *      (cascade deletes personal data via FK constraints)
 *   4. If the user IS an admin, creates a pending request for manual review
 *      (to avoid accidental loss of tenant data)
 *
 * The user receives an email confirmation via Supabase Auth's built-in flow.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ── Parse body ────────────────────────────────────────────
    let body: { reason?: string; confirmEmail?: string } = {};
    try { body = await req.json(); } catch { /* empty body ok */ }

    const reason = body.reason?.trim() || "Solicitação via painel de privacidade";

    // Validate confirmation email matches the user's email
    if (body.confirmEmail && body.confirmEmail.toLowerCase() !== (user.email ?? "").toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "E-mail de confirmação não corresponde ao e-mail da conta." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // ── Check if user is an admin ─────────────────────────────
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    const isAdmin = !!roleRow;
    const tenantId: string | null = roleRow?.tenant_id ?? null;

    // ── Log the LGPD rights request ───────────────────────────
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "";
    const userAgent = req.headers.get("user-agent")?.slice(0, 200) || "";

    await admin.from("lgpd_rights_requests").insert({
      tenant_id: tenantId,
      requester_name: user.user_metadata?.full_name || user.email || "Usuário",
      requester_email: user.email || "",
      request_type: "deletion",
      status: isAdmin ? "pending" : "completed",
      description: reason,
      ip_address: ipAddress,
      user_agent: userAgent,
      ...(isAdmin ? {} : {
        responded_by: null,
        responded_at: new Date().toISOString(),
        response_text: "Conta excluída automaticamente conforme solicitação do titular (LGPD Art. 18, VI).",
      }),
    });

    // ── Admin accounts: create pending request, do not auto-delete ───
    if (isAdmin) {
      console.log(`[request-account-deletion] Admin ${user.email} requested deletion – pending manual review`);
      return new Response(
        JSON.stringify({
          success: true,
          immediate: false,
          message:
            "Solicitação registrada. Por ser uma conta administrativa, a exclusão será processada manualmente em até 15 dias úteis. Você receberá uma confirmação por e-mail.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Non-admin: delete immediately ─────────────────────────
    console.log(`[request-account-deletion] Deleting non-admin user ${user.email}`);

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("[request-account-deletion] Delete error:", delErr);
      throw delErr;
    }

    console.log(`[request-account-deletion] User ${user.id} deleted successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        immediate: true,
        message: "Sua conta foi excluída com sucesso. Todos os seus dados foram removidos.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[request-account-deletion] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
