-- Holidays (official data + per-household overrides), exceptional delivery dates, and the
-- functions that manage them. Holiday data itself arrives in 0004_official_holidays.sql.

create type public.override_action as enum ('add', 'remove');

create table public.official_holidays (
  country_code text not null,
  holiday_date date not null,
  name text not null,
  primary key (country_code, holiday_date)
);

-- The range of years the generator covered. The app refuses to plan a month outside it, so a
-- missing holiday list can never silently produce meals on holidays.
create table public.official_holiday_years (
  country_code text primary key,
  first_year int not null,
  last_year int not null check (last_year >= first_year)
);

create table public.holiday_overrides (
  household_id uuid not null references public.households (id) on delete cascade,
  holiday_date date not null,
  action public.override_action not null,
  name text,
  primary key (household_id, holiday_date)
);

create table public.exceptional_delivery_dates (
  household_id uuid not null references public.households (id) on delete cascade,
  delivery_date date not null,
  note text,
  primary key (household_id, delivery_date)
);

alter table public.official_holidays enable row level security;
alter table public.official_holiday_years enable row level security;
alter table public.holiday_overrides enable row level security;
alter table public.exceptional_delivery_dates enable row level security;

create policy official_holidays_read on public.official_holidays
  for select to authenticated using (true);
create policy official_holiday_years_read on public.official_holiday_years
  for select to authenticated using (true);
create policy overrides_select on public.holiday_overrides
  for select to authenticated using (public.is_household_member(household_id));
create policy exceptional_select on public.exceptional_delivery_dates
  for select to authenticated using (public.is_household_member(household_id));

-- Reference data is written by migrations only; household data only through the functions below.
revoke insert, update, delete on public.official_holidays, public.official_holiday_years from authenticated, anon;
revoke insert, update, delete on public.holiday_overrides, public.exceptional_delivery_dates from authenticated, anon;
revoke all on public.official_holidays, public.official_holiday_years,
  public.holiday_overrides, public.exceptional_delivery_dates from anon;

-- Official holidays of the household's country, minus the ones it suppressed, plus its own.
create view public.effective_holidays with (security_invoker = true) as
select h.id as household_id, o.holiday_date, o.name, 'official'::text as source
from public.households h
join public.official_holidays o on o.country_code = h.country_code
where not exists (
  select 1 from public.holiday_overrides r
  where r.household_id = h.id and r.holiday_date = o.holiday_date and r.action = 'remove'
)
union all
select r.household_id, r.holiday_date, coalesce(r.name, 'Feriado'), 'custom'::text
from public.holiday_overrides r
where r.action = 'add'
  and not exists (
    select 1 from public.official_holidays o
    join public.households h on h.id = r.household_id and h.country_code = o.country_code
    where o.holiday_date = r.holiday_date
  );

-- A CHECK cannot query other tables, so a trigger keeps holidays out of the exceptional dates.
create function public.exceptional_delivery_validate() returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.effective_holidays
    where household_id = new.household_id and holiday_date = new.delivery_date
  ) then
    raise exception 'E_INVALID_DATE';
  end if;
  return new;
end
$$;

create trigger exceptional_delivery_validate
  before insert or update on public.exceptional_delivery_dates
  for each row execute function public.exceptional_delivery_validate();

-- The caller's household, or an error when they have none.
create function public.require_household() returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  select household_id into v_household from public.household_members where user_id = auth.uid();
  if v_household is null then
    raise exception 'E_FORBIDDEN';
  end if;
  return v_household;
end
$$;

-- Adds a custom holiday, or restores an official one the household had suppressed.
-- Returns the (person, month) pairs that already have a meal on that date so the UI can reconcile.
create function public.add_holiday(p_date date, p_name text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.require_household();
begin
  if exists (
    select 1 from public.holiday_overrides
    where household_id = v_household and holiday_date = p_date and action = 'remove'
  ) then
    delete from public.holiday_overrides where household_id = v_household and holiday_date = p_date;
  elsif not exists (
    select 1 from public.effective_holidays where household_id = v_household and holiday_date = p_date
  ) then
    insert into public.holiday_overrides (household_id, holiday_date, action, name)
    values (v_household, p_date, 'add', coalesce(nullif(trim(p_name), ''), 'Feriado'));
  end if;

  -- An exceptional delivery on this date no longer makes sense.
  delete from public.exceptional_delivery_dates where household_id = v_household and delivery_date = p_date;

  return coalesce((
    select jsonb_agg(jsonb_build_object('person_id', person_id, 'month', month) order by person_id)
    from (
      select distinct person_id, date_trunc('month', meal_date)::date as month
      from public.meals where household_id = v_household and meal_date = p_date
    ) pairs
  ), '[]'::jsonb);
end
$$;

-- Removes a custom holiday or suppresses an official one. Returns the (person, month) pairs whose
-- plan window contains the date, because a new delivery day may now be eligible.
create function public.remove_holiday(p_date date) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.require_household();
begin
  if exists (
    select 1 from public.holiday_overrides
    where household_id = v_household and holiday_date = p_date and action = 'add'
  ) then
    delete from public.holiday_overrides where household_id = v_household and holiday_date = p_date;
  elsif exists (
    select 1 from public.effective_holidays
    where household_id = v_household and holiday_date = p_date and source = 'official'
  ) then
    insert into public.holiday_overrides (household_id, holiday_date, action)
    values (v_household, p_date, 'remove');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('person_id', id, 'month', date_trunc('month', p_date)::date) order by id)
    from public.people
    where household_id = v_household and active
      and plan_start_date <= p_date and (plan_end_date is null or plan_end_date >= p_date)
  ), '[]'::jsonb);
end
$$;

create function public.add_exceptional_delivery(p_date date, p_note text) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.require_household();
begin
  insert into public.exceptional_delivery_dates (household_id, delivery_date, note)
  values (v_household, p_date, p_note)
  on conflict (household_id, delivery_date) do update set note = excluded.note;
end
$$;

create function public.remove_exceptional_delivery(p_date date) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.require_household();
begin
  delete from public.exceptional_delivery_dates where household_id = v_household and delivery_date = p_date;
end
$$;

revoke execute on function public.require_household() from public, anon;
revoke execute on function public.add_holiday(date, text) from public, anon;
revoke execute on function public.remove_holiday(date) from public, anon;
revoke execute on function public.add_exceptional_delivery(date, text) from public, anon;
revoke execute on function public.remove_exceptional_delivery(date) from public, anon;
grant execute on function public.add_holiday(date, text) to authenticated;
grant execute on function public.remove_holiday(date) to authenticated;
grant execute on function public.add_exceptional_delivery(date, text) to authenticated;
grant execute on function public.remove_exceptional_delivery(date) to authenticated;
