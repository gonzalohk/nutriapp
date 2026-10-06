-- Meals dated before the start of the person's current plan window belong to an earlier period
-- (someone who left and came back). They are never removed nor flagged for review.

drop function public.apply_month_plan(uuid, date, date[], int, boolean);

create function public.apply_month_plan(
  p_person uuid,
  p_month date,
  p_dates date[],
  p_contracted int,
  p_is_partial boolean,
  p_window_start date default null
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
  where monthly_plan_id = v_plan and status = 'scheduled'
    and not (meal_date = any (v_dates))
    and (p_window_start is null or meal_date >= p_window_start);

  insert into public.meals (monthly_plan_id, person_id, household_id, meal_date)
  select v_plan, p_person, v_person.household_id, d from unnest(v_dates) d
  on conflict (person_id, meal_date) do nothing;

  update public.monthly_plans set needs_review = exists (
    select 1 from public.meals
    where monthly_plan_id = v_plan and status <> 'scheduled'
      and not (meal_date = any (v_dates))
      and (p_window_start is null or meal_date >= p_window_start)
  ) where id = v_plan;

  return v_plan;
end
$$;

revoke execute on function public.apply_month_plan(uuid, date, date[], int, boolean, date) from public, anon;
grant execute on function public.apply_month_plan(uuid, date, date[], int, boolean, date) to authenticated;
