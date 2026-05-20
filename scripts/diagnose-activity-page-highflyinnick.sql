-- Diagnostic for /comment-to-dm/activity not rendering data for
-- highflyinnick@gmail.com after upgrading them to Unlimited.
--
-- Run each query in the Supabase SQL editor and read the result inline.
-- This is a one-off diagnostic — delete the file once the root cause is
-- identified and fixed. NOT a migration, NOT idempotent setup.
--
-- The activity page does three things:
--   1. Reads users.plan + users.email to evaluate canUseCommentToDM().
--      If the gate fails, redirect("/comment-to-dm") fires before the
--      data query — so the page looks "empty" but is actually the
--      overview page rendering.
--   2. Selects from comment_classifications WHERE creator_id = user.id,
--      INNER JOIN posts, LEFT JOIN comment_to_dm_log.
--      Subject to RLS.
--   3. Groups rows by post_id in JS for the overview cards.
--
-- The most likely failure modes, in order:
--   (a) plan didn't actually save as 'unlimited' (typo, wrong row)
--   (b) classifications exist but posts row missing → INNER JOIN drops them
--   (c) RLS policy excludes the row even with correct creator_id
--   (d) There simply is no activity for this account yet

----------------------------------------------------------------------
-- 1. Confirm the gate inputs. Expect plan = 'unlimited'. If null or
-- 'base', the gate fails and the page redirects to /comment-to-dm.
----------------------------------------------------------------------
SELECT
  id            AS user_id,
  email,
  plan,
  instagram_business_account_id IS NOT NULL AS ig_connected,
  created_at
FROM users
WHERE email ILIKE 'highflyinnick%';

----------------------------------------------------------------------
-- 2. How many classifications belong to this creator? If 0, the page
-- correctly shows the empty state — that's not a bug, just no data.
----------------------------------------------------------------------
SELECT
  COUNT(*)                  AS classification_count,
  MIN(classified_at)        AS first_at,
  MAX(classified_at)        AS last_at
FROM comment_classifications
WHERE creator_id = (
  SELECT id FROM users WHERE email ILIKE 'highflyinnick%' LIMIT 1
);

----------------------------------------------------------------------
-- 3. Do the classifications have matching posts rows? The activity
-- overview uses posts!inner, so a missing/orphan post_id silently
-- drops the classification from the result. List any orphans.
----------------------------------------------------------------------
SELECT
  cc.id                  AS classification_id,
  cc.post_id,
  cc.ig_comment_id,
  cc.class,
  cc.classified_at,
  CASE WHEN p.id IS NULL THEN 'ORPHAN — no posts row'
       WHEN p.creator_id <> cc.creator_id THEN 'MISMATCH — post.creator_id ≠ classification.creator_id'
       ELSE 'ok'
  END AS join_status
FROM comment_classifications cc
LEFT JOIN posts p ON p.id = cc.post_id
WHERE cc.creator_id = (
  SELECT id FROM users WHERE email ILIKE 'highflyinnick%' LIMIT 1
)
ORDER BY cc.classified_at DESC
LIMIT 25;

----------------------------------------------------------------------
-- 4. The full select the page runs, scoped to this creator. If this
-- returns rows here but the page still shows empty in the browser,
-- the cause is RLS — the page reads via the SSR (anon) client, which
-- evaluates policies against auth.uid(). This query runs as the
-- service role and bypasses RLS, so a mismatch implies a policy bug.
----------------------------------------------------------------------
SELECT
  cc.id,
  cc.ig_commenter_username,
  cc.class,
  cc.classified_at,
  p.id           AS post_id,
  p.permalink,
  l.decided_action,
  l.dispatched,
  l.dispatched_at
FROM comment_classifications cc
INNER JOIN posts p ON p.id = cc.post_id
LEFT JOIN comment_to_dm_log l ON l.comment_classification_id = cc.id
WHERE cc.creator_id = (
  SELECT id FROM users WHERE email ILIKE 'highflyinnick%' LIMIT 1
)
ORDER BY cc.classified_at DESC
LIMIT 25;

----------------------------------------------------------------------
-- 5. RLS policies in effect for the tables the page reads. If the
-- service-role queries above return rows but the page is empty, look
-- here — a policy like USING (creator_id = auth.uid()) is correct,
-- but USING (creator_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
-- with a missing auth linkage would silently drop everything.
----------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('comment_classifications', 'comment_to_dm_log', 'posts')
ORDER BY tablename, policyname;

----------------------------------------------------------------------
-- 6. THE LIKELY ROOT CAUSE: does public.users.id equal auth.users.id?
-- All the RLS policies use `auth.uid() = creator_id`. auth.uid()
-- returns auth.users.id. The data has creator_id = public.users.id
-- (e.g. 15235d0b-9758-472c-8d11-040d8498a938 for highflyinnick).
--
-- If `ids_match` is FALSE here, every row is silently filtered by RLS
-- when highflyinnick signs in — service-role queries see the data,
-- the user's session does not. This also breaks the gate query
-- (users WHERE id = user.id), so plan reads as undefined, and the
-- founder bypass doesn't apply.
--
-- Compare against dominickjerell as a known-working control.
----------------------------------------------------------------------
SELECT
  au.email,
  au.id        AS auth_users_id,
  pu.id        AS public_users_id,
  (au.id = pu.id) AS ids_match,
  pu.plan
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
WHERE au.email ILIKE 'highflyinnick%'
   OR au.email = 'dominickjerell@gmail.com'
ORDER BY au.email;

----------------------------------------------------------------------
-- 7. Simulate the page's queries AS highflyinnick with RLS enforced.
-- This is the closest thing to actually signing in as them. If query
-- 7a returns no row, the gate fails (the page redirects to /comment-to-dm).
-- If 7a returns the row but 7b returns no rows, RLS on posts (the
-- INNER JOIN) or comment_classifications is filtering — check
-- posts.creator_id for the post a1ed42f6-... in 7c.
--
-- Run the whole BEGIN...ROLLBACK block together so the role + jwt
-- claims reset cleanly even if a query inside it errors.
----------------------------------------------------------------------
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"15235d0b-9758-472c-8d11-040d8498a938","role":"authenticated"}';

-- 7a. Gate query: does highflyinnick's session see their own users row?
-- If no rows: RLS on `users` is blocking — gate fails, page redirects.
SELECT id, plan, email
FROM users
WHERE id = '15235d0b-9758-472c-8d11-040d8498a938';

-- 7b. The activity page's exact join, as highflyinnick. Expect 4 rows.
-- If 0 rows: RLS on posts (INNER JOIN drops everything) or on
-- comment_classifications is the culprit.
SELECT
  cc.id,
  cc.class,
  cc.classified_at,
  p.id AS post_id,
  p.creator_id AS post_creator_id,
  p.permalink
FROM comment_classifications cc
INNER JOIN posts p ON p.id = cc.post_id
WHERE cc.creator_id = '15235d0b-9758-472c-8d11-040d8498a938'
ORDER BY cc.classified_at DESC
LIMIT 10;

-- 7c. Just the inner-joined posts row, in isolation. If 7b is empty
-- but this returns a row, the issue is on comment_classifications RLS.
-- If this is also empty, the posts row's creator_id doesn't match
-- highflyinnick (orphaned/mis-owned post) and the INNER JOIN drops it.
SELECT id, creator_id, permalink, caption
FROM posts
WHERE id = 'a1ed42f6-0cd9-4ba9-98d3-533264af2f25';

ROLLBACK;

----------------------------------------------------------------------
-- 8. Deeper RLS check for comment_classifications. The previous policy
-- dump only showed `qual` text; this also reveals (a) which roles the
-- policy applies to, and (b) whether any RESTRICTIVE policies exist
-- (RESTRICTIVE policies AND-stack with permissive ones, so a single
-- restrictive policy that evaluates to false drops the row even when
-- the permissive policy text looks right).
----------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('comment_classifications', 'comment_to_dm_log', 'posts', 'users')
ORDER BY tablename, permissive DESC, policyname;

----------------------------------------------------------------------
-- 9. Is RLS even enabled on comment_classifications, and what does
-- `authenticated` have permission to do? If `relrowsecurity` is false
-- the policies are inert; if `authenticated` lacks SELECT on the
-- table, the policy is moot because the GRANT itself blocks reads.
----------------------------------------------------------------------
SELECT
  c.relname,
  c.relrowsecurity   AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('comment_classifications', 'comment_to_dm_log', 'posts', 'users');

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'comment_classifications'
  AND grantee IN ('authenticated', 'anon', 'service_role', 'PUBLIC')
ORDER BY grantee, privilege_type;

----------------------------------------------------------------------
-- 10. Direct read of comment_classifications AS highflyinnick, with
-- no joins. If `total_visible_to_me` is 0 but `mine_by_creator_id` is
-- > 0 (impossible-looking by the policy text), RLS is dropping rows
-- before the WHERE filter — the smoking gun. Also dumps `auth.uid()`
-- so we can confirm the JWT context is what we think it is.
----------------------------------------------------------------------
BEGIN;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"15235d0b-9758-472c-8d11-040d8498a938","role":"authenticated"}';

SELECT auth.uid() AS my_uid;

SELECT COUNT(*) AS total_visible_to_me
FROM comment_classifications;

SELECT COUNT(*) AS mine_by_creator_id
FROM comment_classifications
WHERE creator_id = '15235d0b-9758-472c-8d11-040d8498a938';

SELECT id, creator_id, class, classified_at
FROM comment_classifications
WHERE creator_id = '15235d0b-9758-472c-8d11-040d8498a938'
ORDER BY classified_at DESC
LIMIT 5;

ROLLBACK;
