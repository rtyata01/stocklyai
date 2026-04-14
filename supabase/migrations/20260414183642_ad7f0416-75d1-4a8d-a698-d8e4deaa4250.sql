
DROP POLICY "Service role can insert news" ON public.stock_news;
DROP POLICY "Service role can delete news" ON public.stock_news;

CREATE POLICY "Only service role can insert news"
  ON public.stock_news FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete news"
  ON public.stock_news FOR DELETE
  USING (auth.role() = 'service_role');
