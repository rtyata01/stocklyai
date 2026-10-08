CREATE TABLE public.email_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL CHECK (char_length(email) <= 255),
 management_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 tickers text[] NOT NULL DEFAULT '{}',
 label text NOT NULL DEFAULT 'Portfolio',
 subscribed boolean NOT NULL DEFAULT true,
 last_digest_date date,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_subscriptions TO service_role;
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX email_subscriptions_email_idx ON public.email_subscriptions (lower(email));
CREATE TABLE public.price_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subscription_id uuid NOT NULL REFERENCES public.email_subscriptions(id) ON DELETE CASCADE,
 ticker text NOT NULL CHECK (ticker ~ '^[A-Z0-9][A-Z0-9.^=-]{0,14}$'),
 direction text NOT NULL CHECK (direction IN ('above','below')),
 target_price numeric NOT NULL CHECK (target_price > 0 AND target_price <= 10000000),
 last_price numeric,
 triggered_at timestamptz,
 delivered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.price_alerts TO service_role;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX price_alerts_pending_idx ON public.price_alerts(subscription_id) WHERE delivered_at IS NULL;
CREATE TABLE public.email_job_config (id boolean PRIMARY KEY DEFAULT true CHECK(id), callback_token uuid NOT NULL DEFAULT gen_random_uuid());
GRANT ALL ON public.email_job_config TO service_role;
ALTER TABLE public.email_job_config ENABLE ROW LEVEL SECURITY;