create or replace function public.get_visit_stats()
returns table(total_visits bigint, unique_visitors bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint as total_visits,
         count(distinct visitor_id)::bigint as unique_visitors
  from public.site_visits;
$$;