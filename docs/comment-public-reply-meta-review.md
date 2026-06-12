# Public comment replies — Meta App Review notes

## What this feature is

After the comment-to-DM flow successfully sends a private reply to a trigger
comment, Clinchd can optionally post a short **public** reply under the same
comment ("sent! check your dms 🙌"). This is the public half of
`instagram_business_manage_comments` — the half the previous two App Review
submissions were rejected for never demonstrating. The DM half
(private replies via `recipient.comment_id`) was already live.

Graph API endpoint used:

```
POST https://graph.instagram.com/v21.0/{ig-comment-id}/replies
Authorization: Bearer {page-access-token}
Body: { "message": "<reply text>" }
```

Implementation: `postPublicCommentReply()` in `src/lib/instagram.js`,
called from `maybePostPublicReply()` in `src/lib/comment-public-reply.js`,
which is invoked by the comment webhook handler
(`src/lib/webhooks/comment-event.js`) **only after a successful DM
dispatch**. A failed public reply never affects the DM that already went
out — every failure path logs and returns.

## Default-OFF behavior

`users.comment_public_reply_enabled` is `BOOLEAN NOT NULL DEFAULT FALSE`
(migration `20260612120000_comment_public_reply.sql`). Every existing and
new user has the feature off until they flip the toggle on the
`/dm-templates` settings page. With the toggle off — or on with zero active
templates — the comment-to-DM flow behaves exactly as before: no public
reply, no extra Graph API calls, no errors.

No reply templates are seeded. The suggested phrasings shown on the
settings page live in the UI only and are written to
`comment_reply_templates` only when the coach explicitly adds them.

## Varied-pool safety rationale

Posting an identical reply on every trigger comment is automated comment
spam, and that exact repetitive-action pattern (on the outreach surface)
already earned a 30-day restriction on the founder's personal account. The
pool is therefore the core safety mechanism, not a styling choice:

- Replies are drawn from the coach's own `comment_reply_templates` pool
  (add/edit/delete/toggle-active on `/dm-templates`).
- The picker (`pickReplyTemplate` in `src/lib/comment-public-reply.js`)
  selects a random **active** template whose text differs from the last
  reply posted on that post (`post_monitoring_settings.last_public_reply_text`).
  With 2+ distinct texts, the same reply can never post twice in a row on
  the same post. With a single template, that one is used (the UI warns and
  nudges the coach to add more).
- The UI helper text states this explicitly: "We rotate through your
  replies to keep them natural — Instagram may flag repetitive identical
  comments."

Future work (not in this build): per-account rate limiting / scheduling of
public replies beyond the anti-repeat rule, and per-intent-class reply
pools.

## No feedback loop

Our own public reply arrives back on the webhook as a comment event, but it
is a **nested** reply (`parent_id` present) and the handler skips nested
replies before classification — so the feature cannot trigger itself.

## Recording the screencast

1. On the reviewer test account, ensure the plan/founder gate passes and a
   monitored post exists (same setup as the comment-to-DM demo).
2. Open `/dm-templates`, flip on "Post a public reply under trigger
   comments", and add 2–3 replies from the suggestions.
3. From a second account, comment the trigger keyword on the monitored post.
4. Show the private DM arriving (existing approved flow), then show the
   public reply appearing under the trigger comment.
5. Comment again from another account and show a **different** phrasing
   posts — this demonstrates both the permission's public-reply action and
   our anti-spam rotation.

PostHog events for verification during the demo:
`comment_public_reply_posted` (user_id, post_id, reply_text_length,
template_count_active) and `comment_public_reply_failed` (error reason).

Post-review policy mirrors Voice Replies: leave the toggle OFF on the
reviewer account once approved.
