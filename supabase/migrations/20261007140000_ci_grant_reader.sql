-- ci_grant_reader: the login CI uses for the live SECURITY DEFINER grant
-- check (.github/workflows/db-checks.yml), instead of the service-role key.
--
-- Run any time after 20261007120000 (it grants EXECUTE on that file's
-- browser_executable_definer_functions()).
--
-- What it can do: log in and read the system catalogs. pg_proc,
-- pg_namespace, pg_roles and information_schema are readable by every
-- role in Postgres; has_function_privilege() can be asked about any role.
-- The one grant below is EXECUTE on the SECURITY INVOKER function that
-- packages that catalog query, so the check's SQL lives in one migration.
--
-- What it can't do: no table grants of any kind (none to PUBLIC in public
-- either; the only PUBLIC table grant in the database is
-- extensions.pg_stat_statements, which shows non-privileged roles only
-- their own queries). No usage on auth, storage, vault or cron. Cannot
-- call the definer functions (revoked from PUBLIC in 20261007120000).
-- Not inheriting, not bypassing RLS, cannot create roles or databases.
-- Also read-only transactions by default, 15s statement timeout, 2
-- connections. Read-only is a default the role could switch off itself, so
-- it's a seatbelt, not the boundary; the boundary is that the role holds no
-- privileges to write (or read) anything (supabase/tests/run.sh checks
-- both with read-only switched off).
--
-- NO PASSWORD IN THIS FILE. The role can't log in until Dom sets one by
-- hand (see the PR's deploy checklist): generate it locally, set it with
-- psql's \password (sends a SCRAM hash, so the plaintext never appears in
-- a SQL statement or query log), and store the pooler connection string
-- as the GitHub secret SUPABASE_CI_DB_URL.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ci_grant_reader') then
    create role ci_grant_reader
      login
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls
      connection limit 2;
  end if;
end;
$$;

alter role ci_grant_reader set default_transaction_read_only = on;
alter role ci_grant_reader set statement_timeout = '15s';

-- PUBLIC already has USAGE on schema public; explicit so the function
-- below stays reachable if that is ever tightened.
grant usage on schema public to ci_grant_reader;
grant execute on function public.browser_executable_definer_functions() to ci_grant_reader;

-- Verify after running:
--   select rolname, rolcanlogin, rolinherit, rolbypassrls, rolconnlimit, rolconfig
--     from pg_roles where rolname = 'ci_grant_reader';
--   select count(*) from information_schema.role_table_grants
--    where grantee = 'ci_grant_reader';                                    -- 0
