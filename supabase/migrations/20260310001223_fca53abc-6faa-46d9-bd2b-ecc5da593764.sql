
-- Update get_distinct_cities_count to include lideres
CREATE OR REPLACE FUNCTION public.get_distinct_cities_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT location_name) FROM (
    -- office_contacts with cidade_id
    SELECT c.nome as location_name
    FROM office_contacts oc
    JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL
    UNION
    -- office_contacts with localidade only
    SELECT oc.localidade as location_name
    FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL
    UNION
    -- lideres with cidade_id
    SELECT c.nome as location_name
    FROM lideres l
    JOIN office_cities c ON c.id = l.cidade_id
    WHERE l.cidade_id IS NOT NULL
    UNION
    -- lideres with localidade only
    SELECT l.localidade as location_name
    FROM lideres l
    WHERE l.localidade IS NOT NULL AND l.localidade != '' AND l.cidade_id IS NULL
  ) combined;
$function$;

-- Update get_top_city to include lideres
CREATE OR REPLACE FUNCTION public.get_top_city()
 RETURNS TABLE(city_name text, city_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT location_name as city_name, COUNT(*) as city_count FROM (
    SELECT c.nome as location_name, oc.id
    FROM office_contacts oc
    JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL
    UNION ALL
    SELECT oc.localidade as location_name, oc.id
    FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL
    UNION ALL
    SELECT c.nome as location_name, l.id
    FROM lideres l
    JOIN office_cities c ON c.id = l.cidade_id
    WHERE l.cidade_id IS NOT NULL
    UNION ALL
    SELECT l.localidade as location_name, l.id
    FROM lideres l
    WHERE l.localidade IS NOT NULL AND l.localidade != '' AND l.cidade_id IS NULL
  ) combined
  GROUP BY location_name
  ORDER BY city_count DESC
  LIMIT 1;
$function$;

-- Update get_cities_ranking to include lideres
CREATE OR REPLACE FUNCTION public.get_cities_ranking()
 RETURNS TABLE(city_name text, city_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT location_name as city_name, COUNT(*) as city_count FROM (
    SELECT c.nome as location_name, oc.id
    FROM office_contacts oc
    JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL
    UNION ALL
    SELECT oc.localidade as location_name, oc.id
    FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL
    UNION ALL
    SELECT c.nome as location_name, l.id
    FROM lideres l
    JOIN office_cities c ON c.id = l.cidade_id
    WHERE l.cidade_id IS NOT NULL
    UNION ALL
    SELECT l.localidade as location_name, l.id
    FROM lideres l
    WHERE l.localidade IS NOT NULL AND l.localidade != '' AND l.cidade_id IS NULL
  ) combined
  GROUP BY location_name
  ORDER BY city_count DESC
  LIMIT 10;
$function$;
