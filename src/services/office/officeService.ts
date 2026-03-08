import { supabase } from "@/integrations/supabase/client";
import type {
  OfficeCity,
  OfficeLeader,
  OfficeContact,
  OfficeVisit,
  OfficeVisitForm,
  OfficeSettings,
  CreateLeaderDTO,
  CreateOfficeVisitDTO,
  SubmitOfficeFormDTO,
  OfficeVisitsFilters,
  OfficeVisitWithForm
} from "@/types/office";

// =====================================================
// UTILITIES
// =====================================================

/**
 * Normaliza telefone brasileiro para formato E.164
 * Entrada: (61) 99999-9999 ou 61999999999
 * Saída: +5561999999999
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  
  // Se já tem código do país, apenas adiciona +
  if (digits.startsWith("55")) {
    return `+${digits}`;
  }
  
  // Adiciona código do país
  return `+55${digits}`;
}

/**
 * Formata telefone E.164 para exibição BR
 * Entrada: +5561999999999
 * Saída: (61) 99999-9999
 */
export function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const ddd = digits.slice(2, 4);
  const firstPart = digits.slice(4, 9);
  const secondPart = digits.slice(9);
  
  return `(${ddd}) ${firstPart}-${secondPart}`;
}

/**
 * Gera um token mock (HMAC/JWT simulado)
 * Em produção, usar biblioteca JWT real
 */
export function generateMockToken(visitId: string, userId: string, leaderId: string): string {
  const payload = {
    visit_id: visitId,
    user_id: userId,
    leader_id: leaderId,
    exp: Date.now() + 2 * 60 * 60 * 1000 // 2h
  };
  
  return btoa(JSON.stringify(payload));
}

/**
 * Valida token mock
 */
export function validateMockToken(token: string): { valid: boolean; payload?: any } {
  try {
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Date.now()) {
      return { valid: false };
    }
    
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

// =====================================================
// CITIES
// =====================================================

export async function getCities() {
  const { data, error } = await supabase
    .from("office_cities")
    .select("*")
    .eq("status", "active")
    .order("nome");
  
  if (error) throw error;
  return data as OfficeCity[];
}

export async function getCityById(id: string) {
  const { data, error } = await supabase
    .from("office_cities")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error) throw error;
  return data as OfficeCity;
}

// =====================================================
// LEADERS
// =====================================================

export async function createLeader(dto: CreateLeaderDTO): Promise<OfficeLeader> {
  // Gerar código de verificação permanente (6 caracteres alfanuméricos maiúsculos)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const verificationCode = Array(6)
    .fill(0)
    .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join("");
  
  // Gerar affiliate_token (8 caracteres)
  const affiliateToken = crypto.randomUUID().split('-')[0];
  
  const { data, error } = await supabase
    .from('lideres')
    .insert({
      nome_completo: dto.nome_completo,
      email: dto.email,
      telefone: dto.telefone,
      cidade_id: dto.cidade_id || null,
      localidade: dto.localidade || null,
      instagram_username: dto.instagram_username || null,
      data_nascimento: dto.data_nascimento || null,
      observacao: dto.observacao || null,
      is_active: dto.is_active,
      status: 'active',
      cadastros: 0,
      pontuacao_total: 0,
      is_verified: false,
      verification_code: verificationCode,
      affiliate_token: affiliateToken,
    })
    .select(`
      *,
      cidade:office_cities(*)
    `)
    .single();

  if (error) throw error;
  return data as OfficeLeader;
}

export interface GetLeadersResult {
  data: OfficeLeader[];
  count: number;
}

export async function getLeaders(filters?: { 
  cidade_id?: string; 
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  verificationFilter?: 'all' | 'verified' | 'not_verified';
}): Promise<GetLeadersResult> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("lideres")
    .select("*, cidade:office_cities(*), passkit_member_id, passkit_pass_installed, passkit_installed_at", { count: 'exact' })
    .eq("is_active", true);
  
  if (filters?.cidade_id) {
    query = query.eq("cidade_id", filters.cidade_id);
  }
  
  // Filtro de verificação
  if (filters?.verificationFilter === 'verified') {
    query = query.eq('is_verified', true);
  } else if (filters?.verificationFilter === 'not_verified') {
    query = query.eq('is_verified', false);
  }
  
  if (filters?.search) {
    const searchDigits = filters.search.replace(/\D/g, '');
    
    if (searchDigits.length >= 4) {
      query = query.or(`nome_completo.ilike.%${filters.search}%,telefone.ilike.%${searchDigits}%`);
    } else {
      query = query.ilike("nome_completo", `%${filters.search}%`);
    }
  }
  
  // Caso especial: ordenação por próximo aniversário usa RPC
  if (filters?.sortBy === "aniversario_proximo") {
    const { data, error } = await supabase.rpc("get_leaders_by_birthday", {
      _page: page,
      _page_size: pageSize,
      _cidade_id: filters?.cidade_id || null,
      _search: filters?.search || null,
      _verification_filter: filters?.verificationFilter || 'all'
    });

    if (error) throw error;

    // O total_count está em cada linha, pegamos da primeira
    const totalCount = data && data.length > 0 ? Number(data[0].total_count) : 0;

    // Buscar os dados das cidades para cada líder
    const leadersWithCities = await Promise.all(
      (data || []).map(async (leader: any) => {
        if (leader.cidade_id) {
          const { data: cidade } = await supabase
            .from("office_cities")
            .select("*")
            .eq("id", leader.cidade_id)
            .single();
          return { ...leader, cidade } as OfficeLeader;
        }
        return leader as OfficeLeader;
      })
    );

    return { data: leadersWithCities, count: totalCount };
  }

  // Ordenação padrão no backend
  switch (filters?.sortBy) {
    case "cadastros_desc":
      query = query.order("cadastros", { ascending: false });
      break;
    case "cadastros_asc":
      query = query.order("cadastros", { ascending: true });
      break;
    case "pontos_desc":
      query = query.order("pontuacao_total", { ascending: false });
      break;
    case "pontos_asc":
      query = query.order("pontuacao_total", { ascending: true });
      break;
    case "nome_asc":
    default:
      query = query.order("nome_completo", { ascending: true });
      break;
  }
  
  // Aplicar paginação
  query = query.range(from, to);
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  return { data: data as OfficeLeader[], count: count || 0 };
}

export async function getLeadersByCity(cityId: string) {
  return getLeaders({ cidade_id: cityId });
}

// =====================================================
// CONTACTS
// =====================================================

export async function findContactByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  
  const { data, error } = await supabase
    .from("office_contacts")
    .select("*, cidade:office_cities(*)")
    .eq("telefone_norm", normalized)
    .maybeSingle();
  
  if (error) throw error;
  return data as OfficeContact | null;
}

/**
 * Atualiza detalhes de um contato
 */
export async function updateContactDetails(
  contactId: string,
  details: {
    endereco?: string;
    data_nascimento?: string; // YYYY-MM-DD
    instagram?: string;
    facebook?: string;
  }
): Promise<OfficeContact> {
  const { data, error } = await supabase
    .from("office_contacts")
    .update(details)
    .eq("id", contactId)
    .select("*, cidade:office_cities(*)")
    .single();
  
  if (error) throw error;
  return data as OfficeContact;
}

/**
 * Buscar líder por affiliate_token (público)
 */
export async function getLeaderByAffiliateToken(token: string): Promise<OfficeLeader | null> {
  const { data, error } = await supabase
    .from("lideres")
    .select("id, nome_completo, cidade_id, cidade:office_cities(*)")
    .eq("affiliate_token", token)
    .eq("is_active", true)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching leader by token:", error);
    return null;
  }
  
  return data as OfficeLeader;
}

export async function createOrUpdateContact(
  nome: string,
  telefone: string,
  cidade_id: string,
  source_type?: string,
  source_id?: string
): Promise<OfficeContact> {
  const telefone_norm = normalizePhone(telefone);
  
  const existing = await findContactByPhone(telefone);
  
  if (existing) {
    // Atualizar nome e cidade, mas só sobrescrever source se contato não tinha antes
    const updateData: any = { nome, cidade_id };
    if (source_type && !existing.source_type) {
      updateData.source_type = source_type;
      updateData.source_id = source_id;
    }
    
    const { data, error } = await supabase
      .from("office_contacts")
      .update(updateData)
      .eq("id", existing.id)
      .select("*, cidade:office_cities(*)")
      .single();
    
    if (error) throw error;
    return data as OfficeContact;
  }
  
  const { data, error } = await supabase
    .from("office_contacts")
    .insert({ 
      nome, 
      telefone_norm, 
      cidade_id,
      source_type: source_type || null,
      source_id: source_id || null
    })
    .select("*, cidade:office_cities(*)")
    .single();
  
  if (error) throw error;
  return data as OfficeContact;
}

// =====================================================
// VISITS
// =====================================================

export async function getVisits(filters?: OfficeVisitsFilters) {
  let query = supabase
    .from("office_visits")
    .select(`
      *,
      contact:office_contacts(*),
      leader:lideres(*),
      city:office_cities(*),
      form:office_visit_forms(*, tema:temas(*))
    `);
  
  if (filters?.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }
  
  if (filters?.cidade_id) {
    query = query.eq("city_id", filters.cidade_id);
  }
  
  if (filters?.leader_id) {
    query = query.eq("leader_id", filters.leader_id);
  }
  
  if (filters?.search) {
    // Busca por protocolo
    query = query.ilike("protocolo", `%${filters.search}%`);
  }
  
  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from);
  }
  
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to);
  }
  
  query = query.order("created_at", { ascending: false });
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as OfficeVisit[];
}

export async function getVisitById(id: string) {
  const { data, error } = await supabase
    .from("office_visits")
    .select(`
      *,
      contact:office_contacts(*),
      leader:lideres(*),
      city:office_cities(*)
    `)
    .eq("id", id)
    .single();
  
  if (error) throw error;
  return data as OfficeVisit;
}

export async function getVisitByProtocol(protocolo: string) {
  const { data, error } = await supabase
    .from("office_visits")
    .select(`
      *,
      contact:office_contacts(*),
      leader:lideres(*),
      city:office_cities(*)
    `)
    .eq("protocolo", protocolo)
    .maybeSingle();
  
  if (error) throw error;
  return data as OfficeVisit | null;
}

export async function createVisit(dto: CreateOfficeVisitDTO, userId: string) {
  // Primeiro criar o protocolo
  const { data: protocolData, error: protocolError } = await supabase
    .rpc("generate_office_protocol", { _prefix: "RP-GB" });
  
  if (protocolError) throw protocolError;
  const protocolo = protocolData as string;
  
  // Criar contato com source_type='visita' (source_id será atualizado após criar a visita)
  const contact = await createOrUpdateContact(
    dto.nome,
    dto.whatsapp,
    dto.cidade_id,
    'visita',
    null // será atualizado depois
  );
  
  const token = generateMockToken("pending", contact.id, dto.leader_id);
  const token_expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  
  const { data: visit, error } = await supabase
    .from("office_visits")
    .insert({
      protocolo,
      contact_id: contact.id,
      leader_id: dto.leader_id,
      city_id: dto.cidade_id,
      status: "REGISTERED",
      token,
      token_expires_at,
      created_by: userId
    })
    .select(`
      *,
      contact:office_contacts(*),
      leader:lideres(*),
      city:office_cities(*)
    `)
    .single();
  
  if (error) throw error;
  
  // Atualizar source_id do contato com o ID da visita (se o contato foi criado como 'visita')
  if (contact.source_type === 'visita' || !contact.source_type) {
    await supabase
      .from("office_contacts")
      .update({ source_id: visit.id, source_type: 'visita' })
      .eq("id", contact.id);
  }
  
  return visit as OfficeVisit;
}

export async function updateVisitStatus(id: string, status: OfficeVisit["status"]) {
  const { data, error } = await supabase
    .from("office_visits")
    .update({ status })
    .eq("id", id)
    .select(`
      *,
      contact:office_contacts(*),
      leader:lideres(*),
      city:office_cities(*)
    `)
    .single();
  
  if (error) throw error;
  return data as OfficeVisit;
}

// =====================================================
// VISIT FORMS
// =====================================================

export async function submitForm(dto: SubmitOfficeFormDTO) {
  // Converter data de DD/MM/YYYY para YYYY-MM-DD
  const [day, month, year] = dto.data_nascimento.split("/");
  const data_nascimento = `${year}-${month}-${day}`;
  
  const { data, error } = await supabase
    .from("office_visit_forms")
    .upsert({
      visit_id: dto.visit_id,
      endereco: dto.endereco,
      data_nascimento,
      aceita_reuniao: dto.aceita_reuniao,
      continua_projeto: dto.continua_projeto,
      instagram: dto.instagram,
      facebook: dto.facebook,
      observacoes: dto.observacoes,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'visit_id',
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Atualizar status da visita
  await updateVisitStatus(dto.visit_id, "FORM_SUBMITTED");
  
  return data as OfficeVisitForm;
}

export async function getVisitWithForm(visitId: string) {
  const visit = await getVisitById(visitId);
  
  const { data: form } = await supabase
    .from("office_visit_forms")
    .select("*")
    .eq("visit_id", visitId)
    .maybeSingle();
  
  return {
    ...visit,
    form: form || undefined
  } as OfficeVisitWithForm;
}

// =====================================================
// SETTINGS
// =====================================================

export async function getSettings() {
  const { data, error } = await supabase
    .from("office_settings")
    .select("*")
    .maybeSingle();
  
  if (error) throw error;
  
  if (!data) {
    const { data: newSettings, error: createError } = await supabase
      .from("office_settings")
      .insert({
        protocolo_prefix: "RP-GB",
        pontos_form_submitted: 1,
        pontos_aceita_reuniao: 3,
        webhook_url: "https://webhook.escaladigital.ai/webhook/gabinete/envio-formulario"
      })
      .select()
      .single();
    
    if (createError) throw createError;
    return newSettings as OfficeSettings;
  }
  
  return data as OfficeSettings;
}

export async function updateSettings(updates: Partial<OfficeSettings>) {
  const { data: existing } = await supabase
    .from("office_settings")
    .select("id")
    .maybeSingle();

  if (!existing) throw new Error("Settings not found");

  const { data, error } = await supabase
    .from("office_settings")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .single();
  
  if (error) throw error;
  return data as OfficeSettings;
}
