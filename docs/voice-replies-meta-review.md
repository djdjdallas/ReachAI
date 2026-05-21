# Voice Replies — Meta App Review notes

## Why the kill switch exists

`users.voice_replies_enabled` (boolean, default `true`) is a per-user kill
switch added in migration `20260520120000_voice_replies.sql`. It governs
whether the webhook will send pre-recorded audio in response to an inbound
DM, regardless of whether the coach has uploaded snippets.

Three reasons it exists:

1. **Meta App Review** — the reviewer test account
   (`highflyinnick@gmail.com`) must NOT receive voice replies while the
   comment-to-DM permission set is being inspected. A new audio-send
   behaviour appearing on the reviewer's account could confuse the review
   or trigger a permission-scope question we are not currently answering.
2. **Incident response** — if a coach's voice library starts misfiring
   post-launch (wrong snippet sent to wrong intent, copyright complaint
   on a memo, etc.) we can disable just that user in seconds, without
   pulling the feature for everyone.
3. **Trust safety** — the matcher checks this column BEFORE touching the
   `voice_snippets` table, so a disabled user never pays the lookup cost
   and never has a path to send audio.

## Pre-deploy SQL (run BEFORE making the page accessible)

Run this in the Supabase SQL editor before shipping:

```sql
UPDATE public.users
   SET voice_replies_enabled = false
 WHERE email = 'highflyinnick@gmail.com';
```

This is the same statement commented out at the bottom of
`supabase/migrations/20260520120000_voice_replies.sql`.

## Post-approval policy

After Meta approves the comment-to-DM permission set, the recommended
default is to **leave `voice_replies_enabled = false` on the reviewer
account**. The account is not actively coaching, has no uploaded
snippets, and re-enabling it has no upside.

If a future review cycle requires re-enabling:

```sql
UPDATE public.users
   SET voice_replies_enabled = true
 WHERE email = 'highflyinnick@gmail.com';
```

## What the matcher does when the switch is off

`findVoiceSnippetForIntent` (`src/lib/voice/matcher.js`):

- Reads `users.voice_replies_enabled` first.
- If `false`, returns `null` immediately — never queries `voice_snippets`.
- Webhook caller then falls through to the existing text reply path, so
  the lead is never ghosted.

## What the matcher does on a `do_not_send` intent

Independent of the kill switch, `findVoiceSnippetForIntent` returns `null`
for `intent_class === 'do_not_send'` BEFORE the kill-switch check, since
hostile / refund-demand messages should never receive a pre-recorded
voice reply. The webhook pauses the conversation with reason
`hostile_or_refund` instead.
