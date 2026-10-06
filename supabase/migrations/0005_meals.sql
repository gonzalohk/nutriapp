-- Monthly plans and meals. The app can only read these tables; every write goes through a
-- SECURITY DEFINER function that checks household membership, so invariants cannot be bypassed.

create type public.meal_status as enum (
  'scheduled', 'picked_up', 'cancelled', 'not_picked_up', 'permission'
);

-- "Today" is always the calendar date in Bolivia (UTC-4, no daylight saving).
create function public.bolivia_today() returns date
language sql
stable
as $$ select (now() at time zone 'America/La_Paz')::date $$;

create function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- One row per person and month (RULE-001).
create table public.monthly_plans (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  contracted_count int not null check (contracted_count > 0),
  is_partial boolean not null default false,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  unique (person_id, month)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  monthly_plan_id uuid not null references public.monthly_plans (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  meal_date date not null,
  status public.meal_status not null default 'scheduled',
  note text,
  permission_reason text,
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No duplicate meal for the same person and date (RULE-012).
  unique (person_id, meal_date)
);
create index meals_household_date_idx on public.meals (household_id, meal_date);
create index meals_plan_idx on public.meals (monthly_plan_id);

create trigger meals_touch_updated_at
  before update on public.meals
  for each row execute function public.touch_updated_at();

-- Weekends and holidays are never delivery days (RULE-004, 005, 013, 014). A Saturday or Sunday is
-- allowed only when the household registered it as an exceptional delivery date.
create function public.meals_validate_date() returns trigger
language plpgsql
as $$
begin
  if extract(isodow from new.meal_date) in (6, 7) and not exists (
    select 1 from public.exceptional_delivery_dates
    where household_id = new.household_id and delivery_date = new.meal_date
  ) then
    raise exception 'E_INVALID_DATE';
  end if;
  if exists (
    select 1 from public.effective_holidays
    where household_id = new.household_id and holiday_date = new.meal_date
  ) then
    raise exception 'E_INVALID_DATE';
  end if;
  return new;
end
$$;

create trigger meals_validate_date
  before insert or update of meal_date on public.meals
  for each row execute function public.meals_validate_date();

alter table public.monthly_plans enable row level security;
alter table public.meals enable row level security;

create policy monthly_plans_select on public.monthly_plans
  for select to authenticated using (public.is_household_member(household_id));
create policy meals_select on public.meals
  for select to authenticated using (public.is_household_member(household_id));

revoke insert, update, delete on public.monthly_plans, public.meals from authenticated, anon;
revoke all on public.monthly_plans, public.meals from anon;

-- Meals with their number in the month and the status the user should see: a meal still
-- `scheduled` once its day has passed counts as an automatic "not picked up" (spec FR-015a).
-- Nothing is written for this, so no scheduled job is needed.
create view public.meals_numbered with (security_invoker = true) as
select
  m.*,
  (row_number() over (partition by m.monthly_plan_id order by m.meal_date))::int as meal_no,
  case
    when m.status = 'scheduled' and m.meal_date < public.bolivia_today() then 'not_picked_up'::public.meal_status
    else m.status
  end as effective_status,
  (m.status = 'scheduled' and m.meal_date < public.bolivia_today()) as is_automatic
from public.meals m;

-- Reconciles one person's meals for a month with the dates computed by the app, atomically.
-- Idempotent. Only `scheduled` meals are ever removed; recorded meals are kept and, if they no
-- longer fit, the month is flagged for review.
create function public.apply_month_plan(
  p_person uuid,
  p_month date,
  p_dates date[],
  p_contracted int,
  p_is_partial boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person public.people;
  v_plan uuid;
  v_dates date[] := coalesce(p_dates, '{}');
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  select * into v_person from public.people where id = p_person;
  if not found or not public.is_household_member(v_person.household_id) then
    raise exception 'E_NOT_FOUND';
  end if;
  if extract(day from p_month) <> 1 then
    raise exception 'E_INVALID_DATE';
  end if;
  if exists (select 1 from unnest(v_dates) d where date_trunc('month', d)::date <> p_month) then
    raise exception 'E_INVALID_DATE';
  end if;

  insert into public.monthly_plans (person_id, household_id, month, contracted_count, is_partial)
  values (p_person, v_person.household_id, p_month, p_contracted, coalesce(p_is_partial, false))
  on conflict (person_id, month) do update
    set contracted_count = excluded.contracted_count, is_partial = excluded.is_partial
  returning id into v_plan;

  delete from public.meals
  where monthly_plan_id = v_plan and status = 'scheduled' and not (meal_date = any (v_dates));

  insert into public.meals (monthly_plan_id, person_id, household_id, meal_date)
  select v_plan, p_person, v_person.household_id, d from unnest(v_dates) d
  on conflict (person_id, meal_date) do nothing;

  update public.monthly_plans set needs_review = exists (
    select 1 from public.meals
    where monthly_plan_id = v_plan and status <> 'scheduled' and not (meal_date = any (v_dates))
  ) where id = v_plan;

  return v_plan;
end
$$;

revoke execute on function public.apply_month_plan(uuid, date, date[], int, boolean) from public, anon;
grant execute on function public.apply_month_plan(uuid, date, date[], int, boolean) to authenticated;
