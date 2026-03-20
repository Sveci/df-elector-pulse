import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  leaderId?: string;
  leaderIds?: string[];
  message: string;
}

interface PassKitResponse {
  success: boolean;
  leaderId: string;
  leaderName: string;
  error?: string;
}

interface PassKitMember {
  id: string;
  externalId?: string;
  programId?: string;
  tierId?: string;
  points?: number | string;
  secondaryPoints?: number | string;
  metaData?: Record<string, unknown>;
  passOverrides?: Record<string, unknown>;
  person?: {
    mobileNumber?: string;
    emailAddress?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Normaliza telefone para apenas dígitos
 */
function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

/**
 * Compara telefones de forma flexível
 * Tenta match com e sem código do país (55)
 */
function phoneMatches(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const p1 = normalizePhone(phone1);
  const p2 = normalizePhone(phone2);

  if (!p1 || !p2) return false;
  if (p1 === p2) return true;

  // Tentar sem código do país (55)
  const p1Without55 = p1.startsWith("55") ? p1.slice(2) : p1;
  const p2Without55 = p2.startsWith("55") ? p2.slice(2) : p2;

  return p1Without55 === p2Without55;
}

/**
 * Normaliza e faz parse de JSON que pode estar "escapado" ou duplamente codificado
 */
function normalizeJsonString(text: string): unknown {
  // Primeira tentativa: parse direto
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Se falhar parse direto, tentar des-escapar primeiro
    try {
      // Detectar se é string escapada tipo: "{\"result\":...}"
      // Remove escapes de aspas e tenta novamente
      const unescaped = text
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
      data = JSON.parse(unescaped);
    } catch {
      return text; // Retorna como string se tudo falhar
    }
  }

  // Se data ainda for string, tentar parse novamente (JSON duplamente codificado)
  let attempts = 0;
  while (typeof data === 'string' && attempts < 3) {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        // Tentar parse direto
        data = JSON.parse(trimmed);
        attempts++;
        continue;
      } catch {
        // Se falhar, tentar des-escapar
        try {
          const unescaped = trimmed
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r');
          data = JSON.parse(unescaped);
          attempts++;
          continue;
        } catch {
          break;
        }
      }
    } else {
      break;
    }
  }

  return data;
}

async function passkitRequest(
  method: string,
  path: string,
  apiToken: string,
  baseUrl: string,
  body?: unknown
): Promise<{ data?: unknown; error?: string; status: number }> {
  try {
    const url = `${baseUrl}${path}`;

    console.log(`PassKit ${method} request to: ${url}`);
    if (body) {
      console.log(`Request payload:`, JSON.stringify(body, null, 2));
    }

    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const status = response.status;

    console.log(`Response status: ${status}`);

    let data: unknown = null;
    const text = await response.text();

    if (text) {
      // Usar função de normalização robusta
      data = normalizeJsonString(text);

      if (typeof data === 'object' && data !== null) {
        console.log(`[passkitRequest] Resposta parseada com sucesso como objeto`);
      } else if (typeof data === 'string') {
        console.log(`[passkitRequest] ATENÇÃO: Resposta ainda é string após normalização`);
      }
    }

    if (!response.ok) {
      console.error(`PassKit error (${status}):`, data);
      return { error: typeof data === "string" ? data : JSON.stringify(data), status };
    }

    return { data, status };
  } catch (error: unknown) {
    console.error("PassKit request error:", error);
    return { error: error instanceof Error ? error.message : String(error), status: 500 };
  }
}

/**
 * Verifica se um membro está invalidado baseado em seu status
 */
function isMemberInvalidated(member: Record<string, unknown>): boolean {
  const status = member.universalStatus ||
                 member.status ||
                 (member.recordData as Record<string, unknown>)?.["universal.status"];
  return status === "PASS_INVALIDATED" || status === "3" || status === 3;
}

/**
 * Extrai lista de membros de várias estruturas possíveis de resposta da API
 */
function extractMembersList(payload: unknown): Record<string, unknown>[] {
  // Se já é array, retornar diretamente
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }

  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  const obj = payload as Record<string, unknown>;

  // Tentar propriedades conhecidas que podem conter array
  const arrayProps = ['results', 'data', 'members', 'passes'];
  for (const prop of arrayProps) {
    if (Array.isArray(obj[prop])) {
      return obj[prop] as Record<string, unknown>[];
    }
  }

  // Caso especial: "result" pode ser um OBJETO ÚNICO (não array)
  // Converter para array de 1 elemento
  if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) {
    const singleResult = obj.result as Record<string, unknown>;
    // Verificar se parece um membro (tem id ou externalId)
    if (singleResult.id || singleResult.externalId) {
      console.log(`[extractMembersList] Detectado "result" como objeto único, convertendo para array`);
      return [singleResult];
    }
  }

  // Se result for array, usar
  if (Array.isArray(obj.result)) {
    return obj.result as Record<string, unknown>[];
  }

  return [];
}

/**
 * Resolve o membro no PassKit usando múltiplas estratégias:
 * 1) GET /members/member/{id} (se temos passkit_member_id local)
 * 2) GET /members/member/external/{programId}/{externalId}
 * 3) POST /members/member/list/{programId} com filtro por memberId
 * 4) POST /members/member/list/{programId} com filtro por email
 * 5) POST /members/member/list/{programId} com filtro por telefone
 * 6) POST /members/member/list/{programId} sem filtros + filtro local por telefone e externalId
 *
 * IMPORTANTE: Ignora membros invalidados e continua buscando alternativas válidas
 */
// deno-lint-ignore no-explicit-any
type SupabaseClientAny = ReturnType<typeof createClient>;

async function resolveMember(
  leaderId: string,
  localMemberId: string | null,
  programId: string,
  apiToken: string,
  baseUrl: string,
  leaderEmail?: string | null,
  leaderPhone?: string | null,
  supabaseClient?: SupabaseClientAny
): Promise<{ member: PassKitMember | null; error?: string }> {

  const leaderPhoneNorm = normalizePhone(leaderPhone);
  console.log(`[resolveMember] Iniciando busca para leaderId: ${leaderId}, phone normalizado: ${leaderPhoneNorm ? leaderPhoneNorm.slice(0, 4) + '***' + leaderPhoneNorm.slice(-2) : 'N/A'}`);

  // Helper para auto-corrigir passkit_member_id quando encontrar por outra estratégia
  const autoCorrectMemberId = async (memberId: string) => {
    if (supabaseClient && memberId !== localMemberId) {
      console.log(`[resolveMember] Auto-corrigindo passkit_member_id no banco: ${localMemberId} -> ${memberId}`);
      // deno-lint-ignore no-explicit-any
      await (supabaseClient as any)
        .from("lideres")
        .update({ passkit_member_id: memberId })
        .eq("id", leaderId);
    }
  };

  // Estratégia 1: Tentar GET direto pelo passkit_member_id local
  if (localMemberId) {
    console.log(`[resolveMember] Tentativa 1: GET /members/member/${localMemberId}`);
    const directResult = await passkitRequest(
      "GET",
      `/members/member/${localMemberId}`,
      apiToken,
      baseUrl
    );

    if (directResult.status === 200 && directResult.data) {
      const member = directResult.data as Record<string, unknown>;
      if (isMemberInvalidated(member)) {
        console.log(`[resolveMember] Membro ${localMemberId} encontrado mas está INVALIDADO - continuando busca`);
      } else {
        console.log(`[resolveMember] Encontrado via GET direto por ID (válido)`);
        return { member: member as PassKitMember };
      }
    } else {
      console.log(`[resolveMember] GET direto retornou status ${directResult.status}`);
    }
  }

  // Estratégia 2: GET /members/member/external/{programId}/{externalId}
  console.log(`[resolveMember] Tentativa 2: GET /members/member/external/${programId}/${leaderId}`);
  const externalResult = await passkitRequest(
    "GET",
    `/members/member/external/${programId}/${leaderId}`,
    apiToken,
    baseUrl
  );

  if (externalResult.status === 200 && externalResult.data) {
    const member = externalResult.data as Record<string, unknown>;
    if (isMemberInvalidated(member)) {
      console.log(`[resolveMember] Membro encontrado via external mas está INVALIDADO - continuando busca`);
    } else {
      console.log(`[resolveMember] Encontrado via GET external (válido)`);
      await autoCorrectMemberId(member.id as string);
      return { member: member as PassKitMember };
    }
  } else {
    console.log(`[resolveMember] GET external retornou status ${externalResult.status}`);
  }

  // Estratégia 3: POST /members/member/list/{programId} com filtros por memberId
  console.log(`[resolveMember] Tentativa 3: POST /members/member/list/${programId} (filtro por memberId)`);
  const listResult = await passkitRequest(
    "POST",
    `/members/member/list/${programId}`,
    apiToken,
    baseUrl,
    {
      filters: {
        filterGroups: [
          {
            condition: "AND",
            fieldFilters: [
              {
                filterField: "memberId",
                filterValue: leaderId,
                filterOperator: "eq",
              },
            ],
          },
        ],
      },
      page: 0,
      pageSize: 20,
    }
  );

  if (listResult.status === 200 && listResult.data) {
    const results = extractMembersList(listResult.data);

    if (results.length > 0) {
      const validMember = results.find(m => !isMemberInvalidated(m));
      if (validMember?.id) {
        console.log(`[resolveMember] Encontrado via list por memberId (válido): ${validMember.id}`);
        await autoCorrectMemberId(validMember.id as string);
        return { member: validMember as PassKitMember };
      }
      console.log(`[resolveMember] Encontrou ${results.length} membros por memberId, mas todos invalidados`);
    }
  }

  // Estratégia 4: Buscar por email do líder
  if (leaderEmail) {
    console.log(`[resolveMember] Tentativa 4: POST /members/member/list/${programId} (filtro por email: ${leaderEmail})`);
    const listByEmailResult = await passkitRequest(
      "POST",
      `/members/member/list/${programId}`,
      apiToken,
      baseUrl,
      {
        filters: {
          filterGroups: [
            {
              condition: "AND",
              fieldFilters: [
                {
                  filterField: "person.emailAddress",
                  filterValue: leaderEmail,
                  filterOperator: "eq",
                },
              ],
            },
          ],
        },
        page: 0,
        pageSize: 20,
      }
    );

    if (listByEmailResult.status === 200 && listByEmailResult.data) {
      const results = extractMembersList(listByEmailResult.data);

      if (results.length > 0) {
        console.log(`[resolveMember] Encontrou ${results.length} membros por email`);
        const matchingMembers = results.filter(m => {
          const extId = String(m.externalId || "");
          return extId === leaderId || extId.startsWith(`${leaderId}_`);
        });

        const validMembers = matchingMembers.filter(m => !isMemberInvalidated(m));

        if (validMembers.length > 0) {
          validMembers.sort((a, b) => {
            const extA = String(a.externalId || "");
            const extB = String(b.externalId || "");
            return extB.localeCompare(extA);
          });

          const bestMember = validMembers[0];
          console.log(`[resolveMember] Encontrado via email (válido, mais recente): ${bestMember.id} (externalId: ${bestMember.externalId})`);
          await autoCorrectMemberId(bestMember.id as string);
          return { member: bestMember as PassKitMember };
        }
        console.log(`[resolveMember] Membros encontrados por email não correspondem ao líder ou estão invalidados`);
      }
    } else {
      console.log(`[resolveMember] Busca por email retornou status ${listByEmailResult.status}`);
    }
  }

  // Estratégia 5: Buscar por telefone (person.mobileNumber)
  if (leaderPhoneNorm) {
    // Tentar diferentes formatos de telefone
    const phoneFormats = [
      leaderPhoneNorm,  // Apenas dígitos
      `+${leaderPhoneNorm}`,  // Com +
      leaderPhoneNorm.startsWith("55") ? leaderPhoneNorm.slice(2) : `55${leaderPhoneNorm}`,  // Com/sem 55
    ];

    for (const phoneFormat of phoneFormats) {
      console.log(`[resolveMember] Tentativa 5: POST /members/member/list/${programId} (filtro por telefone: ${phoneFormat.slice(0, 4)}***)`);
      const listByPhoneResult = await passkitRequest(
        "POST",
        `/members/member/list/${programId}`,
        apiToken,
        baseUrl,
        {
          filters: {
            filterGroups: [
              {
                condition: "AND",
                fieldFilters: [
                  {
                    filterField: "person.mobileNumber",
                    filterValue: phoneFormat,
                    filterOperator: "eq",
                  },
                ],
              },
            ],
          },
          page: 0,
          pageSize: 20,
        }
      );

      if (listByPhoneResult.status === 200 && listByPhoneResult.data) {
        const results = extractMembersList(listByPhoneResult.data);

        if (results.length > 0) {
          console.log(`[resolveMember] Encontrou ${results.length} membros por telefone (formato: ${phoneFormat.slice(0, 4)}***)`);
          const validMembers = results.filter(m => !isMemberInvalidated(m));

          if (validMembers.length > 0) {
            validMembers.sort((a, b) => {
              const extA = String(a.externalId || "");
              const extB = String(b.externalId || "");
              return extB.localeCompare(extA);
            });

            const bestMember = validMembers[0];
            console.log(`[resolveMember] Encontrado via telefone (válido, mais recente): ${bestMember.id}`);
            await autoCorrectMemberId(bestMember.id as string);
            return { member: bestMember as PassKitMember };
          }
          console.log(`[resolveMember] Membros encontrados por telefone estão todos invalidados`);
        }
      }
    }
  }

  // Estratégia 6: Listar membros com paginação e filtrar localmente por telefone/externalId
  console.log(`[resolveMember] Tentativa 6: Listar membros com paginação e filtrar localmente`);

  const allMembers: Record<string, unknown>[] = [];
  const maxPages = 5;  // Até 500 membros (5 páginas x 100)

  for (let page = 0; page < maxPages; page++) {
    const listAllResult = await passkitRequest(
      "POST",
      `/members/member/list/${programId}`,
      apiToken,
      baseUrl,
      {
        page,
        pageSize: 100,
      }
    );

    if (listAllResult.status !== 200 || !listAllResult.data) {
      console.log(`[resolveMember] Listagem página ${page} retornou status ${listAllResult.status}`);
      break;
    }

    const pageMembers = extractMembersList(listAllResult.data);
    console.log(`[resolveMember] Página ${page}: ${pageMembers.length} membros`);

    if (pageMembers.length === 0) {
      break;  // Não há mais membros
    }

    allMembers.push(...pageMembers);

    // Tentar encontrar match por telefone nesta página
    if (leaderPhoneNorm) {
      const phoneMatching = pageMembers.filter(m => {
        const memberPhone = (m.person as Record<string, unknown>)?.mobileNumber as string;
        return phoneMatches(memberPhone, leaderPhoneNorm);
      });

      if (phoneMatching.length > 0) {
        console.log(`[resolveMember] Encontrou ${phoneMatching.length} membros com telefone correspondente na página ${page}`);
        const validPhoneMembers = phoneMatching.filter(m => !isMemberInvalidated(m));

        if (validPhoneMembers.length > 0) {
          validPhoneMembers.sort((a, b) => {
            const extA = String(a.externalId || "");
            const extB = String(b.externalId || "");
            return extB.localeCompare(extA);
          });

          const bestMember = validPhoneMembers[0];
          console.log(`[resolveMember] Encontrado via filtro local por telefone (válido): ${bestMember.id}`);
          await autoCorrectMemberId(bestMember.id as string);
          return { member: bestMember as PassKitMember };
        }
      }
    }

    // Tentar encontrar match por externalId nesta página
    const extIdMatching = pageMembers.filter(m => {
      const extId = String(m.externalId || "");
      return extId === leaderId || extId.startsWith(`${leaderId}_`);
    });

    if (extIdMatching.length > 0) {
      console.log(`[resolveMember] Encontrou ${extIdMatching.length} membros com externalId correspondente na página ${page}`);
      const validExtIdMembers = extIdMatching.filter(m => !isMemberInvalidated(m));

      if (validExtIdMembers.length > 0) {
        validExtIdMembers.sort((a, b) => {
          const extA = String(a.externalId || "");
          const extB = String(b.externalId || "");
          return extB.localeCompare(extA);
        });

        const bestMember = validExtIdMembers[0];
        console.log(`[resolveMember] Encontrado via filtro local por externalId (válido): ${bestMember.id}`);
        await autoCorrectMemberId(bestMember.id as string);
        return { member: bestMember as PassKitMember };
      }
    }

    if (pageMembers.length < 100) {
      break;  // Última página (menos de 100 resultados)
    }
  }

  // Log de diagnóstico final
  console.log(`[resolveMember] Total de membros verificados: ${allMembers.length}`);
  if (allMembers.length > 0) {
    const samplePhones = allMembers.slice(0, 5).map(m => {
      const phone = (m.person as Record<string, unknown>)?.mobileNumber as string;
      return phone ? phone.slice(0, 4) + "***" : "N/A";
    });
    const sampleExtIds = allMembers.slice(0, 5).map(m => m.externalId || "N/A");
    console.log(`[resolveMember] Amostra de telefones: ${samplePhones.join(", ")}`);
    console.log(`[resolveMember] Amostra de externalIds: ${sampleExtIds.join(", ")}`);
  }

  console.log(`[resolveMember] Membro válido não encontrado por nenhuma estratégia`);
  return { member: null, error: "Membro válido não encontrado no PassKit (pode haver apenas membros invalidados)" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require valid JWT ────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ── End Auth ──────────────────────────────────────────────────────

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { leaderId, leaderIds, message }: NotificationRequest = await req.json();

    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedMessage = message.trim().substring(0, 150);

    let idsToProcess: string[] = [];
    if (leaderId) {
      idsToProcess = [leaderId];
    } else if (leaderIds && leaderIds.length > 0) {
      idsToProcess = leaderIds;
    } else {
      return new Response(
        JSON.stringify({ error: "É necessário fornecer leaderId ou leaderIds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Enviando notificação para ${idsToProcess.length} líder(es)`);

    const { data: settings, error: settingsError } = await supabase
      .from("integrations_settings")
      .select("passkit_enabled, passkit_api_token, passkit_program_id, passkit_tier_id, passkit_api_base_url")
      .single();

    if (settingsError || !settings) {
      console.error("Erro ao buscar configurações:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configurações de integração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.passkit_enabled) {
      return new Response(
        JSON.stringify({ error: "Integração PassKit não está habilitada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.passkit_api_token || !settings.passkit_program_id || !settings.passkit_tier_id) {
      return new Response(
        JSON.stringify({ error: "Configurações do PassKit incompletas (token, program_id ou tier_id)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passkitBaseUrl = settings.passkit_api_base_url || "https://api.pub1.passkit.io";
    console.log(`Usando PassKit API URL: ${passkitBaseUrl}`);

    const { data: leaders, error: leadersError } = await supabase
      .from("lideres")
      .select("id, nome_completo, telefone, email, pontuacao_total, cadastros, passkit_member_id, passkit_pass_installed")
      .in("id", idsToProcess)
      .eq("is_active", true);

    if (leadersError) {
      console.error("Erro ao buscar líderes:", leadersError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar líderes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!leaders || leaders.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum líder ativo encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: PassKitResponse[] = [];
    const now = new Date().toISOString();

    for (const leader of leaders) {
      try {
        console.log(`\n========== Processando: ${leader.nome_completo} (${leader.id}) ==========`);

        // Usar a função robusta de resolução de membro (passando email E telefone para buscas alternativas)
        // deno-lint-ignore no-explicit-any
        const { member, error: resolveError } = await resolveMember(
          leader.id,
          leader.passkit_member_id,
          settings.passkit_program_id!,
          settings.passkit_api_token!,
          passkitBaseUrl,
          leader.email,
          leader.telefone,  // NOVO: passar telefone para busca
          supabase as any  // NOVO: passar supabase para auto-correção de member_id
        );

        if (!member || !member.id) {
          console.log(`Membro não encontrado para ${leader.nome_completo}: ${resolveError}`);
          results.push({
            success: false,
            leaderId: leader.id,
            leaderName: leader.nome_completo,
            error: resolveError || "Membro não encontrado no PassKit"
          });
          continue;
        }

        const memberId = member.id;
        console.log(`Membro resolvido: ${memberId}`);

        // Verificar status do membro - pode estar em diferentes propriedades
        const memberStatus = (member as Record<string, unknown>).universalStatus ||
                             (member as Record<string, unknown>).status ||
                             ((member as Record<string, unknown>).recordData as Record<string, unknown>)?.["universal.status"];

        console.log(`Status do membro: ${memberStatus}`);

        // Verificar se está invalidado (status 3 ou PASS_INVALIDATED)
        if (memberStatus === "PASS_INVALIDATED" || memberStatus === "3" || memberStatus === 3) {
          console.log(`Membro ${memberId} está INVALIDADO - limpando apenas cache do member_id`);

          await supabase
            .from("lideres")
            .update({
              passkit_member_id: null,
            })
            .eq("id", leader.id);

          results.push({
            success: false,
            leaderId: leader.id,
            leaderName: leader.nome_completo,
            error: "O membro encontrado estava invalidado. Tente novamente ou gere um novo cartão.",
          });
          continue;
        }

        // Atualizar passkit_member_id no banco se diferente (já feito no auto-correct, mas manter para redundância)
        if (memberId !== leader.passkit_member_id) {
          console.log(`Atualizando passkit_member_id no banco: ${leader.passkit_member_id} -> ${memberId}`);
          await supabase
            .from("lideres")
            .update({ passkit_member_id: memberId })
            .eq("id", leader.id);
        }

        // Preparar dados para atualização
        const existingMetaData = (member.metaData as Record<string, unknown>) || {};
        const existingPassOverrides = (member.passOverrides as Record<string, unknown>) || {};

        // Parse points corretamente
        const currentPoints = parseFloat(String(member.points || leader.pontuacao_total || 0)) || 0;
        const currentSecondaryPoints = parseFloat(String(member.secondaryPoints || leader.cadastros || 0)) || 0;

        console.log(`Points atuais: ${currentPoints}, SecondaryPoints: ${currentSecondaryPoints}`);

        // Para disparar push notification
        const notificationValue = trimmedMessage;
        const notificationTimestamp = Date.now();

        console.log(`[Push Trigger] Campo meta.notification será: "${notificationValue}"`);
        console.log(`[Push Trigger] Campo notificationTime para unicidade: ${notificationTimestamp}`);

        const nextNotificationCount = (parseFloat(String(existingMetaData.notificationCount || 0)) || 0) + 1;

        const updateData = {
          id: memberId,
          programId: settings.passkit_program_id,
          tierId: settings.passkit_tier_id,
          points: currentPoints,
          secondaryPoints: currentSecondaryPoints,
          metaData: {
            ...existingMetaData,
            notification: notificationValue,
            notificationTime: String(notificationTimestamp),
            lastMessage: trimmedMessage,
            lastMessageDate: now,
            notificationCount: String(nextNotificationCount),
          },
          passOverrides: existingPassOverrides
        };

        console.log(`Atualizando membro via PUT /members/member...`);

        const updateResult = await passkitRequest(
          "PUT",
          "/members/member",
          settings.passkit_api_token!,
          passkitBaseUrl,
          updateData
        );

        if (updateResult.error) {
          console.error(`PUT falhou:`, updateResult.error);

          if (updateResult.error.includes("cannot update invalided member") ||
              updateResult.error.includes("invalidated") ||
              updateResult.error.includes("invalid member")) {

            console.log(`Erro de membro invalidado detectado para ${memberId}`);

            await supabase
              .from("lideres")
              .update({
                passkit_member_id: null,
              })
              .eq("id", leader.id);

            results.push({
              success: false,
              leaderId: leader.id,
              leaderName: leader.nome_completo,
              error: "O membro encontrado estava invalidado. Tente novamente ou gere um novo cartão.",
            });
            continue;
          }

          results.push({
            success: false,
            leaderId: leader.id,
            leaderName: leader.nome_completo,
            error: `PUT falhou: ${updateResult.error}`
          });
          continue;
        }

        console.log(`PUT funcionou para ${leader.nome_completo} (status: ${updateResult.status})`);
        console.log(`✅ Push notification disparado via meta.notification = "${notificationValue}"`);
        results.push({
          success: true,
          leaderId: leader.id,
          leaderName: leader.nome_completo
        });

      } catch (error: unknown) {
        console.error(`Erro ao processar líder ${leader.id}:`, error);
        results.push({
          success: false,
          leaderId: leader.id,
          leaderName: leader.nome_completo,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n========== Resumo: ${successCount} sucesso, ${failCount} falha ==========`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        },
        results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
