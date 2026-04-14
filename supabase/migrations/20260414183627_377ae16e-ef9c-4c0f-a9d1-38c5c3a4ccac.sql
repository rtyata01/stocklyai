
CREATE TABLE public.stock_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT,
  source_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_fda_related BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stock news"
  ON public.stock_news FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert news"
  ON public.stock_news FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete news"
  ON public.stock_news FOR DELETE
  USING (true);

CREATE INDEX idx_stock_news_ticker ON public.stock_news(ticker);
CREATE INDEX idx_stock_news_published ON public.stock_news(published_at DESC);
CREATE INDEX idx_stock_news_fda ON public.stock_news(is_fda_related) WHERE is_fda_related = true;

ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_news;
