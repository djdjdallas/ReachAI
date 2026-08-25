-- Remediation for the opener-echo takeover-pause regression (6d536d8, Aug 16).
-- Run manually against prod (pwyzbsmxzxfaikfnoxxc) AFTER deploying the code fix.
--
-- Affected class: conversations born from a manually-typed cold DM whose echo
-- paused them at creation. NOT affected: threads where the coach genuinely
-- took over after the lead spoke (a manual message AFTER the first lead
-- message) — those stay paused.
--
-- 1) Preview what will be un-paused:
select c.id, c.created_at, c.sender_name, c.origin, c.status
from conversations c
where c.ai_paused
  and c.ai_pause_reason = 'human_took_over'
  and c.created_at >= '2026-08-16'
  and not exists (
    select 1
    from messages m
    where m.conversation_id = c.id
      and m.role = 'assistant'
      and m.source = 'manual'
      and m.created_at > (
        select min(m2.created_at)
        from messages m2
        where m2.conversation_id = c.id
          and m2.role = 'user'
      )
  )
order by c.created_at;

-- 2) If the preview looks right, un-pause them:
update conversations c
set ai_paused = false,
    ai_pause_reason = null
where c.ai_paused
  and c.ai_pause_reason = 'human_took_over'
  and c.created_at >= '2026-08-16'
  and not exists (
    select 1
    from messages m
    where m.conversation_id = c.id
      and m.role = 'assistant'
      and m.source = 'manual'
      and m.created_at > (
        select min(m2.created_at)
        from messages m2
        where m2.conversation_id = c.id
          and m2.role = 'user'
      )
  );

-- Note: un-pausing does not retroactively answer leads who replied into a
-- paused thread — check the preview rows in /conversations and reply manually
-- (or from the dashboard) where a lead is waiting.
