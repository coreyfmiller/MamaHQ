-- Mama HQ — read-only verification for migration 0003 (family membership).
-- Safe to run in the Supabase SQL editor: SELECTs only, no writes. See docs/DATA_MODEL.md §7.
-- These run as the postgres/service role in the SQL editor (RLS-bypassing), so they verify the
-- DATA SHAPE. The true cross-user RLS test (Family A cannot read Family B) is done by signing in
-- as two real app users; that is exercised naturally once Partner Mode invites a second user.

-- 1. Every family has exactly ONE owner member (backfill + enroll trigger correctness).
--    Expect: zero rows returned (no family violates the rule).
select f.id as family_id,
       count(m.*) filter (where m.role = 'owner') as owner_count
from public.families f
left join public.family_members m on m.family_id = f.id
group by f.id
having count(m.*) filter (where m.role = 'owner') <> 1;

-- 2. Every family_members row points at a real family and a real user (referential sanity).
--    Expect: zero rows.
select m.id
from public.family_members m
left join public.families f on f.id = m.family_id
left join auth.users u on u.id = m.user_id
where f.id is null or u.id is null;

-- 3. Helpers exist and are SECURITY DEFINER (authorization plumbing present).
--    Expect: is_family_member, is_family_owner, family_role, owns_baby, enroll_owner_on_family_insert.
select p.proname, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_family_member','is_family_owner','family_role','owns_baby',
                    'enroll_owner_on_family_insert')
order by p.proname;

-- 4. RLS is enabled on all family-scoped tables.
--    Expect: rowsecurity = true for every row.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('families','family_members','babies','logs','plan_items',
                    'inbox_captures','memories')
order by c.relname;

-- 5. family_members has the expected policies (owner-gated writes).
--    Expect: family_members_select/insert/update/delete present.
select polname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'family_members'
order by polname;
