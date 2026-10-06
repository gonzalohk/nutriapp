-- Households, membership, invitations and the helper used by every RLS policy.
-- All dates in the app are Bolivia local dates; the timezone is a constant, not a column.

create type public.member_role as enum ('owner', 'adult');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  country_code text not null default 'BO',
  created_at timestamptz not null default now()
);

-- One user belongs to at most one household (single-household deployment).
-- `role` is informational: every member has the same permissions.
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'adult',
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table public.household_invites (
  code text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id),
  used_at timestamptz
);

-- Used by every policy. SECURITY DEFINER so the lookup itself is not blocked by RLS.
create function public.is_household_member(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid()
  )
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

create policy households_select on public.households
  for select to authenticated using (public.is_household_member(id));
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy members_select on public.household_members
  for select to authenticated using (public.is_household_member(household_id));
create policy members_update_self on public.household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy invites_select on public.household_invites
  for select to authenticated using (public.is_household_member(household_id));

-- Writes to membership and invites only happen through the functions below.
revoke insert, delete on public.households from authenticated, anon;
revoke insert, delete on public.household_members from authenticated, anon;
revoke insert, update, delete on public.household_invites from authenticated, anon;
revoke all on public.households, public.household_members, public.household_invites from anon;

-- Creates the first household. Refuses to run once any household exists.
create function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  if exists (select 1 from public.households) then
    raise exception 'E_HOUSEHOLD_EXISTS';
  end if;
  insert into public.households (name) values (p_name) returning id into v_household;
  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household, auth.uid(), 'owner', p_display_name);
  return v_household;
end
$$;

-- Any member can invite. The code has 80 random bits, so guessing it is infeasible.
create function public.create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  select household_id into v_household
  from public.household_members where user_id = auth.uid();
  if v_household is null then
    raise exception 'E_FORBIDDEN';
  end if;
  v_code := left(replace(gen_random_uuid()::text, '-', ''), 12)
         || right(replace(gen_random_uuid()::text, '-', ''), 8);
  insert into public.household_invites (code, household_id, created_by)
  values (v_code, v_household, auth.uid());
  return v_code;
end
$$;

create function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.household_invites;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'E_ALREADY_MEMBER';
  end if;
  select * into v_invite from public.household_invites
  where code = p_code and used_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'E_INVITE_INVALID';
  end if;
  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_invite.household_id, auth.uid(), 'adult', p_display_name);
  update public.household_invites set used_by = auth.uid(), used_at = now() where code = p_code;
  return v_invite.household_id;
end
$$;

revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.create_invite() from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
