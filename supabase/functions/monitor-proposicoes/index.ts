import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// Códigos de tramitação que disparam notificação imediata
// =====================================================
const CODIGOS_CRITICOS = new Set([
  231,  // Votação
  244,  // Aprovação de Proposição em Plenário
  197,  // Rejeição de Proposição
  196,  // Aprovação de Urgência
  320,  // Designação de Relator(a)
  128,  // Remessa ao Senado Federal
  251,  // Transformação em Norma Jurídica
  502,  // Arquivamento
  1012, // Transformado em Norma Jurídica com Veto Parcial
  1013, // Vetado Totalmente
  620,  // Perda de eficácia
  198,  // Prejudicado
  200,  // Retirada pelo(a) Autor(a)
  219,  // Encaminhamento da Votação
  227,  // Encerramento de Discussão
]);

// Situações aprovadas
const SITUACOES_APROVADA = new Set([1140, 1150, 1160, 1230, 1285, 1294, 1299, 1305]);
// Situações arquivadas
const SITUACOES_ARQUIVADA = new Set([923, 930, 937, 941, 950, 1120, 1222, 1292, 1360]);
// Situações de atenção (decisão iminente)
const SITUACOES_ATENCAO = new Set([924, 903, 904, 926]);

function classifyGrupoSituacao(codSituacao: number | null): string {
  if (!codSituacao) return "tramitando";
  if (SITUACOES_APROVADA.has(codSituacao)) return "aprovada";
  if (SITUACOES_ARQUIVADA.has(codSituacao)) return "arquivada";
  if (SITUACOES_ATENCAO.has(codSituacao)) return "atencao";
  return "tramitando";
}

// =====================================================
// Busca tramitações da Câmara a partir de uma data
// =====================================================
async function fetchTramitacoesCamara(
  camaraId: number,
  ultimaData: string | null
): Promise<any[]> {
  let url = `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${camaraId}/tramitacoes`;
  if (ultimaData) {
    const dataInicio = ultimaData.split("T")[0];
    url += `?dataInicio=${dataInicio}`;
  }

  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    console.error(`[monitor-proposicoes] Câmara API error for id ${camaraId}: ${resp.status}`);
    return [];
  }

  const json = await resp.json();
  return Array.isArray(json.dados) ? json.dados : [];
}

// =====================================================
// Busca tramitações do Senado
// =====================================================
async function fetchTramitacoesSenado(
  senadoCodigo: number
): Promise<any[]> {
  const url = `https://legis.senado.leg.br/dadosabertos/materia/movimentacoes/${senadoCodigo}`;

  const resp = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    console.error(`[monitor-proposicoes] Senado API error for cod ${senadoCodigo}: ${resp.status}`);
    return [];
  }

  const json = await resp.json();
  const movimentacoes =
    json?.MovimentacaoMateria?.Materia?.Movimentacoes?.Movimentacao;
  if (!movimentacoes) return [];
  return Array.isArray(movimentacoes) ? movimentacoes : [movimentacoes];
}

// =====================================================
// Monta texto da notificação WhatsApp
// =====================================================
function buildNotificationMessage(
  proposicao: any,
  tramitacao: any,
  isCritico: boolean
): string {
  const tipo = proposicao.sigla_tipo;
  const num = proposicao.numero;
  const ano = proposicao.ano;
  const ementa = proposicao.ementa
    ? proposicao.ementa.length > 120
      ? proposicao.ementa.substring(0, 117) + "..."
      : proposicao.ementa
    : "Sem ementa";

  const dataHora = tramitacao.dataHora || tramitacao.data_hora || "";
  const dataBR = dataHora
    ? new Date(dataHora).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const orgao = tramitacao.siglaOrgao || tramitacao.sigla_orgao || "";
  const descricao =
    tramitacao.descricaoTramitacao ||
    tramitacao.descricao_tramitacao ||
    tramitacao.DescricaoMovimentacao ||
    "Nova movimentação";
  const despacho =
    tramitacao.despacho ||
    tramitacao.TextoMovimentacao ||
    "";

  if (isCritico) {
    const grupo = classifyGrupoSituacao(
      tramitacao.codSituacao || tramitacao.cod_situacao || null
    );
    const emoji =
      grupo === "aprovada"
        ? "✅"
        : grupo === "arquivada"
        ? "🔴"
        : grupo === "atencao"
        ? "⚠️"
        : "🏛️";

    return [
      `${emoji} *${descricao.toUpperCase()}*`,
      ``,
      `📋 *${tipo} ${num}/${ano}*`,
      ementa,
      ``,
      orgao ? `📍 Órgão: ${orgao}` : null,
      dataBR ? `📅 Data: ${dataBR}` : null,
      despacho
        ? `📝 ${despacho.length > 200 ? despacho.substring(0, 197) + "..." : despacho}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Notificação simples para tramitações não críticas
  return [
    `📄 *Nova tramitação – ${tipo} ${num}/${ano}*`,
    `${orgao ? orgao + " | " : ""}${descricao}`,
    dataBR || null,
  ]
    .filter(Boolean)
    .join("\n");
}

// =====================================================
// =====================================================
// Monta o payload do Meta Template para envio fora da janela 24h
// =====================================================
function buildMetaTemplatePayload(
  proposicao: any,
  tramitacao: any
): { name: string; language: { code: string }; components: any[] } {
  const sigla = `${proposicao.sigla_tipo} ${proposicao.numero}/${proposicao.ano}`;
  const situacao = `${tramitacao.descricaoSituacao || tramitacao.descricao_situacao || "Nova movimentação"} - ${tramitacao.siglaOrgao || tramitacao.sigla_orgao || ""}`.trim().replace(/ -\s*$/, "");
  const dataHora = tramitacao.dataHora || tramitacao.data_hora || "";
  const dataBR = dataHora
    ? new Date(dataHora).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : new Date().toLocaleDateString("pt-BR");
  const despacho = (
    tramitacao.despacho ||
    tramitacao.TextoMovimentacao ||
    tramitacao.descricaoTramitacao ||
    tramitacao.descricao_tramitacao ||
    "Movimentação registrada"
  ).substring(0, 200);

  return {
    name: "alerta_legislativo",
    language: { code: "pt_BR" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: sigla },
          { type: "text", text: situacao },
          { type: "text", text: dataBR },
          { type: "text", text: despacho },
        ],
      },
    ],
  };
}

// =====================================================
// Envia notificação WhatsApp via send-whatsapp function
// =====================================================
async function sendWhatsAppNotification(
  supabaseUrl: string,
  serviceKey: string,
  alerta: any,
  message: string,
  tenantId: string,
  metaTemplate?: { name: string; language: { code: string }; components: any[] }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload: Record<string, any> = {
      phone: alerta.destino,
      message,
      tenantId,
      providerOverride: alerta.provider,
      bypassAutoCheck: true,
    };

    // Use Meta template for delivery outside 24h window
    if (metaTemplate && alerta.provider === "meta_cloud") {
      payload.metaTemplate = metaTemplate;
    }

    const resp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const data = await resp.json();
    return {
      success: data.success === true,
      messageId: data.recordId,
      error: data.error,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startTime = Date.now();
  let totalMonitoradas = 0;
  let totalNovasTramitacoes = 0;
  let totalNotificacoes = 0;
  let totalErros = 0;

  try {
    // Busca todas as proposições monitoradas ativas
    const { data: proposicoes, error: propError } = await supabase
      .from("proposicoes_monitoradas")
      .select("*")
      .eq("ativo", true);

    if (propError) throw propError;
    if (!proposicoes || proposicoes.length === 0) {
      return new Response(
        JSON.stringify({ monitored: 0, new_tramitacoes: 0, notifications: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    totalMonitoradas = proposicoes.length;
    console.log(`[monitor-proposicoes] Processing ${totalMonitoradas} propositions`);

    // Processa cada proposição
    for (const prop of proposicoes) {
      try {
        let tramitacoes: any[] = [];

        if (prop.casa === "camara" && prop.camara_id) {
          tramitacoes = await fetchTramitacoesCamara(
            prop.camara_id,
            prop.ultima_data_tramitacao
          );
        } else if (prop.casa === "senado" && prop.senado_codigo) {
          tramitacoes = await fetchTramitacoesSenado(prop.senado_codigo);
        }

        if (!tramitacoes.length) continue;

        // Filtra apenas tramitações novas (sequência maior que a última registrada)
        const ultimaSeq = prop.ultima_sequencia_camara || 0;
        const novasTramitacoes = tramitacoes.filter((t) => {
          const seq = t.sequencia || 0;
          return seq > ultimaSeq;
        });

        if (!novasTramitacoes.length) continue;

        console.log(
          `[monitor-proposicoes] ${prop.sigla_tipo} ${prop.numero}/${prop.ano}: ${novasTramitacoes.length} new tramitacoes`
        );

        // Busca alertas ativos do tenant
        const { data: alertas } = await supabase
          .from("proposicoes_alertas_config")
          .select("*")
          .eq("tenant_id", prop.tenant_id)
          .eq("ativo", true);

        let maxSeq = ultimaSeq;
        let latestDataHora: string | null = null;
        let latestCodSituacao: number | null = null;
        let latestDescSituacao: string | null = null;
        let latestOrgao: string | null = null;

        for (const tram of novasTramitacoes) {
          const seq = tram.sequencia || 0;
          const codTipo = tram.codTipoTramitacao || 0;
          const codSit = tram.codSituacao || null;
          const isCritico = CODIGOS_CRITICOS.has(codTipo);
          const grupoSituacao = classifyGrupoSituacao(codSit);

          // Persiste tramitação no cache
          const { data: tramRecord, error: tramError } = await supabase
            .from("proposicoes_tramitacoes")
            .upsert(
              {
                proposicao_id: prop.id,
                tenant_id: prop.tenant_id,
                sequencia: seq,
                data_hora: tram.dataHora || new Date().toISOString(),
                sigla_orgao: tram.siglaOrgao || null,
                uri_orgao: tram.uriOrgao || null,
                cod_tipo_tramitacao: codTipo,
                descricao_tramitacao: tram.descricaoTramitacao || null,
                cod_situacao: codSit,
                descricao_situacao: tram.descricaoSituacao || null,
                despacho: tram.despacho || null,
                url_documento: tram.url || null,
                regime: tram.regime || null,
                eh_evento_critico: isCritico,
                grupo_situacao: grupoSituacao,
              },
              { onConflict: "proposicao_id,sequencia", ignoreDuplicates: false }
            )
            .select("id")
            .single();

          if (tramError) {
            console.error(`[monitor-proposicoes] Error saving tramitacao seq ${seq}:`, tramError.message);
            totalErros++;
            continue;
          }

          totalNovasTramitacoes++;

          // Atualiza maior sequência e status mais recente
          if (seq > maxSeq) {
            maxSeq = seq;
            latestDataHora = tram.dataHora || null;
            latestCodSituacao = codSit;
            latestDescSituacao = tram.descricaoSituacao || null;
            latestOrgao = tram.siglaOrgao || null;
          }

          // Envia notificações
          if (!alertas || alertas.length === 0) continue;

          for (const alerta of alertas) {
            // Se configurado para apenas eventos críticos, pula os não críticos
            if (alerta.eventos_criticos_only && !isCritico) continue;

            const message = buildNotificationMessage(prop, tram, isCritico);
            const metaTemplate = buildMetaTemplatePayload(prop, tram);

            const sendResult = await sendWhatsAppNotification(
              supabaseUrl,
              serviceKey,
              alerta,
              message,
              prop.tenant_id,
              metaTemplate
            );

            // Registra no log
            await supabase.from("proposicoes_notificacoes_log").insert({
              proposicao_id: prop.id,
              tramitacao_id: tramRecord!.id,
              alerta_config_id: alerta.id,
              tenant_id: prop.tenant_id,
              mensagem_enviada: message,
              provider_usado: alerta.provider,
              destino: alerta.destino,
              whatsapp_message_id: sendResult.messageId || null,
              status: sendResult.success ? "sent" : "failed",
              erro: sendResult.error || null,
            });

            // Marca tramitação como notificada
            if (sendResult.success && tramRecord?.id) {
              await supabase
                .from("proposicoes_tramitacoes")
                .update({ notificado_em: new Date().toISOString() })
                .eq("id", tramRecord.id);
            }

            if (sendResult.success) {
              totalNotificacoes++;
            } else {
              console.error(
                `[monitor-proposicoes] WhatsApp failed to ${alerta.destino}: ${sendResult.error}`
              );
              totalErros++;
            }
          }
        }

        // Atualiza a proposição com a última sequência e status
        await supabase
          .from("proposicoes_monitoradas")
          .update({
            ultima_sequencia_camara: maxSeq,
            ultima_data_tramitacao: latestDataHora,
            ultima_verificacao_em: new Date().toISOString(),
            cod_situacao: latestCodSituacao ?? prop.cod_situacao,
            descricao_situacao: latestDescSituacao ?? prop.descricao_situacao,
            sigla_orgao_situacao: latestOrgao ?? prop.sigla_orgao_situacao,
            data_situacao: latestDataHora ?? prop.data_situacao,
          })
          .eq("id", prop.id);
      } catch (propErr) {
        console.error(
          `[monitor-proposicoes] Error processing ${prop.sigla_tipo} ${prop.numero}/${prop.ano}:`,
          propErr instanceof Error ? propErr.message : String(propErr)
        );
        totalErros++;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[monitor-proposicoes] Done in ${elapsed}ms: monitored=${totalMonitoradas} new=${totalNovasTramitacoes} notifs=${totalNotificacoes} errors=${totalErros}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        monitored: totalMonitoradas,
        new_tramitacoes: totalNovasTramitacoes,
        notifications: totalNotificacoes,
        errors: totalErros,
        elapsed_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[monitor-proposicoes] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
