-- Defense in depth found by the security review (tests/db/security.test.ts):
-- Supabase grants new objects to the anonymous role by default. The views read tables the anonymous
-- role cannot read anyway, but nothing should be reachable without signing in.

revoke all on public.effective_holidays, public.meals_numbered, public.monthly_stats from anon;
-- The views are read-only for everyone.
revoke insert, update, delete on public.effective_holidays, public.meals_numbered, public.monthly_stats from authenticated;

-- RLS policies call these as the signed-in user, so only that role may execute them.
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.person_in_my_household(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.person_in_my_household(uuid) to authenticated;

-- Objects created later must not be granted to the anonymous role either.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;
