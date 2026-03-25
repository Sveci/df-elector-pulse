import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TramitacaoItem {
  id: string;
  sequencia: number | null;
  data_hora: string;
  sigla_orgao: string | null;
  cod_tipo_tramitacao: number | null;
  descricao_tramitacao: string | null;
  cod_situacao: number | null;
  descricao_situacao: string | null;
  despacho: string | null;
  url_documento: string | null;
  regime: string | null;
  eh_evento_critico: boolean;
  grupo_situacao: string | null;
  notificado_em: string | null;
  created_at: string;
}

// ─── Tramitações cacheadas no banco ─────────────────────────────────────────
export function useTramitacoesCached(proposicaoId: string | null) {
  return useQuery({
    queryKey: ["tramitacoes-cached", proposicaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposicoes_tramitacoes")
        .select("*")
        .eq("proposicao_id", proposicaoId!)
        .order("sequencia", { ascending: false });

      if (error) throw error;
      return data as TramitacaoItem[];
    },
    enabled: !!proposicaoId,
  });
}

// ─── Detalhes direto da API da Câmara (live) ─────────────────────────────────
export function useDetalheProposicaoCamara(camaraId: number | null) {
  return useQuery({
    queryKey: ["detalhe-camara", camaraId],
    queryFn: async () => {
      const resp = await fetch(
        `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${camaraId}`,
        { headers: { Accept: "application/json" } }
      );
      if (!resp.ok) throw new Error("Falha ao buscar detalhes na Câmara");
      const json = await resp.json();
      return json.dados;
    },
    enabled: !!camaraId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

// ─── Tramitações direto da API da Câmara (live) ──────────────────────────────
export function useTramitacoesCamara(camaraId: number | null) {
  return useQuery({
    queryKey: ["tramitacoes-camara-live", camaraId],
    queryFn: async () => {
      const resp = await fetch(
        `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${camaraId}/tramitacoes?ordem=DESC&ordenarPor=sequencia&itens=50`,
        { headers: { Accept: "application/json" } }
      );
      if (!resp.ok) throw new Error("Falha ao buscar tramitações na Câmara");
      const json = await resp.json();
      return Array.isArray(json.dados) ? json.dados : [];
    },
    enabled: !!camaraId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Autores da proposição (Câmara) ─────────────────────────────────────────
export function useAutoresProposicaoCamara(camaraId: number | null) {
  return useQuery({
    queryKey: ["autores-camara", camaraId],
    queryFn: async () => {
      const resp = await fetch(
        `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${camaraId}/autores`,
        { headers: { Accept: "application/json" } }
      );
      if (!resp.ok) throw new Error("Falha ao buscar autores na Câmara");
      const json = await resp.json();
      return Array.isArray(json.dados) ? json.dados : [];
    },
    enabled: !!camaraId,
    staleTime: 1000 * 60 * 60, // 1 hora (autores raramente mudam)
  });
}

// ─── Log de notificações enviadas para esta proposição ───────────────────────
export function useNotificacoesLog(proposicaoId: string | null) {
  return useQuery({
    queryKey: ["notificacoes-log", proposicaoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposicoes_notificacoes_log")
        .select(`
          *,
          proposicoes_alertas_config (nome, tipo_destino, destino_nome)
        `)
        .eq("proposicao_id", proposicaoId!)
        .order("enviado_em", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!proposicaoId,
  });
}

// ─── Tipos de proposições disponíveis na Câmara ──────────────────────────────
export function useTiposProposicaoCamara() {
  return useQuery({
    queryKey: ["tipos-proposicao-camara"],
    queryFn: async () => {
      const resp = await fetch(
        "https://dadosabertos.camara.leg.br/api/v2/referencias/proposicoes/codTipoProposicao",
        { headers: { Accept: "application/json" } }
      );
      if (!resp.ok) throw new Error("Falha ao buscar tipos");
      const json = await resp.json();
      return Array.isArray(json.dados) ? json.dados : [];
    },
    staleTime: 1000 * 60 * 60 * 24, // 24h
  });
}
