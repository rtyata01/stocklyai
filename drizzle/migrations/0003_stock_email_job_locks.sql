CREATE TABLE public.stock_email_job_locks (job_name text PRIMARY KEY, locked_until timestamptz NOT NULL);
GRANT ALL ON public.stock_email_job_locks TO service_role;
ALTER TABLE public.stock_email_job_locks ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_stock_email_job(job_name text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed text;
BEGIN
 INSERT INTO public.stock_email_job_locks(job_name, locked_until) VALUES (job_name, now() + interval '10 minutes')
 ON CONFLICT ON CONSTRAINT stock_email_job_locks_pkey DO UPDATE SET locked_until = now() + interval '10 minutes'
 WHERE stock_email_job_locks.locked_until < now() RETURNING stock_email_job_locks.job_name INTO claimed;
 RETURN claimed IS NOT NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.release_stock_email_job(job_name text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.stock_email_job_locks SET locked_until = now() WHERE stock_email_job_locks.job_name = $1;
$$;
REVOKE ALL ON FUNCTION public.claim_stock_email_job(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stock_email_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stock_email_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stock_email_job(text) TO service_role;