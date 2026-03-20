import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_TEMPLATES = [
  {
    slug: "lideranca-boas-vindas",
    nome: "Boas-vindas para Novo Apoiador",
    assunto: "🎉 Bem-vindo(a) à nossa rede de apoiadores!",
    categoria: "apoiadores",
    variaveis: ["nome", "link_indicacao", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "lider-cadastro-boas-vindas",
    nome: "Cadastro via Apoiador",
    assunto: "Bem-vindo(a)! Cadastro realizado com sucesso",
    categoria: "apoiadores",
    variaveis: ["nome", "lider_nome", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "lideranca-cadastro-link",
    nome: "Convite para Apoiador - Cadastro Individual",
    assunto: "📢 Seu link para cadastro de novos contatos",
    categoria: "apoiadores",
    variaveis: ["nome", "link_cadastro_afiliado", "qr_code_url", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "lideranca-reuniao-link",
    nome: "Convite para Apoiador - Reunião Individual",
    assunto: "🤝 Seu link para agendamento de reuniões individuais",
    categoria: "apoiadores",
    variaveis: ["nome", "deputado_nome", "link_reuniao_afiliado", "qr_code_url", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "lideranca-evento-convite",
    nome: "Convite para Apoiadores - Evento",
    assunto: "🎯 Novo evento: {{evento_nome}} - Divulgue para sua base!",
    categoria: "apoiadores",
    variaveis: ["nome", "evento_nome", "evento_data", "evento_hora", "evento_local", "link_afiliado", "qr_code_url", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "lideranca-pesquisa-link",
    nome: "Convite para Apoiadores - Pesquisa",
    assunto: "📊 Seu link para compartilhar a pesquisa: {{pesquisa_titulo}}",
    categoria: "apoiadores",
    variaveis: ["nome", "pesquisa_titulo", "link_pesquisa_afiliado", "qr_code_url", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "captacao-boas-vindas",
    nome: "Boas-vindas - Material de Captação",
    assunto: "Seu material está pronto!",
    categoria: "captacao",
    variaveis: ["nome", "material_nome", "download_url", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "captacao-convite-material",
    nome: "Convite para Material de Captação",
    assunto: "📥 {{material_nome}} - Material exclusivo disponível para você!",
    categoria: "captacao",
    variaveis: ["nome", "material_nome", "material_descricao", "link_captacao", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "membro-cadastro-boas-vindas",
    nome: "Boas-vindas ao Novo Membro",
    assunto: "Bem-vindo(a) à equipe! Suas credenciais de acesso",
    categoria: "equipe",
    variaveis: ["nome", "email", "senha_temporaria", "link_login", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "evento-cadastro-confirmado",
    nome: "Cadastro no Evento Confirmado",
    assunto: "Inscrição confirmada: {{evento_nome}}",
    categoria: "evento",
    variaveis: ["nome", "evento_nome", "evento_data", "evento_hora", "evento_local", "evento_endereco", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "evento-convite-participar",
    nome: "Convite para Evento",
    assunto: "📅 Você está convidado(a): {{evento_nome}}",
    categoria: "evento",
    variaveis: ["nome", "evento_nome", "evento_data", "evento_hora", "evento_local", "evento_endereco", "evento_descricao", "link_inscricao", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "evento-fotos-disponivel",
    nome: "Fotos do Evento Disponíveis",
    assunto: "Obrigado por participar do {{nome_evento}}! Confira as fotos 📸",
    categoria: "evento",
    variaveis: ["nome", "nome_evento", "link_fotos", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "material-regiao-email",
    nome: "Material de Região",
    assunto: "📥 Material exclusivo da sua região!",
    categoria: "evento",
    variaveis: ["nome", "material_nome", "material_descricao", "link_material", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "pesquisa-agradecimento",
    nome: "Agradecimento Pesquisa",
    assunto: "Obrigado por participar! 🙏",
    categoria: "pesquisa",
    variaveis: ["nome", "pesquisa_titulo", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "pesquisa-convite",
    nome: "Convite para Pesquisa",
    assunto: "Sua opinião importa! Participe: {{pesquisa_titulo}}",
    categoria: "pesquisa",
    variaveis: ["nome", "pesquisa_titulo", "link_pesquisa", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "boas-vindas-plataforma",
    nome: "Boas-vindas na Plataforma",
    assunto: "Bem-vindo(a) à nossa plataforma!",
    categoria: "sistema",
    variaveis: ["nome", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "validacao-cadastro-email",
    nome: "Validação de Cadastro - Email",
    assunto: "Confirme seu cadastro, {{nome}}!",
    categoria: "sistema",
    variaveis: ["nome", "codigo_verificacao", "link_verificacao", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "visita-reuniao-cancelada",
    nome: "Reunião Cancelada",
    assunto: "Sua reunião foi cancelada",
    categoria: "visita",
    variaveis: ["nome", "protocolo", "data_agendada", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "visita-reuniao-reagendada",
    nome: "Reunião Reagendada",
    assunto: "Sua reunião foi reagendada",
    categoria: "visita",
    variaveis: ["nome", "protocolo", "nova_data", "novo_horario", "link_descadastro"],
    is_active: true,
  },
  {
    slug: "visita-cadastro-link-formulario",
    nome: "Visita Cadastrada - Link do Formulário",
    assunto: "Complete seu cadastro - Gabinete {{deputado_nome}}",
    categoria: "visita",
    variaveis: ["nome", "deputado_nome", "protocolo", "link_formulario", "link_descadastro"],
    is_active: true,
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check - only super_admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1)
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Requer super_admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body - expects { templates: [...] } with full conteudo_html
    const body = await req.json();
    const templates = body.templates || [];

    if (!templates.length) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum template fornecido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const tpl of templates) {
      // Check if template exists by slug
      const { data: existing } = await supabase
        .from("email_templates")
        .select("id")
        .eq("slug", tpl.slug)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("email_templates")
          .update({
            nome: tpl.nome,
            assunto: tpl.assunto,
            conteudo_html: tpl.conteudo_html,
            categoria: tpl.categoria,
            variaveis: tpl.variaveis,
            is_active: tpl.is_active ?? true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) {
          errors.push(`${tpl.slug}: ${error.message}`);
        } else {
          updated++;
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from("email_templates")
          .insert({
            slug: tpl.slug,
            nome: tpl.nome,
            assunto: tpl.assunto,
            conteudo_html: tpl.conteudo_html,
            categoria: tpl.categoria,
            variaveis: tpl.variaveis,
            is_active: tpl.is_active ?? true,
          });

        if (error) {
          errors.push(`${tpl.slug}: ${error.message}`);
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, updated, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
