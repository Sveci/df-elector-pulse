import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeaderPassRequest {
  leaderId: string;
}

type PassKitTier = {
  id: string;
  programId?: string;
  name?: string;
};

async function passkitJson(
  baseUrl: string,
  token: string,
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; text: string; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { ok: res.ok, status: res.status, text, json };
}

async function listMemberTiers(baseUrl: string, token: string, programId: string) {
  // PassKit pode variar o formato do payload por cluster/versão.
  // Tentamos 3 formatos, do mais simples ao mais verboso.

  // A) raiz: programId (alguns clusters exigem isso)
  const attemptA = await passkitJson(baseUrl, token, "/members/tiers/list", {
    programId,
    limit: 100,
  });
  if (attemptA.ok) return attemptA;

  const msgA = (attemptA.json?.error?.message ?? attemptA.json?.message ?? attemptA.text ?? "").toString();

  // B) filters.programId
  const attemptB = await passkitJson(baseUrl, token, "/members/tiers/list", {
    filters: {
      programId,
      limit: 100,
      offset: 0,
    },
  });
  if (attemptB.ok) return attemptB;

  const msgB = (attemptB.json?.error?.message ?? attemptB.json?.message ?? attemptB.text ?? "").toString();

  // C) filters.filterGroups (documentação antiga)
  const needsProgramId = `${msgA} ${msgB}`.toLowerCase().includes("please provide program id");
  if (needsProgramId) {
    return passkitJson(baseUrl, token, "/members/tiers/list", {
      filters: {
        limit: 100,
        offset: 0,
        orderBy: "created",
        orderAsc: true,
        filterGroups: [
          {
            condition: "AND",
            fieldFilters: [
              { filterField: "programId", filterOperator: "eq", filterValue: programId },
            ],
          },
        ],
      },
    });
  }

  // Retorna o último erro relevante
  return attemptB;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { leaderId }: LeaderPassRequest = await req.json();

    if (!leaderId) {
      return new Response(
        JSON.stringify({ success: false, error: "leaderId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-leader-pass] Gerando passe para líder: ${leaderId}`);

    // Buscar configurações do PassKit
    const { data: settings, error: settingsError } = await supabase
      .from("integrations_settings")
      .select("passkit_api_token, passkit_enabled, passkit_api_base_url, passkit_program_id, passkit_tier_id")
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error("[create-leader-pass] Erro ao buscar configurações:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Configurações não encontradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configurações de gamificação para níveis
    const { data: officeSettings } = await supabase
      .from("office_settings")
      .select("nivel_bronze_min, nivel_bronze_max, nivel_prata_min, nivel_prata_max, nivel_ouro_min, nivel_ouro_max, nivel_diamante_min")
      .limit(1)
      .single();

    console.log("[create-leader-pass] Configurações de gamificação:", officeSettings);

    const passkitToken = (settings.passkit_api_token ?? "").trim();
    const passkitBaseUrl = (settings.passkit_api_base_url ?? "https://api.pub1.passkit.io").trim();
    const passkitProgramId = (settings.passkit_program_id ?? "").trim();
    const passkitTierId = (settings.passkit_tier_id ?? "").trim();

    if (!settings.passkit_enabled || !passkitToken || !passkitProgramId || !passkitTierId) {
      return new Response(
        JSON.stringify({ success: false, error: "PassKit não está configurado completamente. Verifique Token, Program ID e Tier ID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Debug seguro
    console.log(
      `[create-leader-pass] PassKit baseUrl=${passkitBaseUrl} programId=${passkitProgramId} tierId=${passkitTierId}`
    );

    // Validar se o Tier pertence ao Program (melhora diagnóstico quando o Tier ID está errado)
    const tiersRes = await listMemberTiers(passkitBaseUrl, passkitToken, passkitProgramId);
    if (!tiersRes.ok) {
      console.error("[create-leader-pass] Falha ao listar tiers:", tiersRes.status, tiersRes.text);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível validar o Tier no PassKit. Verifique Base URL e Token.",
          details: tiersRes.text,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parseia resposta NDJSON (PassKit pode retornar múltiplos objetos JSON separados por newline)
    let tiers: PassKitTier[] = [];
    if (Array.isArray(tiersRes.json)) {
      tiers = tiersRes.json;
    } else if (tiersRes.json?.tiers || tiersRes.json?.items || tiersRes.json?.data || tiersRes.json?.filters?.items) {
      tiers =
        tiersRes.json?.tiers ??
        tiersRes.json?.items ??
        tiersRes.json?.data ??
        tiersRes.json?.filters?.items ??
        [];
    } else if (typeof tiersRes.text === "string" && tiersRes.text.includes('{"result"')) {
      // NDJSON: cada linha é {"result": {...}}
      const lines = tiersRes.text.split("\n").filter((l) => l.trim().startsWith("{"));
      tiers = lines.map((line) => {
        try {
          const parsed = JSON.parse(line);
          const r = parsed.result ?? parsed;
          return { id: r.id, name: r.name, programId: r.programId };
        } catch {
          return null;
        }
      }).filter(Boolean) as PassKitTier[];
    }

    if (!tiers.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Nenhum Tier encontrado para este Program ID no PassKit (ou Program ID inválido).",
          details: {
            programId: passkitProgramId,
            tierId: passkitTierId,
            raw: tiersRes.json ?? tiersRes.text,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar tierId
    const tierExists = tiers.some((t) => t?.id === passkitTierId);
    if (!tierExists) {
      const available = tiers.slice(0, 20).map((t) => ({ id: t.id, name: t.name ?? "" }));
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Tier ID inválido. Use um dos IDs listados abaixo (copie o 'id', não o 'passTemplateId').",
          details: {
            programId: passkitProgramId,
            tierId: passkitTierId,
            availableTiers: available,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do líder com campos adicionais
    const { data: leader, error: leaderError } = await supabase
      .from("lideres")
      .select(`
        id,
        nome_completo,
        telefone,
        email,
        affiliate_token,
        pontuacao_total,
        cadastros,
        data_nascimento,
        join_date,
        hierarchy_level,
        is_coordinator,
        is_verified,
        verified_at,
        cidade:cidade_id (nome),
        parent_leader:parent_leader_id (nome_completo)
      `)
      .eq("id", leaderId)
      .single();

    if (leaderError || !leader) {
      console.error("[create-leader-pass] Líder não encontrado:", leaderError);
      return new Response(
        JSON.stringify({ success: false, error: "Líder não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados da organização
    const { data: org } = await supabase
      .from("organization")
      .select("nome, logo_url, cargo")
      .limit(1)
      .single();

    const organizationName = org?.nome || "Gabinete";
    const logoUrl = org?.logo_url || "";

    // Funções auxiliares
    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return "";
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("pt-BR");
      } catch {
        return "";
      }
    };

    const getNivelHierarquico = (level: number | null, isCoordinator: boolean | null): string => {
      if (isCoordinator) return "Coordenador";
      if (level === null || level === undefined) return "Líder";
      if (level === 1) return "Líder Nível 1";
      if (level === 2) return "Líder Nível 2";
      if (level === 3) return "Líder Nível 3";
      return `Líder Nível ${level}`;
    };

    // Função para determinar nível de gamificação baseado na pontuação
    interface NivelGamificacao {
      nome: string;
      icone: string;
    }

    const getNivelGamificacao = (pontos: number): NivelGamificacao => {
      // Valores padrão caso não haja configuração
      const bronzeMax = officeSettings?.nivel_bronze_max ?? 10;
      const prataMax = officeSettings?.nivel_prata_max ?? 30;
      const ouroMax = officeSettings?.nivel_ouro_max ?? 50;
      
      if (pontos <= bronzeMax) return { nome: "Bronze", icone: "🥉" };
      if (pontos <= prataMax) return { nome: "Prata", icone: "🥈" };
      if (pontos <= ouroMax) return { nome: "Ouro", icone: "🥇" };
      return { nome: "Diamante", icone: "💎" };
    };

    // Gerar URL do link de afiliado - usando URL base principal do sistema
    const siteBaseUrl = Deno.env.get("APP_BASE_URL") || "https://df-elector-pulse.lovable.app";
    const affiliateUrl = leader.affiliate_token 
      ? `${siteBaseUrl}/affiliate/${leader.affiliate_token}`
      : "";

    // Dados para exibição no cartão
    const nivelGamificacao = getNivelGamificacao(leader.pontuacao_total);
    const nivelHierarquico = getNivelHierarquico(leader.hierarchy_level, leader.is_coordinator);
    const cidadeNome = (leader.cidade as any)?.nome || "N/A";
    const membroDesde = formatDate(leader.join_date) || "N/A";
    const liderSuperior = (leader.parent_leader as any)?.nome_completo || "Nenhum";
    const verificadoStatus = leader.is_verified ? `Sim (${formatDate(leader.verified_at)})` : "Não";

    console.log(`[create-leader-pass] Nível gamificação: ${nivelGamificacao.icone} ${nivelGamificacao.nome} (${leader.pontuacao_total} pontos)`);

    // Criar o passe via PassKit API usando Bearer Token
    const passData = {
      // Member pass data - incluindo programId e tierId obrigatórios
      programId: passkitProgramId,
      tierId: passkitTierId,
      externalId: leader.id,
      person: {
        displayName: leader.nome_completo,
        emailAddress: leader.email || undefined,
        mobileNumber: leader.telefone || undefined,
      },
      // Campos nativos do PassKit para exibição automática no cartão
      passOverrides: {
        // Header: aparece no topo ao lado do logo - agora com nível de gamificação
        headerFields: [
          { key: "nivel", label: "Nível", value: `${nivelGamificacao.icone} ${nivelGamificacao.nome}` }
        ],
        // Primary: nome em destaque no centro
        primaryFields: [
          { key: "nome", label: "Líder", value: leader.nome_completo }
        ],
        // Secondary: informações principais abaixo do nome
        secondaryFields: [
          { key: "pontos", label: "Pontos", value: leader.pontuacao_total.toString() },
          { key: "cadastros", label: "Cadastros", value: leader.cadastros.toString() }
        ],
        // Auxiliary: informações complementares
        auxiliaryFields: [
          { key: "cidade", label: "Cidade", value: cidadeNome },
          { key: "membro_desde", label: "Desde", value: membroDesde }
        ],
        // Back: verso do cartão com detalhes completos
        backFields: [
          { key: "telefone", label: "Telefone", value: leader.telefone || "Não informado" },
          { key: "email", label: "E-mail", value: leader.email || "Não informado" },
          { key: "superior", label: "Líder Superior", value: liderSuperior },
          { key: "verificado", label: "Verificado", value: verificadoStatus },
          { key: "coordenador", label: "Coordenador", value: leader.is_coordinator ? "Sim" : "Não" },
          { key: "afiliado", label: "Link de Afiliado", value: affiliateUrl || "N/A" },
          { key: "organizacao", label: "Organização", value: organizationName }
        ]
      },
      // Backup em metaData para integrações e histórico
      metaData: {
        leaderId: leader.id,
        affiliateToken: leader.affiliate_token || "",
        affiliateUrl: affiliateUrl,
        pontuacao: leader.pontuacao_total.toString(),
        cadastros: leader.cadastros.toString(),
        cidade: cidadeNome,
        telefone: leader.telefone || "",
        email: leader.email || "",
        // Nível de gamificação (baseado em pontos)
        nivelGamificacao: nivelGamificacao.nome,
        nivelGamificacaoIcone: nivelGamificacao.icone,
        // Nível hierárquico (baseado na árvore de lideranças)
        nivelHierarquico: nivelHierarquico,
        nivelNumero: (leader.hierarchy_level ?? 0).toString(),
        coordenador: leader.is_coordinator ? "Sim" : "Não",
        liderSuperior: liderSuperior,
        membroDesde: membroDesde,
        dataNascimento: leader.data_nascimento || "",
        verificado: leader.is_verified ? "Sim" : "Não",
        verificadoEm: formatDate(leader.verified_at),
        organizacao: organizationName,
      },
      tierPoints: leader.pontuacao_total,
      secondaryPoints: leader.cadastros,
    };

    console.log("[create-leader-pass] Enviando para PassKit:", JSON.stringify(passData));

    // Chamar a API do PassKit para criar o membro
    console.log(`[create-leader-pass] Chamando POST ${passkitBaseUrl}/members/member`);
    let passkitResponse = await fetch(`${passkitBaseUrl}/members/member`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${passkitToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(passData),
    });

    // Se o membro já existe (409), recuperar e/ou atualizar em vez de falhar
    if (passkitResponse.status === 409) {
      console.log("[create-leader-pass] Membro já existe, recuperando registro...");

      let existingMember: any | null = null;

      // 1) Tentar endpoint direto por externalId
      const getMemberUrl = `${passkitBaseUrl}/members/member/external/${passkitProgramId}/${leader.id}`;
      console.log(`[create-leader-pass] Buscando membro existente (GET): ${getMemberUrl}`);

      const getMemberResponse = await fetch(getMemberUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${passkitToken}`,
        },
      });

      console.log(
        `[create-leader-pass] GET existing member status=${getMemberResponse.status}`
      );

      if (getMemberResponse.ok) {
        existingMember = await getMemberResponse.json();
      } else {
        // 2) Fallback: listar membros e filtrar por memberId/externalId
        const listUrl = `${passkitBaseUrl}/members/member/list/${passkitProgramId}`;
        console.log(`[create-leader-pass] Fallback list (POST): ${listUrl}`);

        const listResponse = await fetch(listUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${passkitToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filters: {
              filterGroups: [
                {
                  condition: "AND",
                  fieldFilters: [
                    {
                      filterField: "memberId",
                      filterValue: leader.id,
                      filterOperator: "eq",
                    },
                  ],
                },
              ],
            },
            page: 0,
            pageSize: 10,
          }),
        });

        console.log(
          `[create-leader-pass] POST list status=${listResponse.status}`
        );

        if (listResponse.ok) {
          const listJson = await listResponse.json();
          const results =
            listJson?.results || listJson?.result || listJson?.data || listJson?.members || [];
          existingMember = Array.isArray(results) ? results[0] : results;
        } else {
          const listErr = await listResponse.text();
          console.error("[create-leader-pass] Falha list fallback:", listResponse.status, listErr);
        }
      }

      if (existingMember?.id) {
        console.log("[create-leader-pass] Membro existente encontrado:", existingMember.id);

        // Verificar se o membro está invalidado
        const memberStatus = existingMember.universalStatus || 
                             existingMember.status || 
                             (existingMember.recordData && existingMember.recordData["universal.status"]);
        
        console.log("[create-leader-pass] Status do membro existente:", memberStatus);
        
        // Se está invalidado, criar um NOVO membro com externalId diferente
        if (memberStatus === "PASS_INVALIDATED" || memberStatus === "3" || memberStatus === 3) {
          console.log("[create-leader-pass] Membro anterior estava INVALIDADO, criando novo...");
          
          // Usar um novo externalId com timestamp para criar membro fresco
          const newExternalId = `${leader.id}_${Date.now()}`;
          const newPassData = {
            ...passData,
            externalId: newExternalId,
          };
          
          console.log(`[create-leader-pass] Criando novo membro com externalId: ${newExternalId}`);
          const newMemberResponse = await fetch(`${passkitBaseUrl}/members/member`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${passkitToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(newPassData),
          });
          
          if (newMemberResponse.ok) {
            const newResult = await newMemberResponse.json();
            console.log("[create-leader-pass] Novo membro criado:", newResult.id);
            
            // Salvar novo ID e limpar invalidação
            await supabase
              .from("lideres")
              .update({ 
                passkit_member_id: newResult.id,
                passkit_invalidated_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", leaderId);
            
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  passId: newResult.id,
                  passUrl: newResult.url || newResult.passUrl || `https://pub2.pskt.io/${newResult.id}`,
                  appleUrl: newResult.appleUrl,
                  googleUrl: newResult.googleUrl,
                  message: "Novo cartão criado com sucesso! (anterior estava invalidado)",
                },
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else {
            const newError = await newMemberResponse.text();
            console.error("[create-leader-pass] Erro ao criar novo membro:", newError);
          }
        }

        // Salvar o passkit_member_id no líder (caso não esteja salvo)
        console.log(`[create-leader-pass] Salvando passkit_member_id: ${existingMember.id}`);
        const { error: saveMemberIdError } = await supabase
          .from("lideres")
          .update({
            passkit_member_id: existingMember.id,
            passkit_invalidated_at: null, // Limpar invalidação anterior
            updated_at: new Date().toISOString(),
          })
          .eq("id", leaderId);

        if (saveMemberIdError) {
          console.error("[create-leader-pass] Erro ao salvar passkit_member_id:", saveMemberIdError);
        }

        // Tentar atualizar o membro com PUT
        const updateData = {
          ...passData,
          id: existingMember.id,
        };

        console.log(`[create-leader-pass] Atualizando membro: PUT ${passkitBaseUrl}/members/member`);
        const updateResponse = await fetch(`${passkitBaseUrl}/members/member`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${passkitToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        });

        console.log(
          `[create-leader-pass] PUT update status=${updateResponse.status}`
        );

        if (!updateResponse.ok) {
          const updateError = await updateResponse.text();
          console.error("[create-leader-pass] Erro ao atualizar:", updateResponse.status, updateError);
          
          // Verificar se o erro é de membro invalidado
          if (updateError.includes("cannot update invalided member") || updateError.includes("invalidated")) {
            console.log("[create-leader-pass] Membro invalidado detectado via erro PUT, tentando criar novo...");
            
            // Criar novo membro com externalId diferente
            const newExternalId = `${leader.id}_${Date.now()}`;
            const newPassData = {
              ...passData,
              externalId: newExternalId,
            };
            
            const newMemberResponse = await fetch(`${passkitBaseUrl}/members/member`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${passkitToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(newPassData),
            });
            
            if (newMemberResponse.ok) {
              const newResult = await newMemberResponse.json();
              
              await supabase
                .from("lideres")
                .update({ 
                  passkit_member_id: newResult.id,
                  passkit_invalidated_at: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", leaderId);
              
              return new Response(
                JSON.stringify({
                  success: true,
                  data: {
                    passId: newResult.id,
                    passUrl: newResult.url || newResult.passUrl || `https://pub2.pskt.io/${newResult.id}`,
                    message: "Novo cartão criado com sucesso!",
                  },
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }

        const passUrl =
          existingMember?.passOverrides?.passUrl ||
          existingMember?.urls?.landingPage ||
          existingMember?.url ||
          existingMember?.passUrl ||
          `https://pub2.pskt.io/${existingMember.id}`;

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              passId: existingMember.id,
              passUrl,
              message: updateResponse.ok
                ? "Passe atualizado com sucesso"
                : "Passe já existe (não foi possível atualizar, mas foi recuperado)",
              existing: true,
              updated: Boolean(updateResponse.ok),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se não conseguimos recuperar o membro existente, retornar um erro mais claro
      const originalErrorText = await passkitResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Passe já existe no PassKit, mas não consegui recuperar o registro para atualizar. Verifique permissões/endpoint.",
          details: originalErrorText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!passkitResponse.ok) {
      const errorText = await passkitResponse.text();
      console.error("[create-leader-pass] Erro PassKit:", passkitResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erro ao criar passe no PassKit. Verifique suas credenciais e configurações.",
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await passkitResponse.json();
    console.log("[create-leader-pass] Passe criado com sucesso:", result);

    // Salvar o passkit_member_id no líder
    if (result.id) {
      console.log(`[create-leader-pass] Salvando passkit_member_id: ${result.id}`);
      const { error: updateError } = await supabase
        .from("lideres")
        .update({
          passkit_member_id: result.id,
          passkit_invalidated_at: null, // Limpar invalidação anterior
          updated_at: new Date().toISOString(),
        })
        .eq("id", leaderId);

      if (updateError) {
        console.error("[create-leader-pass] Erro ao salvar passkit_member_id:", updateError);
      } else {
        console.log("[create-leader-pass] passkit_member_id salvo com sucesso");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          passId: result.id,
          passUrl: result.url || result.passUrl || `https://pub2.pskt.io/${result.id}`,
          appleUrl: result.appleUrl,
          googleUrl: result.googleUrl,
          message: "Passe criado com sucesso"
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[create-leader-pass] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
