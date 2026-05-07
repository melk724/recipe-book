-- ============================================
-- Multi-user migration + Spotify + bug fix consolidations
-- Run this in Supabase SQL Editor AFTER you have created your auth account.
-- (Sign in to your live app first, then come back and run this.)
-- ============================================

-- 1. Create the per-user Spotify tokens table
create table if not exists spotify_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text not null,
  spotify_display_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Backfill: assign all existing data to YOUR account.
-- Replace the email below with the address you signed up with.
-- THIS ONLY RUNS ONCE — if it has nothing to update, that's fine.
do $$
declare
  my_user_id uuid;
  keep_list_id uuid;
begin
  -- Find the first auth user with the matching email
  select id into my_user_id from auth.users
  where email = 'YOUR_EMAIL_HERE@example.com'  -- ← CHANGE THIS
  limit 1;

  if my_user_id is null then
    raise notice 'No user found with that email yet — sign up first, then re-run this.';
    return;
  end if;

  -- Assign existing recipes to you (only those without a user_id)
  update recipes set user_id = my_user_id where user_id is null;
  update recipe_notes set user_id = my_user_id where user_id is null;
  update recipe_photos set user_id = my_user_id where user_id is null;
  update shopping_lists set user_id = my_user_id where user_id is null;

  -- Consolidate orphaned shopping lists (the bug fix from earlier)
  select id into keep_list_id from shopping_lists
  where user_id = my_user_id
  order by created_at desc
  limit 1;

  if keep_list_id is not null then
    update shopping_list_items set list_id = keep_list_id;
    delete from shopping_lists
    where user_id = my_user_id and id != keep_list_id;
  end if;

  raise notice 'Backfill complete. All existing data assigned to user_id %', my_user_id;
end $$;

-- 3. Re-enable Row Level Security on every table
alter table recipes enable row level security;
alter table ingredients enable row level security;
alter table steps enable row level security;
alter table recipe_notes enable row level security;
alter table recipe_photos enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;
alter table spotify_tokens enable row level security;

-- 4. Drop old policies if they exist, then recreate
drop policy if exists "Users see own recipes" on recipes;
drop policy if exists "Users see own ingredients" on ingredients;
drop policy if exists "Users see own steps" on steps;
drop policy if exists "Users see own lists" on shopping_lists;
drop policy if exists "Users see own list items" on shopping_list_items;
drop policy if exists "Users see own notes" on recipe_notes;
drop policy if exists "Users see own photos" on recipe_photos;
drop policy if exists "Users see own spotify tokens" on spotify_tokens;

create policy "Users see own recipes" on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users see own ingredients" on ingredients
  for all using (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
  );

create policy "Users see own steps" on steps
  for all using (
    exists (select 1 from recipes where recipes.id = steps.recipe_id and recipes.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes where recipes.id = steps.recipe_id and recipes.user_id = auth.uid())
  );

create policy "Users see own lists" on shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users see own list items" on shopping_list_items
  for all using (
    exists (select 1 from shopping_lists where shopping_lists.id = shopping_list_items.list_id and shopping_lists.user_id = auth.uid())
  ) with check (
    exists (select 1 from shopping_lists where shopping_lists.id = shopping_list_items.list_id and shopping_lists.user_id = auth.uid())
  );

create policy "Users see own notes" on recipe_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users see own photos" on recipe_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users see own spotify tokens" on spotify_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Storage bucket policies for recipe photos
-- The bucket is public so anyone with a URL can read images (getPublicUrl works).
-- But uploads/updates/deletes are restricted to the owner.
-- (This relies on the upload path being `{user_id}/{recipe_id}/...` which our app already does.)

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'recipe-images%'
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "recipe-images: users insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-images: users update own"
  on storage.objects for update
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recipe-images: users delete own"
  on storage.objects for delete
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
