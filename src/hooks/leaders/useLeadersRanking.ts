import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderRankingData {
  id: string;
  name: string;
  phone: string;
  points: number;
  indicacoes: number;
  region: string;
  trend: "up" | "down" | "stable";
  lastActivity: string | null;
}

interface UseLeadersRankingOptions {
  region?: string;
  period?: string;
  page?: number;
  pageSize?: number;
}

interface LeadersRankingResult {
  data: LeaderRankingData[];
  totalCount: number;
}

const getDateFilter = (period: string) => {
  const now = new Date();
  switch(period) {
    case 'current':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case 'last':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    case 'quarter':
      return new Date(now.setMonth(now.getMonth() - 3)).toISOString();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).toISOString();
    default:
      return null;
  }
};

const calculateTrend = (lastActivity: string | null, points: number): "up" | "down" | "stable" => {
  if (lastActivity) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceActivity <= 15 && points > 0) {
      return "up";
    } else if (daysSinceActivity > 30) {
      return "down";
    }
  } else if (points === 0) {
    return "stable";
  }
  return "stable";
};

export function useLeadersRanking(options?: UseLeadersRankingOptions) {
  const { region, period, page = 1, pageSize = 20 } = options || {};
  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: ['leaders_ranking', region, period, page, pageSize],
    queryFn: async (): Promise<LeadersRankingResult> => {
      // Buscar contagem total
      const { data: totalCount, error: countError } = await supabase
        .rpc("get_leaders_ranking_count", {
          p_region: region && region !== 'all' ? region : null
        });

      if (countError) throw countError;

      // Buscar dados paginados
      const { data, error } = await supabase
        .rpc("get_leaders_ranking_paginated", {
          p_limit: pageSize,
          p_offset: offset,
          p_region: region && region !== 'all' ? region : null
        });

      if (error) throw error;

      // Processar dados
      let rankings: LeaderRankingData[] = (data || []).map((leader: {
        id: string;
        nome_completo: string;
        telefone: string | null;
        pontuacao_total: number;
        indicacoes: number;
        cidade_nome: string | null;
        last_activity: string | null;
      }) => ({
        id: leader.id,
        name: leader.nome_completo,
        phone: leader.telefone || '',
        points: leader.pontuacao_total,
        indicacoes: leader.indicacoes,
        region: leader.cidade_nome || 'Sem região',
        trend: calculateTrend(leader.last_activity, leader.pontuacao_total),
        lastActivity: leader.last_activity
      }));

      // Aplicar filtro de período no cliente (pois depende de last_activity)
      if (period && period !== 'all' && period !== 'current') {
        const dateFrom = getDateFilter(period);
        if (dateFrom) {
          rankings = rankings.filter(r =>
            r.lastActivity && new Date(r.lastActivity) >= new Date(dateFrom)
          );
        }
      }

      return {
        data: rankings,
        totalCount: totalCount || 0
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });
}
