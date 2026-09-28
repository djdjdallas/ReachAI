-- Removes the em dash from the one saved comment DM template that has one:
-- the HIGH_INTENT default the editor used to pre-fill (saved 2026-06-17 on
-- the "dominick hill" account). Run manually against prod
-- (pwyzbsmxzxfaikfnoxxc). The editor defaults no longer contain dashes (PR D).

-- 1) Preview: expect 1 row.
select id, intent_class, template
from dm_templates
where id = 'd277ec8e-dbd5-48ea-9b7a-7cd83ba3635f';

-- 2) Replace " — " with ", ".
update dm_templates
set template = replace(template, ' — ', ', ')
where id = 'd277ec8e-dbd5-48ea-9b7a-7cd83ba3635f'
  and template like '% — %';
