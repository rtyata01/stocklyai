create table public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  created_at timestamptz not null default now()
);
create index site_visits_visitor_id_idx on public.site_visits(visitor_id);
alter table public.site_visits enable row level security;
create policy "Anyone can insert visit" on public.site_visits for insert to anon, authenticated with check (true);
create policy "Anyone can read visits" on public.site_visits for select to anon, authenticated using (true);