-- Outbound webhooks: the lead_updated event.
--
-- Live testing found treatment_interest saved to lead_profiles on an
-- inbound DM with nothing sent: the receiver only learned it if a later
-- lifecycle event happened to carry the lead. lead_updated (no stage
-- meaning) fires when treatment_interest goes from null to a value, keyed
-- 'lead_updated:<conversation id>:treatment:<key>'. The body is the normal
-- envelope with the current lead fields and data {}.
--
-- Run manually, BEFORE the deploy that ships the code: the new code's
-- default event list includes lead_updated, which the old check constraint
-- rejects (creating a webhook would fail). Running it early changes no
-- behavior for existing webhooks: their event_types arrays are untouched,
-- so they receive lead_updated only once an admin adds it (runbook:
-- `outbound-webhooks.mjs events ...`).
--
-- Re-runnable. Short locks on outbound_webhooks, outbound_webhook_events
-- and lead_profiles; gives up after 3 seconds instead of queueing traffic.
-- On "canceling statement due to lock timeout", just run it again.

set lock_timeout = '3s';

-- ── Event type lists ─────────────────────────────────────────────────────

alter table public.outbound_webhooks
  drop constraint if exists outbound_webhooks_event_types_check;
alter table public.outbound_webhooks
  add constraint outbound_webhooks_event_types_check check (event_types <@ array[
    'new_inquiry','dm_started','contact_captured','booking_link_sent',
    'consultation_booked','follow_up_sent','handoff_requested','lead_updated','test'
  ]::text[]);
alter table public.outbound_webhooks
  alter column event_types set default array[
    'new_inquiry','dm_started','contact_captured','booking_link_sent',
    'consultation_booked','follow_up_sent','handoff_requested','lead_updated'
  ]::text[];

alter table public.outbound_webhook_events
  drop constraint if exists outbound_webhook_events_event_type_check;
alter table public.outbound_webhook_events
  add constraint outbound_webhook_events_event_type_check check (event_type in (
    'new_inquiry','dm_started','contact_captured','booking_link_sent',
    'consultation_booked','follow_up_sent','handoff_requested','lead_updated','test'));

-- ── Trigger ──────────────────────────────────────────────────────────────

-- contact_captured: a new validated email or phone on a lead profile. Keyed
-- on the value's hash, so a changed value emits again and a repeated one
-- never does; capped at 6 per conversation.
-- lead_updated: treatment_interest goes from null to a value (on insert, or
-- an update that fills it). Keyed on the category key; not subject to the
-- contact cap.
create or replace function public.outbound_on_lead_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  begin
    if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                current_setting('request.jwt.claim.role', true), '') in ('authenticated', 'anon') then
      return null;
    end if;
    if new.treatment_interest is not null
       and (tg_op = 'INSERT' or old.treatment_interest is null) then
      perform public.outbound_emit(new.user_id, 'lead_updated',
        'lead_updated:' || new.conversation_id || ':treatment:' || new.treatment_interest,
        new.conversation_id, null, '{}'::jsonb);
    end if;
    select count(*) into v_count from public.outbound_webhook_events e
     where e.conversation_id = new.conversation_id and e.event_type = 'contact_captured';
    if v_count >= 6 then
      return null;
    end if;
    if new.email is not null and (tg_op = 'INSERT' or new.email is distinct from old.email) then
      perform public.outbound_emit(new.user_id, 'contact_captured',
        'contact_captured:' || new.conversation_id || ':email:' || left(encode(sha256(convert_to(new.email, 'UTF8')), 'hex'), 16),
        new.conversation_id, null, '{}'::jsonb);
    end if;
    if new.phone is not null and (tg_op = 'INSERT' or new.phone is distinct from old.phone) then
      perform public.outbound_emit(new.user_id, 'contact_captured',
        'contact_captured:' || new.conversation_id || ':phone:' || left(encode(sha256(convert_to(new.phone, 'UTF8')), 'hex'), 16),
        new.conversation_id, null, '{}'::jsonb);
    end if;
  exception when others then
    begin
      perform public.outbound_note_emit_failure(new.user_id, 'lead_profile', sqlstate, sqlerrm);
    exception when others then
      raise warning 'outbound webhook emit failed: %', sqlerrm;
    end;
  end;
  return null;
end;
$$;

drop trigger if exists outbound_on_lead_profile on public.lead_profiles;
create trigger outbound_on_lead_profile
  after insert or update of email, phone, treatment_interest on public.lead_profiles
  for each row execute function public.outbound_on_lead_profile();

revoke execute on function public.outbound_on_lead_profile() from public, anon, authenticated;
