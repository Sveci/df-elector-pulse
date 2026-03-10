
CREATE OR REPLACE FUNCTION public.get_profile_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'genero', (
      SELECT json_agg(json_build_object('label', g.genero_label, 'count', g.cnt))
      FROM (
        SELECT genero_label, SUM(cnt)::bigint as cnt FROM (
          SELECT COALESCE(genero, 'Não identificado') as genero_label, count(*) as cnt
          FROM office_contacts
          GROUP BY COALESCE(genero, 'Não identificado')
          UNION ALL
          SELECT 'Não identificado' as genero_label, count(*) as cnt
          FROM lideres
        ) combined
        GROUP BY genero_label
      ) g
    ),
    'total_contacts', (
      (SELECT count(*) FROM office_contacts) + (SELECT count(*) FROM lideres)
    ),
    'idade_media', (
      SELECT COALESCE(round(avg(idade))::int, 0) FROM (
        SELECT EXTRACT(YEAR FROM age(now(), data_nascimento::date)) as idade
        FROM office_contacts
        WHERE data_nascimento IS NOT NULL
          AND data_nascimento::date < now()
          AND EXTRACT(YEAR FROM age(now(), data_nascimento::date)) BETWEEN 18 AND 100
        UNION ALL
        SELECT EXTRACT(YEAR FROM age(now(), data_nascimento::date)) as idade
        FROM lideres
        WHERE data_nascimento IS NOT NULL
          AND data_nascimento::date < now()
          AND EXTRACT(YEAR FROM age(now(), data_nascimento::date)) BETWEEN 18 AND 100
      ) ages
    ),
    'contacts_with_checkin', (
      SELECT count(DISTINCT contact_id)
      FROM event_registrations
      WHERE checked_in = true AND contact_id IS NOT NULL
    )
  );
$function$;
