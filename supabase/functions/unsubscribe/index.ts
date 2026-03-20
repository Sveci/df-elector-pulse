import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const reason = url.searchParams.get("reason") || "Solicitação via email";

    if (!token) {
      return new Response(
        generateHtmlPage("Erro", "Token de descadastro não fornecido.", false),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    console.log(`[unsubscribe] Processing unsubscribe for token: ${token}`);

    // Find contact by unsubscribe token
    const { data: contact, error: findError } = await supabase
      .from("office_contacts")
      .select("id, nome, is_active")
      .eq("unsubscribe_token", token)
      .single();

    if (findError || !contact) {
      console.error("[unsubscribe] Contact not found:", findError);
      return new Response(
        generateHtmlPage("Token Inválido", "Este link de descadastro não é válido ou já foi utilizado.", false),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Check if already unsubscribed
    if (!contact.is_active) {
      return new Response(
        generateHtmlPage("Já Descadastrado", `${contact.nome}, você já está descadastrado de nossas comunicações.`, true),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Update contact to inactive
    const { error: updateError } = await supabase
      .from("office_contacts")
      .update({
        is_active: false,
        opted_out_at: new Date().toISOString(),
        opt_out_reason: reason,
        opt_out_channel: "email",
      })
      .eq("id", contact.id);

    if (updateError) {
      console.error("[unsubscribe] Error updating contact:", updateError);
      return new Response(
        generateHtmlPage("Erro", "Ocorreu um erro ao processar sua solicitação. Tente novamente.", false),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    console.log(`[unsubscribe] Contact ${contact.id} successfully unsubscribed`);

    return new Response(
      generateHtmlPage(
        "Descadastro Confirmado",
        `${contact.nome}, você foi descadastrado(a) com sucesso e não receberá mais nossas comunicações.`,
        true
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );

  } catch (error) {
    console.error("[unsubscribe] Error:", error);
    return new Response(
      generateHtmlPage("Erro", "Ocorreu um erro inesperado. Tente novamente mais tarde.", false),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});

function generateHtmlPage(title: string, message: string, success: boolean): string {
  const iconSvg = success
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon { margin-bottom: 24px; }
    h1 {
      font-size: 24px;
      color: #1f2937;
      margin-bottom: 16px;
    }
    p {
      font-size: 16px;
      color: #6b7280;
      line-height: 1.6;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${iconSvg}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="footer">
      Se isso foi um engano, entre em contato conosco.
    </div>
  </div>
</body>
</html>`;
}
