DROP INDEX public.email_subscriptions_email_idx;
ALTER TABLE public.email_subscriptions ADD COLUMN request_hash text;
CREATE INDEX email_subscriptions_request_idx ON public.email_subscriptions(request_hash, created_at);
COMMENT ON TABLE public.email_subscriptions IS 'Private email subscriptions accessed only by validated server endpoints and unguessable management tokens; multiple devices may subscribe independently.';