-- Recipe Book Schema
-- Run this in Supabase SQL Editor

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  source_type text check (source_type in ('manual', 'pdf', 'image', 'url', 'camera')),
  source_url text,
  image_url text,
  base_servings int default 4,
  prep_time_minutes int,
  cook_time_minutes int,
  category text check (category in (
    'mains', 'soups', 'sides', 'salads', 'breads', 'breakfast',
    'appetizers', 'snacks', 'desserts', 'drinks', 'sauces'
  )),
  cuisine text,
  tags text[],
  is_favorite boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  position int not null,
  name text not null,
  amount numeric,
  unit text,
  notes text,
  category text
);

create table if not exists steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  position int not null,
  instruction text not null,
  timer_seconds int
);

create table if not exists shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text default 'My Shopping List',
  created_at timestamptz default now()
);

create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references shopping_lists(id) on delete cascade,
  recipe_id uuid references recipes(id) on delete set null,
  ingredient_name text not null,
  amount numeric,
  unit text,
  category text,
  checked boolean default false,
  servings_multiplier numeric default 1
);

create table if not exists recipe_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  note_type text check (note_type in ('pinned', 'session', 'step')),
  step_position int,
  content text not null,
  rating int check (rating between 1 and 5),
  cooked_at date,
  created_at timestamptz default now()
);

create table if not exists recipe_photos (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  storage_path text not null,
  photo_type text check (photo_type in ('hero', 'step', 'session')),
  step_position int,
  note_id uuid references recipe_notes(id) on delete set null,
  caption text,
  created_at timestamptz default now()
);

create unique index if not exists one_hero_per_recipe
  on recipe_photos (recipe_id) where photo_type = 'hero';
