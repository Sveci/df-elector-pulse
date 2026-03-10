
-- Update get_distinct_cities_count to include localidade field
CREATE OR REPLACE FUNCTION public.get_distinct_cities_count()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT location_name) FROM (
    SELECT c.nome as location_name
    FROM office_contacts oc
    JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL
    UNION
    SELECT oc.localidade as location_name
    FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL
  ) combined;
$function$;

-- Update get_top_city to include localidade field
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
  ) combined
  GROUP BY location_name
  ORDER BY city_count DESC
  LIMIT 1;
$function$;

-- Update get_cities_ranking to include localidade field
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
  ) combined
  GROUP BY location_name
  ORDER BY city_count DESC
  LIMIT 10;
$function$;
