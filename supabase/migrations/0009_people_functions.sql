-- Creating a person always creates their first plan terms in the same transaction, so a person can
-- never exist without terms.

create function public.create_person(
  p_first_name text,
  p_last_name text,
  p_plan_start date,
  p_meals_per_month int default 20
) returns public.people
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.require_household();
  v_person public.people;
begin
  insert into public.people (household_id, first_name, last_name, plan_start_date)
  values (v_household, p_first_name, nullif(trim(p_last_name), ''), p_plan_start)
  returning * into v_person;

  insert into public.plan_terms (person_id, effective_from, meals_per_month)
  values (v_person.id, date_trunc('month', p_plan_start)::date, p_meals_per_month);

  return v_person;
end
$$;

revoke execute on function public.create_person(text, text, date, int) from public, anon;
grant execute on function public.create_person(text, text, date, int) to authenticated;
