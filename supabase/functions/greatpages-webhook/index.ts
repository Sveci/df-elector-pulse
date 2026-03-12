import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Campos suportados para descoberta pelo GreatPages
const SUPPORTED_FIELDS = [
  { nome: "Nome", slug: "nome", obrigatorio: true, variantes: ["name", "full_name", "nome_completo", "Nome_Completo"] },
  { nome: "Email", slug: "email", obrigatorio: false, variantes: ["e-mail", "E-mail", "Email"] },
  { nome: "Telefone", slug: "telefone", obrigatorio: true, variantes: ["phone", "whatsapp", "WhatsApp", "celular", "Celular", "mobile", "Telefone"] },
  { nome: "Cidade", slug: "cidade", obrigatorio: false, variantes: ["city", "regiao", "region", "Cidade", "Regiao"] },
  { nome: "Data de Nascimento", slug: "data_nascimento", obrigatorio: false, variantes: ["birth_date", "birthDate", "nascimento", "aniversario", "Data_de_nascimento", "DataNascimento"] },
  { nome: "UTM Source", slug: "utm_source", obrigatorio: false, variantes: [] },
  { nome: "UTM Medium", slug: "utm_medium", obrigatorio: false, variantes: [] },
  { nome: "UTM Campaign", slug: "utm_campaign", obrigatorio: false, variantes: [] },
  { nome: "UTM Content", slug: "utm_content", obrigatorio: false, variantes: [] },
  { nome: "URL da Página", slug: "url", obrigatorio: false, variantes: ["page_url", "PageUrl", "origem", "source_url", "URL"] },
];

interface GreatPagesPayload {
  [key: string]: string | undefined;
}

// Normalizar telefone para formato E.164
function normalizePhoneE164(phone: string): string {
  let cleanPhone = phone.replace(/\D/g, "");
  
  // Se já tem +55, remove para processar
  if (cleanPhone.startsWith("55") && cleanPhone.length === 13) {
    return `+${cleanPhone}`;
  }
  
  // Corrige erros comuns do formato 5506
  if (cleanPhone.length === 12 && cleanPhone.startsWith("5506")) {
    cleanPhone = "61" + cleanPhone.slice(4);
  }
  
  // Adiciona 9 se faltando (Brasília)
  if (cleanPhone.length === 10 && cleanPhone.startsWith("61")) {
    cleanPhone = "61" + "9" + cleanPhone.slice(2);
  }
  
  // Adiciona DDD 61 se for só o número
  if (cleanPhone.length === 9) {
    cleanPhone = "61" + cleanPhone;
  } else if (cleanPhone.length === 8) {
    cleanPhone = "61" + "9" + cleanPhone;
  }
  
  // Retorna no formato E.164
  if (cleanPhone.length === 11) {
    return `+55${cleanPhone}`;
  }
  
  // Se não conseguiu normalizar, retorna o original com +55
  return `+55${cleanPhone}`;
}

// Normalizar chaves do payload (remover underscores, lowercase)
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "").replace(/-/g, "").replace(/\s/g, "");
}

// Encontrar valor em payload com múltiplas variações de chave
function findValue(payload: GreatPagesPayload, variants: string[]): string | null {
  // Primeiro, tentar match exato
  for (const variant of variants) {
    if (payload[variant] !== undefined && payload[variant] !== "") {
      return payload[variant] as string;
    }
  }
  
  // Depois, tentar match normalizado (case-insensitive, sem underscores)
  const normalizedVariants = variants.map(normalizeKey);
  for (const [key, value] of Object.entries(payload)) {
    if (value && normalizedVariants.includes(normalizeKey(key))) {
      return value;
    }
  }
  
  return null;
}

// Extrair nome do payload
function extractName(payload: GreatPagesPayload): string | null {
  const variants = ["nome", "name", "full_name", "nome_completo", "Nome", "Name", "Nome_Completo", "NomeCompleto", "FullName"];
  return findValue(payload, variants);
}

// Extrair email do payload
function extractEmail(payload: GreatPagesPayload): string | null {
  const variants = ["email", "e-mail", "Email", "E-mail", "EMAIL", "E_mail"];
  return findValue(payload, variants);
}

// Extrair telefone do payload
function extractPhone(payload: GreatPagesPayload): string | null {
  const variants = ["telefone", "phone", "whatsapp", "celular", "mobile", "Telefone", "Phone", "WhatsApp", "Celular", "Mobile", "tel", "Tel"];
  return findValue(payload, variants);
}

// Extrair cidade do payload
function extractCity(payload: GreatPagesPayload): string | null {
  const variants = ["cidade", "city", "regiao", "region", "Cidade", "City", "Regiao", "Region"];
  return findValue(payload, variants);
}

// Extrair data de nascimento do payload
function extractBirthDate(payload: GreatPagesPayload): string | null {
  const variants = [
    "data_nascimento", "Data_de_nascimento", "data_de_nascimento",
    "birth_date", "birthDate", "BirthDate", "nascimento",
    "DataNascimento", "Data_Nascimento", "aniversario", "Aniversario"
  ];
  const rawDate = findValue(payload, variants);
  if (!rawDate) return null;
  
  // Tentar parsear diferentes formatos de data
  const cleanDate = rawDate.trim();
  
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Formato YYYY-MM-DD (ISO)
  const isoMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return cleanDate;
  }
  
  // Formato DD/MM/YY
  const shortYearMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (shortYearMatch) {
    const [, day, month, year] = shortYearMatch;
    const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  console.log(`[greatpages-webhook] Formato de data não reconhecido: ${rawDate}`);
  return null;
}

// Extrair UTM params
function extractUtmParams(payload: GreatPagesPayload) {
  return {
    utm_source: findValue(payload, ["utm_source", "utmSource", "UTM_Source"]),
    utm_medium: findValue(payload, ["utm_medium", "utmMedium", "UTM_Medium"]),
    utm_campaign: findValue(payload, ["utm_campaign", "utmCampaign", "UTM_Campaign"]),
    utm_content: findValue(payload, ["utm_content", "utmContent", "UTM_Content"]),
  };
}

// Extrair URL da página de origem
function extractPageUrl(payload: GreatPagesPayload): string | null {
  const variants = ["URL", "url", "page_url", "PageUrl", "origem", "source_url", "Url"];
  return findValue(payload, variants);
}

// Parsear payload baseado no Content-Type
async function parsePayload(req: Request): Promise<GreatPagesPayload> {
  const contentType = req.headers.get("content-type") || "";
  
  // JSON
  if (contentType.includes("application/json")) {
    console.log("[greatpages-webhook] Parseando como JSON");
    return await req.json();
  }
  
  // Form URL Encoded (formato padrão do GreatPages)
  if (contentType.includes("application/x-www-form-urlencoded")) {
    console.log("[greatpages-webhook] Parseando como x-www-form-urlencoded");
    const text = await req.text();
    console.log("[greatpages-webhook] Raw text:", text);
    return Object.fromEntries(new URLSearchParams(text));
  }
  
  // Multipart form data
  if (contentType.includes("multipart/form-data")) {
    console.log("[greatpages-webhook] Parseando como multipart/form-data");
    const formData = await req.formData();
    const payload: GreatPagesPayload = {};
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        payload[key] = value;
      }
    });
    return payload;
  }
  
  // Fallback: tentar JSON primeiro, depois URL encoded
  console.log("[greatpages-webhook] Content-Type não reconhecido, tentando fallback");
  const text = await req.text();
  console.log("[greatpages-webhook] Raw text:", text);
  
  try {
    return JSON.parse(text);
  } catch {
    // Tentar como URL encoded
    return Object.fromEntries(new URLSearchParams(text));
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET: Retornar lista de campos suportados (para descoberta do GreatPages)
  if (req.method === "GET") {
    console.log("[greatpages-webhook] Requisição GET - retornando campos suportados");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook GreatPages ativo",
        campos: SUPPORTED_FIELDS.map(f => ({
          nome: f.nome,
          slug: f.slug,
          obrigatorio: f.obrigatorio,
          variantes_aceitas: [f.slug, ...f.variantes],
        })),
        formatos_aceitos: [
          "application/json",
          "application/x-www-form-urlencoded",
          "multipart/form-data",
        ],
        exemplo: {
          nome: "João Silva",
          email: "joao@email.com",
          telefone: "61999998888",
          cidade: "Brasília",
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar tenant_id padrão
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("id")
      .limit(1)
      .single();
    const tenant_id = tenantData?.id;
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum tenant configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Capturar headers relevantes
    const reqHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (!["authorization", "apikey"].includes(key.toLowerCase())) {
        reqHeaders[key] = value;
      }
    });
    const contentType = req.headers.get("content-type") || "";
    const userAgent = req.headers.get("user-agent") || null;

    // Parse payload baseado no Content-Type
    const payload = await parsePayload(req);
    
    console.log("[greatpages-webhook] Payload parseado:", JSON.stringify(payload));
    console.log("[greatpages-webhook] Chaves recebidas:", Object.keys(payload).join(", "));

    // Salvar log bruto do webhook
    const { data: logEntry } = await supabase
      .from("webhook_logs")
      .insert({
        source: "greatpages",
        method: req.method,
        content_type: contentType,
        headers: reqHeaders,
        raw_payload: payload,
        user_agent: userAgent,
        tenant_id,
      })
      .select("id")
      .single();
    const webhookLogId = logEntry?.id;

    // Extrair dados com suporte a variações de campo
    const nome = extractName(payload);
    const email = extractEmail(payload);
    const phone = extractPhone(payload);
    const cityName = extractCity(payload);
    const birthDate = extractBirthDate(payload);
    const utmParams = extractUtmParams(payload);
    const pageUrl = extractPageUrl(payload);
    
    console.log(`[greatpages-webhook] Dados extraídos: nome=${nome}, email=${email}, phone=${phone}, cidade=${cityName}, nascimento=${birthDate}, url=${pageUrl}`);
    
    // Validar campos obrigatórios
    if (!nome) {
      console.error("[greatpages-webhook] Nome é obrigatório. Chaves recebidas:", Object.keys(payload));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nome é obrigatório",
          campos_recebidos: Object.keys(payload),
          dica: "Use um dos campos: nome, name, nome_completo, Nome_Completo"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!phone && !email) {
      console.error("[greatpages-webhook] Telefone ou email é obrigatório");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Telefone ou email é obrigatório",
          campos_recebidos: Object.keys(payload),
          dica: "Use: telefone, phone, whatsapp, celular OU email, e-mail"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalizar telefone
    const telefone_norm = phone ? normalizePhoneE164(phone) : null;
    
    console.log(`[greatpages-webhook] Telefone normalizado: ${telefone_norm}`);

    // Buscar cidade_id se informada
    let cidade_id: string | null = null;
    if (cityName) {
      const { data: cityData } = await supabase
        .from("office_cities")
        .select("id")
        .ilike("nome", `%${cityName}%`)
        .limit(1)
        .maybeSingle();
      
      if (cityData) {
        cidade_id = cityData.id;
        console.log(`[greatpages-webhook] Cidade encontrada: ${cityName} -> ${cidade_id}`);
      }
    }
    
    // Se não encontrou cidade, buscar cidade padrão (primeira ativa)
    if (!cidade_id) {
      const { data: defaultCity } = await supabase
        .from("office_cities")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .single();
      
      if (defaultCity) {
        cidade_id = defaultCity.id;
      } else {
        console.error("[greatpages-webhook] Nenhuma cidade encontrada no sistema");
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma cidade configurada no sistema" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verificar se é líder existente
    let existingLeader = null;
    
    if (telefone_norm) {
      const { data: leaderByPhone } = await supabase
        .from("lideres")
        .select("id, nome_completo, email, telefone, cidade_id")
        .eq("is_active", true)
        .or(`telefone.eq.${telefone_norm},telefone.ilike.%${telefone_norm.slice(-8)}%`)
        .limit(1)
        .maybeSingle();
      
      if (leaderByPhone) {
        existingLeader = leaderByPhone;
      }
    }
    
    if (!existingLeader && email) {
      const { data: leaderByEmail } = await supabase
        .from("lideres")
        .select("id, nome_completo, email, telefone, cidade_id")
        .eq("is_active", true)
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      
      if (leaderByEmail) {
        existingLeader = leaderByEmail;
      }
    }

    // Se é líder existente, atualizar dados faltantes
    if (existingLeader) {
      console.log(`[greatpages-webhook] Líder encontrado: ${existingLeader.nome_completo} (${existingLeader.id})`);
      
      const updateData: Record<string, unknown> = {
        last_activity: new Date().toISOString(),
      };
      
      // Atualizar apenas campos faltantes
      if (!existingLeader.email && email) {
        updateData.email = email;
      }
      if (!existingLeader.telefone && telefone_norm) {
        updateData.telefone = telefone_norm;
      }
      if (!existingLeader.cidade_id && cidade_id) {
        updateData.cidade_id = cidade_id;
      }
      
      await supabase
        .from("lideres")
        .update(updateData)
        .eq("id", existingLeader.id);
      
      console.log(`[greatpages-webhook] Líder atualizado: ${existingLeader.id}`);
      
      // Registrar página acessada para líder (se tiver URL)
      if (pageUrl) {
        await supabase.from("contact_page_views").insert({
          contact_id: existingLeader.id,
          tenant_id,
          page_type: "webhook",
          page_identifier: pageUrl,
          page_name: "Formulário GreatPages",
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_content: utmParams.utm_content || null,
        });
        console.log(`[greatpages-webhook] Page view registrada para líder: ${pageUrl}`);
      }
      
      // Atualizar log do webhook
      if (webhookLogId) {
        await supabase.from("webhook_logs").update({
          response_status: 200,
          processing_result: "leader_updated",
          leader_id: existingLeader.id,
          response_body: { type: "leader_updated", leaderId: existingLeader.id },
        }).eq("id", webhookLogId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: "leader_updated",
          leaderId: existingLeader.id,
          message: `Líder ${existingLeader.nome_completo} atualizado com sucesso`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Não é líder - verificar se contato já existe
    let existingContact = null;
    
    if (telefone_norm) {
      const { data: contactByPhone } = await supabase
        .from("office_contacts")
        .select("id, nome, email, telefone_norm")
        .eq("telefone_norm", telefone_norm)
        .limit(1)
        .maybeSingle();
      
      if (contactByPhone) {
        existingContact = contactByPhone;
      }
    }
    
    if (!existingContact && email) {
      const { data: contactByEmail } = await supabase
        .from("office_contacts")
        .select("id, nome, email, telefone_norm")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      
      if (contactByEmail) {
        existingContact = contactByEmail;
      }
    }

    let contactId: string;

    if (existingContact) {
      // Contato já existe - atualizar dados faltantes
      console.log(`[greatpages-webhook] Contato existente encontrado: ${existingContact.nome} (${existingContact.id})`);
      
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (!existingContact.email && email) {
        updateData.email = email;
      }
      if (!existingContact.telefone_norm && telefone_norm) {
        updateData.telefone_norm = telefone_norm;
      }
      
      await supabase
        .from("office_contacts")
        .update(updateData)
        .eq("id", existingContact.id);
      
      contactId = existingContact.id;
      
      console.log(`[greatpages-webhook] Contato atualizado: ${contactId}`);
      
      // Registrar página acessada para contato existente (se tiver URL)
      if (pageUrl) {
        await supabase.from("contact_page_views").insert({
          contact_id: contactId,
          tenant_id,
          page_type: "webhook",
          page_identifier: pageUrl,
          page_name: "Formulário GreatPages",
          utm_source: utmParams.utm_source || null,
          utm_medium: utmParams.utm_medium || null,
          utm_campaign: utmParams.utm_campaign || null,
          utm_content: utmParams.utm_content || null,
        });
        console.log(`[greatpages-webhook] Page view registrada para contato existente: ${pageUrl}`);
      }
      
      // Atualizar log do webhook
      if (webhookLogId) {
        await supabase.from("webhook_logs").update({
          response_status: 200,
          processing_result: "contact_updated",
          contact_id: contactId,
          response_body: { type: "contact_updated", contactId },
        }).eq("id", webhookLogId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: "contact_updated",
          contactId: contactId,
          message: `Contato ${existingContact.nome} atualizado com sucesso`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar novo contato com source_type='webhook'
    console.log(`[greatpages-webhook] Criando novo contato: ${nome}`);
    
    const { data: newContact, error: insertError } = await supabase
      .from("office_contacts")
      .insert({
        nome,
        email: email || null,
        telefone_norm: telefone_norm!,
        cidade_id,
        data_nascimento: birthDate || null,
        source_type: "webhook",
        source_id: null,
        tenant_id,
        utm_source: utmParams.utm_source || null,
        utm_medium: utmParams.utm_medium || null,
        utm_campaign: utmParams.utm_campaign || null,
        utm_content: utmParams.utm_content || null,
        is_verified: true,
        is_active: true,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[greatpages-webhook] Erro ao criar contato:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    contactId = newContact.id;
    console.log(`[greatpages-webhook] Contato criado: ${contactId}`);

    // Registrar log de atividade
    await supabase
      .from("contact_activity_log")
      .insert({
        contact_id: contactId,
        tenant_id,
        action: "created_from_webhook",
        details: {
          source: "greatpages",
          payload_keys: Object.keys(payload),
          utm_source: utmParams.utm_source,
          utm_campaign: utmParams.utm_campaign,
          page_url: pageUrl,
        },
      });

    // Registrar página acessada para novo contato (se tiver URL)
    if (pageUrl) {
      await supabase.from("contact_page_views").insert({
        contact_id: contactId,
        tenant_id,
        page_type: "webhook",
        page_identifier: pageUrl,
        page_name: "Formulário GreatPages",
        utm_source: utmParams.utm_source || null,
        utm_medium: utmParams.utm_medium || null,
        utm_campaign: utmParams.utm_campaign || null,
        utm_content: utmParams.utm_content || null,
      });
      console.log(`[greatpages-webhook] Page view registrada para novo contato: ${pageUrl}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        type: "contact_created",
        contactId: contactId,
        message: `Contato ${nome} criado com sucesso`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[greatpages-webhook] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || "Erro interno",
        dica: "Verifique se o formato do payload está correto (JSON ou form-urlencoded)"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
