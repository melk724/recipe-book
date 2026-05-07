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
  category text -- produce, dairy, meat, pantry, etc. for shopping list grouping
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

-- Row level security
alter table recipes enable row level security;
alter table ingredients enable row level security;
alter table steps enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;

create policy "Users see own recipes" on recipes for all using (auth.uid() = user_id);
create policy "Users see own ingredients" on ingredients for all using (
  exists (select 1 from recipes where recipes.id = ingredients.recipe_id and recipes.user_id = auth.uid())
);
create policy "Users see own steps" on steps for all using (
  exists (select 1 from recipes where recipes.id = steps.recipe_id and recipes.user_id = auth.uid())
);
create policy "Users see own lists" on shopping_lists for all using (auth.uid() = user_id);
create policy "Users see own list items" on shopping_list_items for all using (
  exists (select 1 from shopping_lists where shopping_lists.id = shopping_list_items.list_id and shopping_lists.user_id = auth.uid())
);

-- Storage bucket for recipe images (create via Supabase dashboard or this SQL):
-- insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', true);

-- ============================================
-- Notes & Photos additions
-- ============================================

create table if not exists recipe_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  note_type text check (note_type in ('pinned', 'session', 'step')),
  step_position int, -- only set when note_type = 'step', references steps.position
  content text not null,
  rating int check (rating between 1 and 5), -- only used for session notes
  cooked_at date, -- when the cooking session happened
  created_at timestamptz default now()
);

create table if not exists recipe_photos (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  storage_path text not null, -- path in the recipe-images bucket
  photo_type text check (photo_type in ('hero', 'step', 'session')),
  step_position int, -- when photo_type = 'step'
  note_id uuid references recipe_notes(id) on delete set null, -- link to the cook session note
  caption text,
  created_at timestamptz default now()
);

-- Each recipe has at most one hero photo
create unique index if not exists one_hero_per_recipe
  on recipe_photos (recipe_id) where photo_type = 'hero';

alter table recipe_notes enable row level security;
alter table recipe_photos enable row level security;

create policy "Users see own notes" on recipe_notes for all using (auth.uid() = user_id);
create policy "Users see own photos" on recipe_photos for all using (auth.uid() = user_id);
