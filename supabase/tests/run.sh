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

echo "# M2: stripe_webhook_events"
expect "claims start as processing" "processing" "$(as_role service_role "insert into public.stripe_webhook_events(event_id,event_type) values ('evt_1','x') returning status")"
expect "unknown status rejected" "violates check constraint" "$(as_role service_role "insert into public.stripe_webhook_events(event_id,event_type,status) values ('evt_2','x','weird')")"
expect "browser cannot read events" "permission denied" "$(as_role authenticated "select * from public.stripe_webhook_events")"

psql_ -d postgres -c "drop database $DB"
echo
[ $fails -eq 0 ] && echo "all DB tests passed" || { echo "$fails DB test(s) failed"; exit 1; }
