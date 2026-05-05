
CREATE TABLE public.app_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_cache_expires_at ON public.app_cache(expires_at);

ALTER TABLE public.app_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cache"
  ON public.app_cache FOR SELECT
  USING (true);

CREATE POLICY "Only service role can insert cache"
  ON public.app_cache FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update cache"
  ON public.app_cache FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete cache"
  ON public.app_cache FOR DELETE
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.update_app_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_app_cache_updated_at
  BEFORE UPDATE ON public.app_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_cache_updated_at();
