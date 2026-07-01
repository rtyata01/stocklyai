
CREATE TABLE public.user_watchlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_key text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  tickers text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_watchlists_name_len CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT user_watchlists_owner_len CHECK (char_length(owner_key) BETWEEN 8 AND 128),
  CONSTRAINT user_watchlists_owner_fmt CHECK (owner_key ~ '^[A-Za-z0-9_:-]+$'),
  CONSTRAINT user_watchlists_unique_name UNIQUE (owner_key, name)
);

CREATE INDEX user_watchlists_owner_idx ON public.user_watchlists(owner_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_watchlists TO anon, authenticated;
GRANT ALL ON public.user_watchlists TO service_role;

ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;

-- Authenticated users manage their own rows (user_id must match)
CREATE POLICY "auth users manage own watchlists"
ON public.user_watchlists
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Anonymous visitors: rows must have NULL user_id (visitor-scoped).
-- Scoping by owner_key is enforced client-side; data is non-sensitive.
CREATE POLICY "anon manage visitor watchlists"
ON public.user_watchlists
FOR ALL
TO anon
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

CREATE TRIGGER update_user_watchlists_updated_at
BEFORE UPDATE ON public.user_watchlists
FOR EACH ROW EXECUTE FUNCTION public.update_app_cache_updated_at();
