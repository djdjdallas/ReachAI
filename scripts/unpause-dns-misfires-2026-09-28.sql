-- Remediation for classifier v1.0 do_not_send misfires (PR A,
-- audits/dm-classifier-prompt-audit-2026-09-28.md §10).
-- Run manually against prod (pwyzbsmxzxfaikfnoxxc). Paste THIS file into the
-- SQL editor, not scripts/review-dns-paused-threads.mjs (that is Node code
-- which produced this list).
--
-- The 3 threads below were re-classified by v1.1 as personal or ordinary
-- conversation. This clears the pause only; status is left alone.

-- 1) Preview: should return exactly 3 rows, all ai_paused = true.
select id, sender_name, ai_paused, ai_pause_reason, status
from conversations
where id in (
  'd32776da-1c56-4e5e-bac6-3409ec34d5e1',
  'f9827c6f-3929-4023-a10f-706f40aefb66',
  '9c3a745e-c68c-47bf-ae57-2f32e4cb640d'
);

-- 2) Unpause.
update conversations
set ai_paused = false, ai_pause_reason = null
where ai_paused
  and ai_pause_reason in ('flagged_do_not_send', 'hostile_or_refund', 'flagged_coach_script', 'prompt_injection', 'crisis_signal')
  and id in (
    'd32776da-1c56-4e5e-bac6-3409ec34d5e1',
    'f9827c6f-3929-4023-a10f-706f40aefb66',
    '9c3a745e-c68c-47bf-ae57-2f32e4cb640d'
  );

-- Note: 9c3a745e also has status = 'manual' (Human Takeover), which keeps
-- the AI off on its own. Change its status in the dashboard if you want the
-- AI back on that thread.
