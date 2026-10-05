-- Stripe webhook idempotency (run IMMEDIATELY BEFORE DEPLOY, right after
-- 20261006130000; see the deploy checklist in the PR).
--
-- One row per Stripe event id the webhook has claimed.
--
--   status 'processing': a handler run owns the event. Set on claim.
--   status 'done':       processed. A redelivery is acknowledged (200)
--                        without re-processing, so founder alerts, dunning
--                        emails and drip enrollment can't double-send.
--
-- A run that fails deletes its claim so Stripe's retry processes the event
-- again. A run that dies without cleaning up (function timeout, crash)
-- leaves 'processing' behind; a retry may take that claim over once
-- claimed_at is older than 5 minutes (STALE_CLAIM_MS in the webhook). A
-- redelivery that finds a FRESH 'processing' claim gets a 409, so Stripe
-- retries later instead of the event being marked delivered while the
-- first run may still fail.
--
-- Server-only (service role): RLS on, no policies, no browser grants.
-- Small (a few rows per subscription per month). If the code deploys
-- before this exists, the webhook logs and processes events without
-- dedupe rather than failing.

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'done')),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  received_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Stripe event ids the webhook has claimed (idempotency): processing, then done. Server-only.';

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
