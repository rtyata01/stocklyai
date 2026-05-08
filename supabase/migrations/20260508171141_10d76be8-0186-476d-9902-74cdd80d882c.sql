-- Dedupe pre-existing rows so the unique index can be created
DELETE FROM public.site_visits a
USING public.site_visits b
WHERE a.ctid < b.ctid
  AND a.visitor_id = b.visitor_id
  AND ((a.created_at AT TIME ZONE 'UTC')::date) = ((b.created_at AT TIME ZONE 'UTC')::date);

DROP POLICY IF EXISTS "Anyone can read visits" ON public.site_visits;

DROP POLICY IF EXISTS "Anyone can insert visit" ON public.site_visits;
CREATE POLICY "Anyone can insert valid visit"
  ON public.site_visits
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    visitor_id IS NOT NULL
    AND char_length(visitor_id) BETWEEN 8 AND 64
    AND visitor_id ~ '^[A-Za-z0-9_-]+$'
  );

CREATE UNIQUE INDEX IF NOT EXISTS site_visits_visitor_day_unique
  ON public.site_visits (visitor_id, ((created_at AT TIME ZONE 'UTC')::date));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stock_news'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.stock_news';
  END IF;
END $$;