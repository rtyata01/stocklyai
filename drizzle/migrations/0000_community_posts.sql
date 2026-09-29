CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Investor',
  author_avatar text,
  ticker text NOT NULL,
  content text NOT NULL,
  like_count int NOT NULL DEFAULT 0,
  repost_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticker_fmt CHECK (ticker ~ '^[A-Z0-9.\-]{1,10}$'),
  CONSTRAINT content_len CHECK (char_length(content) BETWEEN 1 AND 500)
);
CREATE INDEX ON public.community_posts (ticker, created_at DESC);
CREATE INDEX ON public.community_posts (created_at DESC);
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read posts" ON public.community_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert own posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND like_count = 0 AND repost_count = 0 AND comment_count = 0);
CREATE POLICY "delete own posts" ON public.community_posts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.community_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.community_reposts (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Investor',
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.community_comments (post_id, created_at);

GRANT SELECT ON public.community_likes, public.community_reposts, public.community_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.community_likes, public.community_reposts, public.community_comments TO authenticated;
GRANT ALL ON public.community_likes, public.community_reposts, public.community_comments TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read likes" ON public.community_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own likes ins" ON public.community_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own likes del" ON public.community_likes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "read reposts" ON public.community_reposts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own reposts ins" ON public.community_reposts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own reposts del" ON public.community_reposts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "read comments" ON public.community_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "own comments ins" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own comments del" ON public.community_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.community_bump_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
DECLARE pid uuid := COALESCE(NEW.post_id, OLD.post_id);
BEGIN
  IF TG_TABLE_NAME = 'community_likes' THEN
    UPDATE community_posts SET like_count = GREATEST(0, like_count + d) WHERE id = pid;
  ELSIF TG_TABLE_NAME = 'community_reposts' THEN
    UPDATE community_posts SET repost_count = GREATEST(0, repost_count + d) WHERE id = pid;
  ELSE
    UPDATE community_posts SET comment_count = GREATEST(0, comment_count + d) WHERE id = pid;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_likes_count AFTER INSERT OR DELETE ON public.community_likes FOR EACH ROW EXECUTE FUNCTION public.community_bump_counts();
CREATE TRIGGER trg_reposts_count AFTER INSERT OR DELETE ON public.community_reposts FOR EACH ROW EXECUTE FUNCTION public.community_bump_counts();
CREATE TRIGGER trg_comments_count AFTER INSERT OR DELETE ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.community_bump_counts();