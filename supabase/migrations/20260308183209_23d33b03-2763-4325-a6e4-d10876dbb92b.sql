DROP FUNCTION IF EXISTS public.get_top_leaders_with_indicacoes(integer);

CREATE OR REPLACE FUNCTION public.get_top_leaders_with_indicacoes(_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  telefone text,
  pontuacao_total integer,
  indicacoes bigint,
  cidade_nome text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.nome_completo,
    l.telefone,
    l.pontuacao_total,
    get_leader_total_indicacoes(l.id) as indicacoes,
    COALESCE(c.nome, l.localidade, 'Não informada') as cidade_nome,
    l.is_active
  FROM lideres l
  LEFT JOIN office_cities c ON c.id = l.cidade_id
  WHERE l.is_active = true
  ORDER BY l.pontuacao_total DESC
  LIMIT _limit;
END;
$$;