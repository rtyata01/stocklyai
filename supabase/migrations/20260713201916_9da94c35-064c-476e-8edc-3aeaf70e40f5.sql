DROP POLICY IF EXISTS "anon manage visitor watchlists" ON public.user_watchlists;

-- Anonymous visitors can no longer read or modify watchlists directly.
-- Only authenticated users can access their own watchlists.
-- The existing "auth users manage own watchlists" policy remains in place.
REVOKE ALL ON public.user_watchlists FROM anon;