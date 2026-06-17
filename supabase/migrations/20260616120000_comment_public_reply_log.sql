-- Migration: per-dispatch audit log for PUBLIC comment replies
--
-- Before this, the only trace of a public comment reply was
-- post_monitoring_settings.last_public_reply_text — last-write-wins, one
-- value per post. There was no record of WHICH comment/commenter was
-- replied to, the exact text, when, the created reply comment id, or whether
-- the dispatch failed. This table captures one row per dispatch attempt
-- (success AND failure) so the public-reply surface is auditable per user.
--
-- Writes happen server-side via the service-role key in the comment webhook
-- (src/lib/comment-public-reply.js). last_public_reply_text is intentionally
-- KEPT — it drives the zero-query anti-repeat picker the webhook reads before
-- every dispatch; this log is the audit trail, not a replacement.
--
-- NOTE (intentionally no unique index on (user_id, ig_comment_id)): a true
-- double public-reply to the same comment cannot occur through the pipeline —
-- the comment-to-DM path short-circuits on the classification dedup index
-- (idx_classifications_dedup) before it would ever reach the public-reply
-- step a second time. Adding a unique constraint here would instead corrupt
-- the audit trail by rejecting a legitimate failed→retried→succeeded
-- sequence, where BOTH the 'failed' and the later 'sent' rows should remain
-- visible. Uniqueness belongs at the dispatch gate, not on the log.
--
-- Future read surface: a per-user /activity (or /insights) view would read
-- from this table joined to comment_classifications/posts; no consumer exists
-- yet (data layer only in this pass).

CREATE TABLE IF NOT EXISTS public.comment_public_reply_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  comment_classification_id UUID,
  post_id UUID,
  ig_comment_id TEXT,
  ig_commenter_username TEXT,
  reply_text TEXT NOT NULL,
  comment_reply_template_id UUID,
  ig_reply_comment_id TEXT,
  dispatch_status TEXT NOT NULL DEFAULT 'sent'
    CHECK (dispatch_status = ANY (ARRAY['sent'::text, 'failed'::text])),
  error_message TEXT,
  retryable BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT comment_public_reply_log_pkey PRIMARY KEY (id),
  CONSTRAINT cprl_user_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id),
  CONSTRAINT cprl_classification_fkey FOREIGN KEY (comment_classification_id)
    REFERENCES public.comment_classifications(id),
  CONSTRAINT cprl_post_fkey FOREIGN KEY (post_id)
    REFERENCES public.posts(id),
  CONSTRAINT cprl_template_fkey FOREIGN KEY (comment_reply_template_id)
    REFERENCES public.comment_reply_templates(id)
);

CREATE INDEX IF NOT EXISTS cprl_user_created_idx
  ON public.comment_public_reply_log (user_id, created_at DESC);

-- RLS scoped to auth.uid() = user_id, matching the convention from
-- 20260612120000_comment_public_reply.sql. Server writes use the service-role
-- key (bypasses RLS), so there is deliberately NO permissive insert policy
-- for the anon/auth role — users may only read their own rows.
-- DROP-then-CREATE keeps the migration idempotent.
ALTER TABLE public.comment_public_reply_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_public_reply_log_select_own" ON public.comment_public_reply_log;
CREATE POLICY "comment_public_reply_log_select_own"
  ON public.comment_public_reply_log FOR SELECT
  USING (auth.uid() = user_id);
