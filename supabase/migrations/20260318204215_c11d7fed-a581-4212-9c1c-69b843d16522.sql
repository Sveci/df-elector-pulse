DROP FUNCTION IF EXISTS public.get_all_coordinators_with_stats();

CREATE OR REPLACE FUNCTION public.get_all_coordinators_with_stats()
RETURNS TABLE(
  id uuid,
  nome_completo text,
  email text,
  telefone text,
  cidade_id uuid,
  cidade_nome text,
  cadastros integer,
  pontuacao_total integer,
  total_leaders bigint,
  total_cadastros bigint,
  total_pontos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.nome_completo,
    l.email,
    l.telefone,
    l.cidade_id,
    COALESCE(c.nome, l.localidade) as cidade_nome,
    l.cadastros,
    l.pontuacao_total,
    COALESCE(stats.total_leaders, 0) as total_leaders,
    COALESCE(stats.total_cadastros, 0) as total_cadastros,
    COALESCE(stats.total_pontos, 0) as total_pontos
  FROM lideres l
  LEFT JOIN office_cities c ON c.id = l.cidade_id
  LEFT JOIN LATERAL get_coordinator_network_stats(l.id) stats ON true
  WHERE l.is_coordinator = true
  ORDER BY l.nome_completo;
$$;