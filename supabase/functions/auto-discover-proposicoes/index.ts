import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Busca proposições da Câmara por nome do autor
async function fetchProposicoesCamara(nomeAutor: string): Promise<any[]> {
  const params = new URLSearchParams({
    autor: nomeAutor,
    itens: "100",
    ordem: "DESC",
    ordenarPor: "ano",
  });
  const resp = await fetch(
    `https://dadosabertos.camara.leg.br/api/v2/proposicoes?${params}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) }
  );
  if (!resp.ok) return [];
  const json = await resp.json();
  return Array.isArray(json.dados) ? json.dados : [];
}

// Busca detalhes de uma proposição da Câmara
async function fetchDetalheCamara(id: number): Promise<any | null> {
  const resp = await fetch(
    `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
  );
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.dados || null;
}

// Busca proposições do Senado por nome do autor
async function fetchProposicoesSenado(nomeAutor: string): Promise<any[]> {
  const resp = await fetch(
    `https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?nomeAutor=${encodeURIComponent(nomeAutor)}&v=7`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) }
  );
  if (!resp.ok) return [];
  const json = await resp.json();
  const lista = json?.PesquisaBasicaMateria?.Materias?.Materia;
  if (!lista) return [];
  return Array.isArray(lista) ? lista : [lista];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let totalNew = 0;
  let totalSkipped = 0;

  try {
    // Busca todos os tenants (organizations) com nome definido
    const { data: tenants, error: tErr } = await supabase
      .from("organization")
      .select("id, nome")
      .not("nome", "is", null);

    if (tErr) throw tErr;
    if (!tenants || tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, new_proposicoes: 0, message: "No tenants with nome" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const tenant of tenants) {
      const nomeAutor = tenant.nome;
      if (!nomeAutor) continue;

      console.log(`[auto-discover] Processing tenant ${tenant.id}: ${nomeAutor}`);

      // --- Câmara ---
      const camaraResults = await fetchProposicoesCamara(nomeAutor);
      for (const prop of camaraResults) {
        const detail = await fetchDetalheCamara(prop.id);
        const payload: Record<string, any> = {
          tenant_id: tenant.id,
          casa: "camara",
          camara_id: prop.id,
          sigla_tipo: prop.siglaTipo || "",
          numero: prop.numero || 0,
          ano: prop.ano || 0,
          ementa: detail?.ementa || prop.ementa || null,
          ementa_detalhada: detail?.ementaDetalhada || null,
          url_inteiro_teor: detail?.urlInteiroTeor || null,
          cod_situacao: detail?.statusProposicao?.codSituacao ?? null,
          descricao_situacao: detail?.statusProposicao?.descricaoSituacao ?? null,
          sigla_orgao_situacao: detail?.statusProposicao?.siglaOrgao ?? null,
          data_situacao: detail?.statusProposicao?.dataHora ?? null,
          regime: detail?.statusProposicao?.regime ?? null,
          apreciacao: detail?.statusProposicao?.descricaoApreciacao ?? null,
          autor_nome: nomeAutor,
        };

        const { error: insertErr } = await supabase
          .from("proposicoes_monitoradas")
          .upsert(payload, { onConflict: "tenant_id,casa,sigla_tipo,numero,ano", ignoreDuplicates: true });

        if (!insertErr) {
          totalNew++;
        } else if (insertErr.code === "23505") {
          totalSkipped++;
        } else {
          console.error(`[auto-discover] Insert error:`, insertErr.message);
        }

        // Rate limit: 100ms entre chamadas à API
        await new Promise((r) => setTimeout(r, 100));
      }

      // --- Senado ---
      const senadoResults = await fetchProposicoesSenado(nomeAutor);
      for (const m of senadoResults) {
        const payload: Record<string, any> = {
          tenant_id: tenant.id,
          casa: "senado",
          senado_codigo: Number(m.Codigo || m.CodigoMateria),
          sigla_tipo: m.SiglaSubtipoMateria || m.Sigla || "",
          numero: Number(m.NumeroMateria || m.Numero || 0),
          ano: Number(m.AnoMateria || m.Ano || 0),
          ementa: m.EmentaMateria || m.Ementa || null,
          autor_nome: nomeAutor,
        };

        const { error: insertErr } = await supabase
          .from("proposicoes_monitoradas")
          .upsert(payload, { onConflict: "tenant_id,casa,sigla_tipo,numero,ano", ignoreDuplicates: true });

        if (!insertErr) {
          totalNew++;
        } else if (insertErr.code === "23505") {
          totalSkipped++;
        }
      }
    }

    console.log(`[auto-discover] Done: new=${totalNew} skipped=${totalSkipped}`);

    return new Response(
      JSON.stringify({ success: true, new_proposicoes: totalNew, skipped: totalSkipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[auto-discover] Fatal:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
