-- SECURITY DEFINER functions are server-only.
--
-- RECORD OF A PROD CHANGE (audit H1, 2026-10-06): the EXECUTE revokes below
-- were applied directly in production before this file existed. This file
-- makes the repo match prod; re-running it is a no-op for those functions.
--
-- These functions run with the owner's rights and bypass RLS. Postgres
-- grants EXECUTE to PUBLIC by default and Supabase's default privileges
-- grant it to anon and authenticated, so every one of them was callable
-- from the browser through PostgREST (/rest/v1/rpc/<name>): a signed-in
-- coach could, for example, burn another coach's DM quota with
-- increment_dm_count(uid) or run the purge jobs. Only the server (service
-- role) calls them.
--
-- NEW in this file (not yet in prod when it was written):
--   1. handle_new_user: the auth.users trigger function. Not callable
--      directly (trigger functions refuse a plain call), revoked for a clean
--      check. Triggers do not need EXECUTE at fire time, so signup is
--      unaffected.
--   2. Default privileges, so a function added by a future migration is not
--      browser-callable unless that migration grants it explicitly.
--
-- Guarded by scripts/check-definer-grants.mjs, which fails if any SECURITY
-- DEFINER function in public is executable by anon or authenticated
-- without an allowlist entry.

-- 1. Revokes (prod already matches for the first eight) ----------------------

revoke execute on function public.check_and_record_outbound(uuid) from public, anon, authenticated;
revoke execute on function public.check_ai_rate(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.increment_dm_count(uuid) from public, anon, authenticated;
revoke execute on function public.claim_due_drips(integer) from public, anon, authenticated;
revoke execute on function public.increment_drip_send_count(uuid) from public, anon, authenticated;
revoke execute on function public.increment_voice_send_count(uuid) from public, anon, authenticated;
revoke execute on function public.purge_closed_conversation_data() from public, anon, authenticated;
revoke execute on function public.purge_old_comment_data() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- The server keeps access. service_role already holds EXECUTE in prod; the
-- grants make that explicit so it survives the default-privilege change.
grant execute on function public.check_and_record_outbound(uuid) to service_role;
grant execute on function public.check_ai_rate(uuid, text, integer) to service_role;
grant execute on function public.increment_dm_count(uuid) to service_role;
grant execute on function public.claim_due_drips(integer) to service_role;
grant execute on function public.increment_drip_send_count(uuid) to service_role;
grant execute on function public.increment_voice_send_count(uuid) to service_role;
grant execute on function public.purge_closed_conversation_data() to service_role;
grant execute on function public.purge_old_comment_data() to service_role;

-- 2. Default privileges for future functions ----------------------------------
--
-- Applies to functions created by the role running this file (postgres,
-- the role migrations run as in the SQL editor).
--
-- The schema-scoped statement removes the anon/authenticated grants that
-- Supabase's per-schema defaults add. It cannot remove PUBLIC's EXECUTE:
-- that one is a built-in global default, and per-schema defaults only add
-- to it. The second statement (no IN SCHEMA) removes it. Without both, a
-- new function stays callable by anon through PUBLIC.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges revoke execute on functions from public;

-- A new function that the browser must call needs an explicit grant in
-- its migration, e.g.
--   grant execute on function public.my_fn(uuid) to authenticated;
-- plus an allowlist entry in scripts/definer-grants-allowlist.json if it
-- is SECURITY DEFINER.

-- 3. Function the grant check calls --------------------------------------------
--
-- Lists every SECURITY DEFINER function in public that anon or
-- authenticated can execute (directly or through PUBLIC). Plain SECURITY
-- INVOKER read of the catalogs; service_role only.
create or replace function public.browser_executable_definer_functions()
returns table (signature text, anon_can_execute boolean, authenticated_can_execute boolean)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  order by 1;
$$;

revoke execute on function public.browser_executable_definer_functions() from public, anon, authenticated;
grant execute on function public.browser_executable_definer_functions() to service_role;

-- Verify after running (both should return no rows):
--   select * from public.browser_executable_definer_functions();
--   select pg_get_userbyid(defaclrole), defaclnamespace::regnamespace, defaclacl
--     from pg_default_acl
--    where defaclobjtype = 'f' and pg_get_userbyid(defaclrole) = 'postgres'
--      and (defaclacl::text like '%anon=X%' or defaclacl::text like '%authenticated=X%');
