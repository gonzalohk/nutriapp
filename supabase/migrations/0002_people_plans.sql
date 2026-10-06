-- People covered by the plan, and the plan terms in force from each month.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text,
  active boolean not null default true,
  plan_start_date date not null,
  plan_end_date date,
  created_at timestamptz not null default now(),
  check (plan_end_date is null or plan_end_date >= plan_start_date)
);
create index people_household_idx on public.people (household_id);

-- A change of terms adds a row, so past months keep the terms they were generated with.
create table public.plan_terms (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  effective_from date not null check (extract(day from effective_from) = 1),
  meals_per_month int not null default 20 check (meals_per_month > 0),
  delivery_weekdays smallint[] not null default '{1,2,3,4,5}'
    check (delivery_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
           and cardinality(delivery_weekdays) > 0),
  selection_rule text not null default 'first_n' check (selection_rule in ('first_n')),
  pickup_time time,
  unique (person_id, effective_from)
);

alter table public.people enable row level security;
alter table public.plan_terms enable row level security;

create policy people_select on public.people
  for select to authenticated using (public.is_household_member(household_id));
create policy people_insert on public.people
  for insert to authenticated with check (public.is_household_member(household_id));
create policy people_update on public.people
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- People are never deleted from the app: deactivate instead (spec FR-007).
revoke delete on public.people from authenticated, anon;
revoke all on public.people, public.plan_terms from anon;

create function public.person_in_my_household(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.people p
    where p.id = p_person and public.is_household_member(p.household_id)
  )
$$;

create policy plan_terms_select on public.plan_terms
  for select to authenticated using (public.person_in_my_household(person_id));
create policy plan_terms_insert on public.plan_terms
  for insert to authenticated with check (public.person_in_my_household(person_id));
create policy plan_terms_update on public.plan_terms
  for update to authenticated
  using (public.person_in_my_household(person_id))
  with check (public.person_in_my_household(person_id));
create policy plan_terms_delete on public.plan_terms
  for delete to authenticated using (public.person_in_my_household(person_id));
