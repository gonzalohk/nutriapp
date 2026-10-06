-- One compressed photo per meal, stored in a private bucket. The database keeps paths, never URLs;
-- the app asks for short-lived signed URLs.

create table public.meal_photos (
  id uuid primary key,
  meal_id uuid not null unique references public.meals (id) on delete cascade, -- one photo per meal
  household_id uuid not null references public.households (id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  mime_type text not null check (mime_type in ('image/webp', 'image/jpeg')),
  bytes int not null check (bytes > 0 and bytes <= 2097152),
  width int,
  height int,
  taken_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index meal_photos_household_idx on public.meal_photos (household_id);

alter table public.meal_photos enable row level security;
create policy meal_photos_select on public.meal_photos
  for select to authenticated using (public.is_household_member(household_id));
revoke insert, update, delete on public.meal_photos from authenticated, anon;
revoke all on public.meal_photos from anon;

-- Private bucket: no public URLs, 2 MB per object, only webp or jpeg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg'];

-- Folder names must be household ids; a malformed name yields NULL (denied) instead of an error.
create function public.try_uuid(p_value text) returns uuid
language plpgsql
immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end
$$;

-- Objects live under "{household_id}/...": members can read, add and delete their own folder only.
create policy meal_photos_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'meal-photos' and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));
create policy meal_photos_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meal-photos' and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));
create policy meal_photos_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'meal-photos' and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));

-- Attaches the meal's photo, replacing any existing one. Returns the previous object paths so the
-- client can delete them from storage. Paths must stay inside the household's own folder.
create function public.replace_meal_photo(
  p_meal uuid,
  p_photo uuid,
  p_storage_path text,
  p_thumb_path text,
  p_mime text,
  p_bytes int,
  p_width int,
  p_height int,
  p_taken_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meal public.meals;
  v_old public.meal_photos;
  v_prefix text;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  select * into v_meal from public.meals where id = p_meal;
  if not found or not public.is_household_member(v_meal.household_id) then
    raise exception 'E_NOT_FOUND';
  end if;
  v_prefix := v_meal.household_id::text || '/';
  if left(p_storage_path, length(v_prefix)) <> v_prefix or left(p_thumb_path, length(v_prefix)) <> v_prefix then
    raise exception 'E_INVALID_PATH';
  end if;

  select * into v_old from public.meal_photos where meal_id = p_meal;
  delete from public.meal_photos where meal_id = p_meal;
  insert into public.meal_photos
    (id, meal_id, household_id, storage_path, thumb_path, mime_type, bytes, width, height, taken_at, created_by)
  values
    (p_photo, p_meal, v_meal.household_id, p_storage_path, p_thumb_path, p_mime, p_bytes, p_width, p_height, p_taken_at, auth.uid());

  return jsonb_build_object(
    'previous_storage_path', v_old.storage_path,
    'previous_thumb_path', v_old.thumb_path
  );
end
$$;

-- Deletes the photo row and returns its object paths; the meal status is untouched.
create function public.delete_meal_photo(p_photo uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_photo public.meal_photos;
begin
  if auth.uid() is null then
    raise exception 'E_NOT_AUTHENTICATED';
  end if;
  select * into v_photo from public.meal_photos where id = p_photo;
  if not found or not public.is_household_member(v_photo.household_id) then
    raise exception 'E_NOT_FOUND';
  end if;
  delete from public.meal_photos where id = p_photo;
  return jsonb_build_object('storage_path', v_photo.storage_path, 'thumb_path', v_photo.thumb_path);
end
$$;

revoke execute on function public.replace_meal_photo(uuid, uuid, text, text, text, int, int, int, timestamptz) from public, anon;
revoke execute on function public.delete_meal_photo(uuid) from public, anon;
grant execute on function public.replace_meal_photo(uuid, uuid, text, text, text, int, int, int, timestamptz) to authenticated;
grant execute on function public.delete_meal_photo(uuid) to authenticated;
