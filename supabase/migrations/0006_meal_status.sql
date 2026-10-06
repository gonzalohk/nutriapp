-- Recording what happened to a meal, with a change log (who, when, from -> to).

create table public.meal_status_changes (
  id bigint generated always as identity primary key,
  meal_id uuid not null references public.meals (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  from_status public.meal_status not null,
  to_status public.meal_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null
);
create index meal_status_changes_meal_idx on public.meal_status_changes (meal_id, id);

alter table public.meal_status_changes enable row level security;
create policy status_changes_select on public.meal_status_changes
  for select to authenticated using (public.is_household_member(household_id));
revoke insert, update, delete on public.meal_status_changes from authenticated, anon;
revoke all on public.meal_status_changes from anon;

-- Whenever the status changes, stamp who/when and append to the log.
create function public.meals_log_status() returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status_changed_at is not distinct from old.status_changed_at then
      new.status_changed_at := now();
    end if;
    new.status_changed_by := auth.uid();
    insert into public.meal_status_changes (meal_id, household_id, from_status, to_status, changed_at, changed_by)
    values (new.id, new.household_id, old.status, new.status, new.status_changed_at, auth.uid());
  end if;
  return new;
end
$$;

create trigger meals_log_status
  before update of status on public.meals
  for each row execute function public.meals_log_status();

-- Records an outcome. Safe to replay (offline sync):
--  * choosing the current status changes only the note/reason, never the log;
--  * a change older than the one already recorded is ignored;
--  * the change time is the client time clamped to "now", so queued changes from one device keep
--    their order after syncing.
-- `p_note` null keeps the current note; an empty string clears it.
create function public.set_meal_status(
  p_meal uuid,
  p_status public.meal_status,
  p_note text default null,
  p_reason text default null,
  p_client_ts timestamptz default null
) returns public.meals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meal public.meals;
  v_ts timestamptz;
  v_note text;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  select * into v_meal from public.meals where id = p_meal for update;
  if not found or not public.is_household_member(v_meal.household_id) then
    raise exception 'E_NOT_FOUND';
  end if;
  if p_status = 'scheduled' then
    raise exception 'E_INVALID_STATUS';
  end if;

  v_ts := least(coalesce(p_client_ts, now()), now());
  v_note := case when p_note is null then v_meal.note else nullif(p_note, '') end;
  v_reason := case
    when p_status <> 'permission' then null
    when p_reason is null then v_meal.permission_reason
    else nullif(p_reason, '')
  end;

  if v_meal.status = p_status then
    if v_note is not distinct from v_meal.note and v_reason is not distinct from v_meal.permission_reason then
      return v_meal;
    end if;
    update public.meals set note = v_note, permission_reason = v_reason
    where id = p_meal returning * into v_meal;
    return v_meal;
  end if;

  if v_meal.status <> 'scheduled' and v_ts < v_meal.status_changed_at then
    return v_meal; -- an older queued change: the newer one wins
  end if;

  update public.meals
  set status = p_status, note = v_note, permission_reason = v_reason, status_changed_at = v_ts
  where id = p_meal returning * into v_meal;
  return v_meal;
end
$$;

revoke execute on function public.set_meal_status(uuid, public.meal_status, text, text, timestamptz) from public, anon;
grant execute on function public.set_meal_status(uuid, public.meal_status, text, text, timestamptz) to authenticated;
