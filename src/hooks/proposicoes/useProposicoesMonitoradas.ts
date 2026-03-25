import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface ProposicaoMonitorada {
  id: string;
  tenant_id: string;
  casa: "camara" | "senado";
  camara_id: number | null;
  senado_codigo: number | null;
  sigla_tipo: string;
  numero: number;
  ano: number;
  ementa: string | null;
  ementa_detalhada: string | null;
  keywords: string[] | null;
  url_inteiro_teor: string | null;
  autor_nome: string | null;
  autor_partido: string | null;
  autor_uf: string | null;
  cod_situacao: number | null;
  descricao_situacao: string | null;
  sigla_orgao_situacao: string | null;
  data_situacao: string | null;
  regime: string | null;
  apreciacao: string | null;
  ultima_sequencia_camara: number;
  ultima_data_tramitacao: string | null;
  ultima_verificacao_em: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type GrupoSituacao = "tramitando" | "aprovada" | "arquivada" | "atencao";

export function getGrupoSituacao(codSituacao: number | null): GrupoSituacao {
  if (!codSituacao) return "tramitando";
  const aprovada = new Set([1140, 1150, 1160, 1230, 1285, 1294, 1299, 1305]);
  const arquivada = new Set([923, 930, 937, 941, 950, 1120, 1222, 1292, 1360]);
  const atencao = new Set([924, 903, 904, 926]);
  if (aprovada.has(codSituacao)) return "aprovada";
  if (arquivada.has(codSituacao)) return "arquivada";
  if (atencao.has(codSituacao)) return "atencao";
  return "tramitando";
}

export function getSituacaoColor(grupo: GrupoSituacao): string {
  switch (grupo) {
    case "aprovada":  return "bg-green-100 text-green-800 border-green-200";
    case "arquivada": return "bg-red-100 text-red-800 border-red-200";
    case "atencao":   return "bg-yellow-100 text-yellow-800 border-yellow-200";
    default:          return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

export function getSituacaoLabel(grupo: GrupoSituacao): string {
  switch (grupo) {
    case "aprovada":  return "Aprovada";
    case "arquivada": return "Arquivada";
    case "atencao":   return "Atenção";
    default:          return "Tramitando";
  }
}

// ─── Hook principal ─────────────────────────────────────────────────────────
export function useProposicoesMonitoradas() {
  const { activeTenant } = useTenantContext();

  return useQuery({
    queryKey: ["proposicoes-monitoradas", activeTenant?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposicoes_monitoradas")
        .select("*")
        .eq("tenant_id", activeTenant!.id)
        .eq("ativo", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as ProposicaoMonitorada[];
    },
    enabled: !!activeTenant?.id,
  });
}

// ─── Adicionar proposição ────────────────────────────────────────────────────
export function useAddProposicao() {
  const queryClient = useQueryClient();
  const { activeTenant } = useTenantContext();

  return useMutation({
    mutationFn: async (payload: Partial<ProposicaoMonitorada>) => {
      const { data, error } = await (supabase as any)
        .from("proposicoes_monitoradas")
        .insert({ ...payload, tenant_id: activeTenant!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposicoes-monitoradas"] });
      toast.success("Proposição adicionada ao monitoramento");
    },
    onError: (err: any) => {
      if (err.code === "23505") {
        toast.error("Essa proposição já está sendo monitorada");
      } else {
        toast.error("Erro ao adicionar proposição: " + err.message);
      }
    },
  });
}

// ─── Remover proposição ──────────────────────────────────────────────────────
export function useRemoveProposicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("proposicoes_monitoradas")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposicoes-monitoradas"] });
      toast.success("Proposição removida do monitoramento");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover proposição: " + err.message);
    },
  });
}

// ─── Buscar proposição na API da Câmara por número/tipo/ano ─────────────────
export async function searchProposicaoCamara(
  siglaType: string,
  numero: number,
  ano: number
): Promise<any | null> {
  const url = `https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=${siglaType}&numero=${numero}&ano=${ano}&itens=1`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) return null;
  const json = await resp.json();
  if (!json.dados || json.dados.length === 0) return null;
  const basic = json.dados[0];

  // Busca detalhes
  const detailResp = await fetch(
    `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${basic.id}`,
    { headers: { Accept: "application/json" } }
  );
  if (!detailResp.ok) return basic;
  const detail = await detailResp.json();
  return detail.dados || basic;
}

// ─── Buscar proposição no Senado por número/tipo/ano ────────────────────────
export async function searchProposicaoSenado(
  siglaType: string,
  numero: number,
  ano: number
): Promise<any | null> {
  const url = `https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?sigla=${siglaType}&numero=${numero}&ano=${ano}`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) return null;
  const json = await resp.json();
  const lista = json?.PesquisaBasicaMateria?.Materias?.Materia;
  if (!lista) return null;
  const first = Array.isArray(lista) ? lista[0] : lista;
  return first || null;
}
