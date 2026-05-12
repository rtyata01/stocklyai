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

REVOKE ALL ON FUNCTION public.get_visit_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_visit_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_visit_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_stats() TO service_role;