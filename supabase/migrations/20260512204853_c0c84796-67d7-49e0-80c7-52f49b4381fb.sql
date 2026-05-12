DROP INDEX IF EXISTS public.site_visits_visitor_day_unique;

CREATE OR REPLACE FUNCTION public.get_visit_stats()
RETURNS TABLE(total_visits bigint, unique_visitors bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint AS total_visits,
         count(DISTINCT visitor_id)::bigint AS unique_visitors
  FROM public.site_visits;
$$;