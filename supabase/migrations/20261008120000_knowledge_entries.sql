-- Business knowledge base, PR A (docs/clinchd-internal-log.md, "Business
-- knowledge base"). One row per FAQ / policy / note the AI may state to
-- leads. Every enabled row goes into the reply system prompt inside a
-- <business_knowledge> block (src/lib/knowledge/format.js). No RAG.
--
-- Run before the deploy: the reply paths read this table on every reply
-- (a missing table only logs a warning and replies without knowledge, so a
-- late run degrades, it doesn't break). Re-runnable.
--
-- Access:
--   - Browser roles may READ their own rows (RLS) and nothing else. All
--     writes go through /api/settings/knowledge with the service role, which
--     trims, validates, and enforces the 15,000-character per-account cap
--     (src/lib/knowledge/limits.js). A direct browser write could skip the
--     cap, so insert/update/delete are revoked, not just left without a
--     policy.
--   - No functions are created, so nothing new is browser-callable.
--
-- Per-field CHECKs mirror QUESTION_MAX / ANSWER_MAX in limits.js. The
-- per-account total is enforced server-side (route) and again when the
-- prompt is built (format.js cuts off at the cap), not here.

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null default 'faq',
  question text not null default '',
  answer text not null default '',
  enabled boolean not null default false,
  sort integer not null default 0,
  -- "<vertical>:<key>" for rows created from a starter template
  -- (src/lib/knowledge/templates.js), null otherwise. Unique per user, so a
  -- double click or a second "Add starter" can't duplicate drafts. NULLs
  -- don't collide, so hand-written entries are unaffected.
  template_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_entries_type_check check (type in ('faq', 'policy', 'note')),
  constraint knowledge_entries_question_len check (char_length(question) <= 300),
  constraint knowledge_entries_answer_len check (char_length(answer) <= 2000),
  constraint knowledge_entries_sort_range check (sort between 0 and 10000),
  constraint knowledge_entries_template_key_len check (char_length(template_key) <= 100),
  constraint knowledge_entries_user_template_key unique (user_id, template_key),
  -- Drafts (disabled) may be empty; an enabled entry must say something.
  constraint knowledge_entries_enabled_has_answer
    check (not enabled or char_length(btrim(answer)) > 0)
);

create index if not exists idx_knowledge_entries_user_sort
  on public.knowledge_entries (user_id, sort);

alter table public.knowledge_entries enable row level security;

drop policy if exists "knowledge_entries_select_own" on public.knowledge_entries;
create policy "knowledge_entries_select_own"
  on public.knowledge_entries for select
  using (auth.uid() = user_id);

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Take the writes back; reads stay (filtered by the policy).
revoke insert, update, delete, truncate on public.knowledge_entries from anon, authenticated;
revoke all on public.knowledge_entries from anon;
grant select on public.knowledge_entries to authenticated;

drop trigger if exists update_knowledge_entries_updated_at on public.knowledge_entries;
create trigger update_knowledge_entries_updated_at
  before update on public.knowledge_entries
  for each row execute function public.update_updated_at();

comment on table public.knowledge_entries is
  'Business knowledge (FAQs, policies, notes) the reply AI may state to leads. Browser: read own rows only; writes via /api/settings/knowledge (service role).';
