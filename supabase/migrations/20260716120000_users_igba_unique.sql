-- Unique IGBA per user row (identity hardening)
--
-- Root weakness behind the July 14 incidents: nothing enforced the
-- one-to-one relationship between a users row and its
-- instagram_business_account_id, so a stale swap could leave the same IGBA
-- on two rows and every webhook resolver for it began erroring
-- (PGRST116). Live SQL confirmed no duplicates currently exist, so no
-- dedupe step is needed — but the guard below re-verifies at migration
-- time and ABORTS loudly if duplicates reappeared between verification
-- and deploy, instead of letting the index creation error cryptically.
--
-- DEPLOY ORDER: this migration must run LAST, after the app deploy that
-- ships the OAuth callback's IGBA-change guard and its 23505
-- (unique-violation) handler. Under the PREVIOUS callback code the save
-- error was silently ignored: a 23505 here would have produced a fake
-- success — success redirect, tokens unsaved, webhook subscription still
-- made for an IGBA mapped to another user's row. The new handler turns
-- that into a friendly "already connected to another Clinchd account"
-- message and skips the subscription.

do $$
declare dup_count int;
begin
  select count(*) into dup_count from (
    select instagram_business_account_id from public.users
    where instagram_business_account_id is not null
    group by instagram_business_account_id having count(*) > 1
  ) d;
  if dup_count > 0 then
    raise exception 'Aborting: % duplicate IGBA group(s) exist; resolve before adding unique index', dup_count;
  end if;
end $$;

create unique index if not exists users_igba_unique
  on public.users (instagram_business_account_id)
  where instagram_business_account_id is not null;

comment on index users_igba_unique is
  'One users row per Instagram business account. Partial (NULL allowed for disconnected rows). The OAuth callback catches 23505 from this index and surfaces a friendly "already connected to another Clinchd account" message.';
