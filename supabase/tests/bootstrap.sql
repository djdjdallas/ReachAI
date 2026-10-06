-- Minimal stand-in for the Supabase/prod schema the DB tests need: the
-- browser roles, auth.uid(), Supabase's default privileges (EXECUTE and
-- table grants to anon/authenticated), messages/conversations with prod's
-- columns and RLS policies, and stubs of the SECURITY DEFINER functions
-- with prod's signatures. Not a full schema dump; extend as tests need.
-- Used by supabase/tests/run.sh on a throwaway database.

do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $f$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $f$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase's defaults: new functions/tables in public are granted to the browser roles
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create table public.users (id uuid primary key);
create function public.update_updated_at() returns trigger language plpgsql as $f$ begin new.updated_at = now(); return new; end $f$;
insert into public.users (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
create table public.conversations (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text, dm_counted_at timestamptz, updated_at timestamptz default now());
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id), role text not null, content text not null, created_at timestamptz default now(), provider_message_id text, source text not null default 'agent');
alter table public.conversations enable row level security; alter table public.messages enable row level security;
create policy c_sel on public.conversations for select using (auth.uid()=user_id);
create policy c_ins on public.conversations for insert with check (auth.uid()=user_id);
create policy c_upd on public.conversations for update using (auth.uid()=user_id);
create policy m_sel on public.messages for select using (exists (select 1 from public.conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy m_ins on public.messages for insert with check (exists (select 1 from public.conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy m_upd on public.messages for update using (exists (select 1 from public.conversations c where c.id=conversation_id and c.user_id=auth.uid()));
-- Stubs of the SECURITY DEFINER functions (prod signatures)
create function public.check_and_record_outbound(uid uuid) returns int language sql security definer as 'select 1';
create function public.check_ai_rate(uid uuid, ep text, max_per_hour integer) returns bool language sql security definer as 'select true';
create function public.increment_dm_count(uid uuid) returns int language sql security definer as 'select 1';
create function public.claim_due_drips(batch_size integer) returns int language sql security definer as 'select 1';
create function public.increment_drip_send_count(template_id uuid) returns void language sql security definer as '';
create function public.increment_voice_send_count(snippet_id uuid) returns void language sql security definer as '';
create function public.purge_closed_conversation_data() returns void language sql security definer as '';
create function public.purge_old_comment_data() returns void language sql security definer as '';
create function public.handle_new_user() returns trigger language plpgsql security definer as 'begin return new; end';
insert into public.conversations (id, user_id) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111');
insert into public.messages (id, conversation_id, role, content, source) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','user','hi','lead'), ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','assistant','yo','manual');
