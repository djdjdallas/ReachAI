#!/bin/bash
# Database regression tests (audit H1, M1, L7, M2). Builds a throwaway
# database from bootstrap.sql, applies the real migration files under test
# (twice, to prove they re-run cleanly), then asserts browser vs server
# behavior. Exits non-zero on any mismatch.
#
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/tests/run.sh
#
# Never point this at production: it creates and drops a database named
# clinchd_dbtest.
set -uo pipefail
cd "$(dirname "$0")"
DB=clinchd_dbtest
M=../migrations
MIGRATIONS=(
  20261006140000_stripe_webhook_events.sql
  20261007120000_revoke_definer_execute.sql
  20261007130000_protect_lead_messages.sql
  20261007140000_ci_grant_reader.sql
  20261008120000_knowledge_entries.sql
  20261009120000_outbound_webhooks.sql
  20261010120000_outbound_lead_updated.sql
)
psql_() { psql -X -v ON_ERROR_STOP=1 -q "$@"; }

psql_ -d postgres -c "drop database if exists $DB" -c "create database $DB" || exit 1
psql_ -d $DB -f bootstrap.sql || exit 1
for pass in 1 2; do
  for f in "${MIGRATIONS[@]}"; do
    psql_ -d $DB -f "$M/$f" 2>&1 | grep -v NOTICE
    [ "${PIPESTATUS[0]}" -eq 0 ] || { echo "FAIL: $f (pass $pass)"; exit 1; }
  done
done

fails=0
q() { psql -X -d $DB -tA -c "$1" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK)$' | head -1; }
as_role() { # role sql
  q "begin; set local role $1; set local request.jwt.claims = '{\"role\":\"$1\",\"sub\":\"11111111-1111-1111-1111-111111111111\"}'; $2; rollback;"
}
expect() { # label expected-substring actual
  if [[ "$3" == *"$2"* ]]; then printf "ok    %s\n" "$1"; else printf "FAIL  %s\n      expected: %s\n      got:      %s\n" "$1" "$2" "$3"; fails=$((fails+1)); fi
}
C=aaaaaaaa-0000-0000-0000-000000000001; L=bbbbbbbb-0000-0000-0000-000000000001; A=bbbbbbbb-0000-0000-0000-000000000002
DENY_LEAD="lead messages are written by the server only"
DENY_TS="created_at is set by the server"
DENY_DM="dm_counted_at is written by the server only"

echo "# M1: browser writes to messages"
expect "manual message insert works" "INSERT 0 1" "$(as_role authenticated "insert into public.messages(conversation_id,role,content,source) values ('$C','assistant','hey','manual')")"
expect "its created_at is the server's now()" "t" "$(as_role authenticated "insert into public.messages(conversation_id,role,content,source) values ('$C','assistant','hey','manual') returning (created_at = now())")"
expect "edit own manual message" "UPDATE 1" "$(as_role authenticated "update public.messages set content='edited' where id='$A'")"
expect "insert role=user rejected" "$DENY_LEAD" "$(as_role authenticated "insert into public.messages(conversation_id,role,content,source) values ('$C','user','fake','manual')")"
expect "insert source=lead rejected" "$DENY_LEAD" "$(as_role authenticated "insert into public.messages(conversation_id,role,content,source) values ('$C','assistant','fake','lead')")"
expect "insert explicit created_at rejected" "$DENY_TS" "$(as_role authenticated "insert into public.messages(conversation_id,role,content,source,created_at) values ('$C','assistant','x','manual', now() - interval '1 hour')")"
expect "edit a lead message rejected" "$DENY_LEAD" "$(as_role authenticated "update public.messages set content='rewritten' where id='$L'")"
expect "turn a message into a lead message rejected" "$DENY_LEAD" "$(as_role authenticated "update public.messages set role='user', source='lead' where id='$A'")"
expect "move created_at rejected" "$DENY_TS" "$(as_role authenticated "update public.messages set created_at=now() where id='$A'")"
expect "anon lead insert rejected" "$DENY_LEAD" "$(as_role anon "insert into public.messages(conversation_id,role,content,source) values ('$C','user','fake','lead')")"
expect "service role: lead message with created_at" "INSERT 0 1" "$(as_role service_role "insert into public.messages(conversation_id,role,content,source,created_at) values ('$C','user','hi','lead', now() - interval '1 hour')")"
expect "service role: update lead message" "UPDATE 1" "$(as_role service_role "update public.messages set provider_message_id='mid' where id='$L'")"

echo "# L7: conversations.dm_counted_at"
expect "browser sets dm_counted_at rejected" "$DENY_DM" "$(as_role authenticated "update public.conversations set dm_counted_at=now() + interval '40 days' where id='$C'")"
expect "browser inserts with dm_counted_at rejected" "$DENY_DM" "$(as_role authenticated "insert into public.conversations(user_id,dm_counted_at) values ('11111111-1111-1111-1111-111111111111', now())")"
expect "browser status change works" "UPDATE 1" "$(as_role authenticated "update public.conversations set status='booked' where id='$C'")"
expect "browser conversation insert works" "INSERT 0 1" "$(as_role authenticated "insert into public.conversations(user_id) values ('11111111-1111-1111-1111-111111111111')")"
expect "service role sets dm_counted_at" "UPDATE 1" "$(as_role service_role "update public.conversations set dm_counted_at=now() where id='$C'")"

echo "# H1: definer functions"
for fn in "check_and_record_outbound('11111111-1111-1111-1111-111111111111')" "increment_dm_count('11111111-1111-1111-1111-111111111111')" "claim_due_drips(1)" "purge_old_comment_data()" "purge_closed_conversation_data()"; do
  expect "anon cannot call $fn" "permission denied" "$(as_role anon "select public.$fn")"
  expect "authenticated cannot call $fn" "permission denied" "$(as_role authenticated "select public.$fn")"
done
expect "service role can call increment_dm_count" "1" "$(as_role service_role "select public.increment_dm_count('11111111-1111-1111-1111-111111111111')")"
expect "grant check lists nothing" "0" "$(as_role service_role "select count(*) from public.browser_executable_definer_functions()")"
q "create function public.zz_future_fn() returns int language sql security definer as 'select 1'" >/dev/null
expect "a NEW function is not browser-callable" "permission denied" "$(as_role authenticated "select public.zz_future_fn()")"
q "grant execute on function public.zz_future_fn() to authenticated" >/dev/null
expect "an explicit grant shows up in the check" "zz_future_fn() auth=true" "$(as_role service_role "select signature||' auth='||authenticated_can_execute from public.browser_executable_definer_functions()")"
q "drop function public.zz_future_fn()" >/dev/null

echo "# CI grant reader (logs in as the real role)"
# Test-only password on the throwaway cluster; prod's is set by hand.
psql_ -d $DB -c "alter role ci_grant_reader password 'ci-test-only'"
as_ci() { PGPASSWORD=ci-test-only psql -X -U ci_grant_reader -d $DB -tA -c "$1" 2>&1 | head -1; }
expect "ci: runs the grant check" "[]" "$(as_ci "select coalesce(json_agg(t), '[]') from public.browser_executable_definer_functions() t")"
expect "ci: check output passes the script" "OK: 0" "$(as_ci "select coalesce(json_agg(t), '[]') from public.browser_executable_definer_functions() t" | node ../../scripts/check-definer-grants.mjs 2>&1)"
expect "ci: cannot read messages" "permission denied" "$(as_ci "select count(*) from public.messages")"
expect "ci: cannot read stripe_webhook_events" "permission denied" "$(as_ci "select count(*) from public.stripe_webhook_events")"
expect "ci: cannot call a definer function" "permission denied" "$(as_ci "select public.increment_dm_count('11111111-1111-1111-1111-111111111111')")"
expect "ci: read-only session" "read-only transaction" "$(as_ci "create table public.ci_probe(x int)")"
# read-only is only a default the role can switch off; these prove the
# boundary holds without it.
as_ci_rw() { PGPASSWORD=ci-test-only psql -X -U ci_grant_reader -d $DB -tA -c "set transaction_read_only = off; $1" 2>&1 | grep -v '^SET$' | head -1; }
expect "ci (read-write): cannot create roles" "permission denied" "$(as_ci_rw "create role ci_probe2")"
expect "ci (read-write): cannot create tables in public" "permission denied" "$(as_ci_rw "create table public.ci_probe(x int)")"
expect "ci (read-write): cannot write messages" "permission denied" "$(as_ci_rw "delete from public.messages")"
expect "ci: reads catalogs" "t" "$(as_ci "select count(*) > 0 from pg_proc")"
expect "ci: no table grants at all" "0" "$(q "select count(*) from information_schema.role_table_grants where grantee = 'ci_grant_reader'")"

echo "# M2: stripe_webhook_events"
expect "claims start as processing" "processing" "$(as_role service_role "insert into public.stripe_webhook_events(event_id,event_type) values ('evt_1','x') returning status")"
expect "unknown status rejected" "violates check constraint" "$(as_role service_role "insert into public.stripe_webhook_events(event_id,event_type,status) values ('evt_2','x','weird')")"
expect "browser cannot read events" "permission denied" "$(as_role authenticated "select * from public.stripe_webhook_events")"

echo "# Knowledge base: knowledge_entries RLS"
U1=11111111-1111-1111-1111-111111111111; U2=22222222-2222-2222-2222-222222222222
q "insert into public.knowledge_entries(id,user_id,type,question,answer,enabled) values ('cccccccc-0000-0000-0000-000000000001','$U1','faq','Price?','\$300',true), ('cccccccc-0000-0000-0000-000000000002','$U2','faq','Hours?','9-5',true)" >/dev/null
expect "user reads own entries" "1" "$(as_role authenticated "select count(*) from public.knowledge_entries")"
expect "user cannot read another user's entry" "0" "$(as_role authenticated "select count(*) from public.knowledge_entries where user_id='$U2'")"
expect "user's visible entry is their own" "Price?" "$(as_role authenticated "select question from public.knowledge_entries")"
expect "browser insert rejected" "permission denied" "$(as_role authenticated "insert into public.knowledge_entries(user_id,question,answer) values ('$U1','q','a')")"
expect "browser update rejected" "permission denied" "$(as_role authenticated "update public.knowledge_entries set answer='x'")"
expect "browser delete rejected" "permission denied" "$(as_role authenticated "delete from public.knowledge_entries")"
expect "anon read rejected" "permission denied" "$(as_role anon "select count(*) from public.knowledge_entries")"
expect "service role insert works" "INSERT 0 1" "$(as_role service_role "insert into public.knowledge_entries(user_id,question,answer) values ('$U1','q','a')")"
expect "enabled entry with empty answer rejected" "knowledge_entries_enabled_has_answer" "$(as_role service_role "insert into public.knowledge_entries(user_id,question,answer,enabled) values ('$U1','q','  ',true)")"
expect "disabled empty draft allowed" "INSERT 0 1" "$(as_role service_role "insert into public.knowledge_entries(user_id,question,answer,enabled) values ('$U1','q','',false)")"
expect "question over 300 chars rejected" "knowledge_entries_question_len" "$(as_role service_role "insert into public.knowledge_entries(user_id,question,answer) values ('$U1',repeat('x',301),'a')")"
expect "answer over 2000 chars rejected" "knowledge_entries_answer_len" "$(as_role service_role "insert into public.knowledge_entries(user_id,question,answer) values ('$U1','q',repeat('x',2001))")"
expect "unknown type rejected" "knowledge_entries_type_check" "$(as_role service_role "insert into public.knowledge_entries(user_id,type,question,answer) values ('$U1','secret','q','a')")"
expect "template draft insert works" "INSERT 0 1" "$(as_role service_role "insert into public.knowledge_entries(user_id,template_key,question) values ('$U1','coaching:included','What is included?')")"
expect "same template key twice rejected" "knowledge_entries_user_template_key" "$(as_role service_role "insert into public.knowledge_entries(user_id,template_key,question) values ('$U1','coaching:included','a'), ('$U1','coaching:included','dup')")"
expect "the route's upsert skips a duplicate draft" "INSERT 0 2" "$(as_role service_role "insert into public.knowledge_entries(user_id,template_key,question) values ('$U1','coaching:refund','r'), ('$U1','coaching:refund','again'), ('$U1','coaching:faq2','f') on conflict (user_id, template_key) do nothing")"
expect "another user can use the same key" "INSERT 0 1" "$(as_role service_role "insert into public.knowledge_entries(user_id,template_key,question) values ('$U2','coaching:included','q')")"
expect "hand-written entries (null key) never collide" "INSERT 0 2" "$(as_role service_role "insert into public.knowledge_entries(user_id,question) values ('$U1','a'), ('$U1','b')")"
expect "updated_at moves on update" "t" "$(as_role service_role "update public.knowledge_entries set answer='\$350' where id='cccccccc-0000-0000-0000-000000000001' returning updated_at >= created_at")"

echo "# Outbound webhooks: config, outbox triggers, claim"
U1=11111111-1111-1111-1111-111111111111; U2=22222222-2222-2222-2222-222222222222
q "insert into public.outbound_webhooks(user_id,url,enabled,secret_encrypted) values ('$U1','https://hooks.example.com/in',true,'x:y:z')" >/dev/null
q "update public.users set calendly_url='https://calendly.com/sole/consult', booking_url='https://book.sole.example/now' where id='$U1'" >/dev/null
ev() { q "select count(*) from public.outbound_webhook_events where event_type='$1'${2:+ and $2}"; }
# Runs a whole transaction and prints the LAST line (for checks after a write).
q_last() { psql -X -d $DB -tA -c "$1" 2>&1 | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | tail -1; }
srv() { # sql as service role, committed
  q "begin; set local role service_role; set local request.jwt.claims = '{\"role\":\"service_role\"}'; $1; commit;"
}
expect "browser cannot read outbound_webhooks" "permission denied" "$(as_role authenticated "select * from public.outbound_webhooks")"
expect "browser cannot read the outbox" "permission denied" "$(as_role authenticated "select * from public.outbound_webhook_events")"
expect "browser cannot read lead_profiles" "permission denied" "$(as_role authenticated "select * from public.lead_profiles")"
expect "browser cannot read emit failures" "permission denied" "$(as_role authenticated "select * from public.outbound_webhook_emit_failures")"
expect "anon cannot read the outbox" "permission denied" "$(as_role anon "select * from public.outbound_webhook_events")"
expect "browser cannot set billing_managed" "server-managed columns are read-only" "$(as_role authenticated "update public.users set billing_managed=true where id='$U1'")"
expect "browser cannot set assistant_name" "server-managed columns are read-only" "$(as_role authenticated "update public.users set assistant_name='Sarah' where id='$U1'")"
expect "browser cannot set webhook_demo" "server-managed columns are read-only" "$(as_role authenticated "update public.users set webhook_demo=true where id='$U1'")"
expect "service role sets billing_managed" "UPDATE 1" "$(as_role service_role "update public.users set billing_managed=true where id='$U1'")"
expect "http webhook url rejected" "outbound_webhooks_url_check" "$(as_role service_role "insert into public.outbound_webhooks(user_id,url,secret_encrypted) values ('$U2','http://x.example','s')")"
expect "unknown event type in config rejected" "outbound_webhooks_event_types_check" "$(as_role service_role "insert into public.outbound_webhooks(user_id,url,secret_encrypted,event_types) values ('$U2','https://x.example','s','{lead_deleted}')")"
expect "browser cannot claim events" "permission denied" "$(as_role authenticated "select * from public.claim_outbound_webhook_events(10, 120)")"
expect "anon cannot claim events" "permission denied" "$(as_role anon "select * from public.claim_outbound_webhook_events(10, 120)")"

# new_inquiry
srv "insert into public.conversations(id,user_id,origin) values ('dddddddd-0000-0000-0000-000000000001','$U1','inbound')" >/dev/null
srv "insert into public.conversations(id,user_id,origin) values ('dddddddd-0000-0000-0000-000000000002','$U1','clinchd_sent')" >/dev/null
srv "insert into public.conversations(id,user_id,origin) values ('dddddddd-0000-0000-0000-000000000003','$U1','native_send')" >/dev/null
srv "insert into public.conversations(id,user_id,origin) values ('dddddddd-0000-0000-0000-000000000009','$U2','inbound')" >/dev/null
q "begin; set local role authenticated; set local request.jwt.claims = '{\"role\":\"authenticated\",\"sub\":\"$U1\"}'; insert into public.conversations(id,user_id,origin) values ('dddddddd-0000-0000-0000-000000000004','$U1','inbound'); commit;" >/dev/null
expect "new_inquiry for inbound and comment conversations only" "2" "$(ev new_inquiry)"
expect "no events for an account without a webhook" "0" "$(q "select count(*) from public.outbound_webhook_events where user_id='$U2'")"
expect "browser-created conversation emits nothing" "0" "$(ev new_inquiry "conversation_id='dddddddd-0000-0000-0000-000000000004'")"

# dm_started / booking_link_sent / follow_up_sent
C1=dddddddd-0000-0000-0000-000000000001; C2=dddddddd-0000-0000-0000-000000000002
srv "insert into public.messages(conversation_id,role,content,source) values ('$C1','assistant','hi there','agent')" >/dev/null
expect "unsent reply (no Meta id) emits nothing" "0" "$(ev dm_started)"
srv "update public.messages set provider_message_id='mid-1' where conversation_id='$C1' and content='hi there'" >/dev/null
expect "dm_started once the Meta id is stamped" "1" "$(ev dm_started)"
srv "insert into public.messages(conversation_id,role,content,source,provider_message_id) values ('$C1','assistant','grab a time: https://calendly.com/sole/consult/','agent','mid-2')" >/dev/null
expect "dm_started still once per conversation" "1" "$(ev dm_started)"
expect "booking_link_sent on the Calendly link" "1" "$(ev booking_link_sent)"
srv "insert into public.messages(conversation_id,role,content,source,provider_message_id) values ('$C2','assistant','Book here: HTTPS://Book.Sole.Example/now','agent','mid-3')" >/dev/null
expect "booking_link_sent on booking_url (case and scheme ignored)" "2" "$(ev booking_link_sent)"
srv "insert into public.messages(conversation_id,role,content,source,provider_message_id) values ('$C2','assistant','still keen?','drip','mid-4')" >/dev/null
expect "follow_up_sent for a delivered drip" "1" "$(ev follow_up_sent)"
srv "insert into public.messages(conversation_id,role,content,source,provider_message_id) values ('$C2','assistant','typed by staff','manual','mid-5')" >/dev/null
expect "staff-typed messages emit nothing new" "2" "$(ev dm_started)"
q "begin; set local role authenticated; set local request.jwt.claims = '{\"role\":\"authenticated\",\"sub\":\"$U1\"}'; insert into public.messages(conversation_id,role,content,source,provider_message_id) values ('$C2','assistant','https://calendly.com/sole/consult','drip','mid-6'); commit;" >/dev/null
expect "browser message insert emits nothing" "1" "$(ev follow_up_sent)"

# handoff_requested
srv "update public.conversations set ai_paused=true, ai_pause_reason='medical_question' where id='$C1'" >/dev/null
expect "handoff on medical pause" "medical_question" "$(q "select data->>'reason' from public.outbound_webhook_events where event_type='handoff_requested' and conversation_id='$C1'")"
srv "update public.conversations set ai_pause_reason='hostile_or_refund' where id='$C1'" >/dev/null
expect "no second event without a new false->true transition" "1" "$(ev handoff_requested)"
srv "update public.conversations set ai_paused=false where id='$C1'" >/dev/null
srv "update public.conversations set ai_paused=true, ai_pause_reason='complex_objection' where id='$C1'" >/dev/null
expect "a new pause cycle emits again, mapped to other" "other" "$(q "select data->>'reason' from public.outbound_webhook_events where event_type='handoff_requested' order by created_at desc, id limit 1")"
srv "update public.conversations set ai_paused=true, ai_pause_reason='human_took_over' where id='$C2'" >/dev/null
expect "human_took_over emits nothing" "0" "$(ev handoff_requested "conversation_id='$C2'")"
srv "update public.conversations set ai_paused=false where id='$C2'" >/dev/null
q "begin; set local role authenticated; set local request.jwt.claims = '{\"role\":\"authenticated\",\"sub\":\"$U1\"}'; update public.conversations set ai_paused=true, ai_pause_reason='medical_question' where id='$C2'; commit;" >/dev/null
expect "browser pause emits nothing" "0" "$(ev handoff_requested "conversation_id='$C2'")"

# consultation_booked
srv "insert into public.bookings(user_id,conversation_id,source,calendly_invitee_uri,start_time) values ('$U1','$C1','calendly','https://api.calendly.com/inv/1', now())" >/dev/null
expect "consultation_booked on a Calendly booking" "1" "$(ev consultation_booked)"
srv "update public.bookings set invitee_name='x' where calendly_invitee_uri='https://api.calendly.com/inv/1'" >/dev/null
expect "an upsert of the same booking does not re-emit" "1" "$(ev consultation_booked)"
srv "insert into public.bookings(user_id,conversation_id,source) values ('$U1','$C1','manual')" >/dev/null
expect "manual booking emits nothing" "1" "$(ev consultation_booked)"
q "begin; set local role authenticated; set local request.jwt.claims = '{\"role\":\"authenticated\",\"sub\":\"$U1\"}'; insert into public.bookings(user_id,source,calendly_invitee_uri) values ('$U1','calendly','https://forged'); commit;" >/dev/null
expect "browser-forged Calendly booking emits nothing" "1" "$(ev consultation_booked)"
srv "insert into public.bookings(user_id,source) values ('$U1','demo')" >/dev/null
expect "demo booking without webhook_demo emits nothing" "1" "$(ev consultation_booked)"
srv "update public.users set webhook_demo=true where id='$U1'" >/dev/null
srv "insert into public.bookings(user_id,source) values ('$U1','demo')" >/dev/null
expect "demo booking on a demo account carries demo=true" "true" "$(q "select data->>'demo' from public.outbound_webhook_events where event_type='consultation_booked' and data ? 'demo'")"

srv "update public.bookings set status='confirmed' where calendly_invitee_uri='https://api.calendly.com/inv/1'" >/dev/null
expect "re-confirming a booking already confirmed emits nothing" "2" "$(ev consultation_booked)"
srv "insert into public.bookings(id,user_id,conversation_id,source,calendly_invitee_uri,status) values ('ffffffff-0000-0000-0000-000000000001','$U1','$C2','calendly','https://api.calendly.com/inv/2','rescheduled')" >/dev/null
expect "a booking inserted unconfirmed emits nothing" "2" "$(ev consultation_booked)"
srv "update public.bookings set status='confirmed' where id='ffffffff-0000-0000-0000-000000000001'" >/dev/null
expect "an update that confirms it emits" "3" "$(ev consultation_booked)"
srv "update public.bookings set invitee_name='y', status='confirmed' where id='ffffffff-0000-0000-0000-000000000001'" >/dev/null
expect "later updates of a confirmed booking emit nothing" "3" "$(ev consultation_booked)"

# disclosed_at: server-only, claimed atomically
expect "browser cannot set disclosed_at" "disclosed_at is written by the server only" "$(as_role authenticated "update public.conversations set disclosed_at=now() where id='$C2'")"
expect "browser cannot insert with disclosed_at" "disclosed_at is written by the server only" "$(as_role authenticated "insert into public.conversations(user_id,disclosed_at) values ('$U1', now())")"
expect "first claim wins" "1" "$(q "begin; set local role service_role; set local request.jwt.claims = '{\"role\":\"service_role\"}'; with c as (update public.conversations set disclosed_at=now() where id='$C2' and disclosed_at is null returning id) select count(*) from c; commit;")"
expect "a second claim gets nothing" "0" "$(q "begin; set local role service_role; set local request.jwt.claims = '{\"role\":\"service_role\"}'; with c as (update public.conversations set disclosed_at=now() where id='$C2' and disclosed_at is null returning id) select count(*) from c; commit;")"
expect "browser cannot clear it either" "disclosed_at is written by the server only" "$(as_role authenticated "update public.conversations set disclosed_at=null where id='$C2'")"
expect "browser status updates still work" "UPDATE 1" "$(as_role authenticated "update public.conversations set status='qualifying' where id='$C2'")"

# contact_captured
srv "insert into public.lead_profiles(conversation_id,user_id,email) values ('$C1','$U1','jane@example.com')" >/dev/null
expect "contact_captured on a new email" "1" "$(ev contact_captured)"
srv "update public.lead_profiles set email='jane@example.com', treatment_interest='botox' where conversation_id='$C1'" >/dev/null
expect "same email again emits nothing" "1" "$(ev contact_captured)"
srv "update public.lead_profiles set phone='+15125550123' where conversation_id='$C1'" >/dev/null
expect "a phone emits once more" "2" "$(ev contact_captured)"
expect "bad phone rejected by the table" "lead_profiles_phone_check" "$(as_role service_role "update public.lead_profiles set phone='555-0123' where conversation_id='$C1'")"
expect "free-text treatment rejected by the table" "lead_profiles_treatment_interest_check" "$(as_role service_role "update public.lead_profiles set treatment_interest='I want botox for my migraines' where conversation_id='$C1'")"

# lead_updated: treatment_interest null -> value
expect "lead_updated when treatment is filled in" "lead_updated:$C1:treatment:botox" "$(q "select dedupe_key from public.outbound_webhook_events where event_type='lead_updated' and conversation_id='$C1'")"
srv "update public.lead_profiles set treatment_interest='filler' where conversation_id='$C1'" >/dev/null
expect "changing an existing treatment emits nothing" "1" "$(ev lead_updated)"
srv "update public.lead_profiles set treatment_interest=null where conversation_id='$C1'" >/dev/null
srv "update public.lead_profiles set treatment_interest='filler' where conversation_id='$C1'" >/dev/null
expect "null -> value again emits for the new key" "2" "$(ev lead_updated)"
srv "update public.lead_profiles set treatment_interest=null where conversation_id='$C1'" >/dev/null
srv "update public.lead_profiles set treatment_interest='filler' where conversation_id='$C1'" >/dev/null
expect "the same key never emits twice" "2" "$(ev lead_updated)"
srv "insert into public.lead_profiles(conversation_id,user_id,treatment_interest) values ('$C2','$U1','botox')" >/dev/null
expect "lead_updated on an insert with a treatment" "1" "$(ev lead_updated "conversation_id='$C2'")"
expect "a treatment-only profile emits no contact_captured" "0" "$(ev contact_captured "conversation_id='$C2'")"
q "update public.outbound_webhooks set event_types='{new_inquiry,contact_captured}' where user_id='$U1'" >/dev/null
srv "insert into public.lead_profiles(conversation_id,user_id,treatment_interest) values ('dddddddd-0000-0000-0000-000000000003','$U1','botox')" >/dev/null
expect "not emitted when the webhook isn't subscribed" "0" "$(ev lead_updated "conversation_id='dddddddd-0000-0000-0000-000000000003'")"
q "update public.outbound_webhooks set event_types=default where user_id='$U1'" >/dev/null
q "delete from public.lead_profiles where conversation_id='dddddddd-0000-0000-0000-000000000003'" >/dev/null
expect "default event_types include lead_updated" "t" "$(q "select 'lead_updated' = any(event_types) from public.outbound_webhooks where user_id='$U1'")"
expect "lead_updated is a valid outbox type" "INSERT 0 1" "$(as_role service_role "insert into public.outbound_webhook_events(user_id,event_type,dedupe_key) values ('$U1','lead_updated','x')")"

# Comment opener that Meta's echo saved first (staff message, native_send
# thread), relabeled by the comment-to-DM path.
C5=dddddddd-0000-0000-0000-000000000005
srv "insert into public.conversations(id,user_id,origin) values ('$C5','$U1','native_send')" >/dev/null
srv "insert into public.messages(id,conversation_id,role,content,source,provider_message_id) values ('eeeeeeee-0000-0000-0000-000000000005','$C5','assistant','Hi! I''m Katlynne, Solé Aesthetics'' AI concierge.','manual','mid-echo')" >/dev/null
expect "echoed opener as a staff message emits nothing yet" "0" "$(ev dm_started "conversation_id='$C5'")"
srv "update public.messages set source='agent' where id='eeeeeeee-0000-0000-0000-000000000005'" >/dev/null
srv "update public.conversations set origin='clinchd_sent' where id='$C5'" >/dev/null
expect "relabel to agent emits dm_started" "1" "$(ev dm_started "conversation_id='$C5'")"
expect "relabel to clinchd_sent emits new_inquiry" "1" "$(ev new_inquiry "conversation_id='$C5'")"
srv "update public.messages set source='agent' where id='eeeeeeee-0000-0000-0000-000000000005'" >/dev/null
srv "update public.conversations set origin='clinchd_sent' where id='$C5'" >/dev/null
expect "repeating the relabel emits nothing more" "1" "$(ev dm_started "conversation_id='$C5'")"
srv "update public.conversations set origin='native_send' where id='$C1'" >/dev/null
expect "a move to native_send emits nothing" "1" "$(ev new_inquiry "conversation_id='$C1'")"

# A broken emit never fails the write it rides on, and is recorded.
expect "write succeeds while the outbox is broken; failure recorded" "1" "$(q_last "begin; alter table public.outbound_webhook_events rename to owe_broken; set local role service_role; set local request.jwt.claims = '{\"role\":\"service_role\"}'; insert into public.conversations(user_id,origin) values ('$U1','inbound'); select count(*) from public.outbound_webhook_emit_failures where event_type='new_inquiry'; rollback;")"

# Claim
expect "claim takes due events" "t" "$(as_role service_role "select count(*) > 0 from public.claim_outbound_webhook_events(100, 120)")"
srv "select count(*) from public.claim_outbound_webhook_events(100, 120)" >/dev/null
expect "claimed events are not re-claimed while fresh" "0" "$(q "begin; set local role service_role; select count(*) from public.claim_outbound_webhook_events(100, 120); rollback;")"
q "update public.outbound_webhook_events set claimed_at = now() - interval '10 minutes'" >/dev/null
expect "stale claims are taken over and count an attempt" "2" "$(q "begin; set local role service_role; select max(attempts) from public.claim_outbound_webhook_events(100, 120); rollback;")"
expect "still no browser-executable definer functions" "0" "$(as_role service_role "select count(*) from public.browser_executable_definer_functions()")"

psql_ -d postgres -c "drop database $DB"
echo
[ $fails -eq 0 ] && echo "all DB tests passed" || { echo "$fails DB test(s) failed"; exit 1; }
