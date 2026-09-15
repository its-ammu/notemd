-- Baseline schema for NoteMD.
-- Run against a fresh Supabase project (via `supabase db push` or the SQL
-- editor) before running the migrations that follow this one.

create table if not exists notebooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '',
  color      text,
  paper      text,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  notebook_id uuid not null references notebooks(id) on delete cascade,
  title       text not null default '',
  body        text not null default '',
  tags        text[] not null default '{}'::text[],
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        text not null, -- YYYY-MM-DD
  title      text not null default '',
  done       boolean not null default false,
  priority   text not null default 'none',
  subtasks   jsonb not null default '[]'::jsonb,
  linked_page_id uuid references pages(id) on delete set null,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meetings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        text not null, -- YYYY-MM-DD
  title      text not null default '',
  time       text,
  duration   int not null default 30,
  repeat     text not null default 'none',
  notes      text not null default '',
  linked_page_id uuid references pages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists pages_notebook_id_idx on pages (notebook_id);
create index if not exists tasks_user_id_day_idx on tasks (user_id, day);
create index if not exists meetings_user_id_day_idx on meetings (user_id, day);

-- ---------- updated_at maintenance ----------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notebooks_set_updated_at before update on notebooks
  for each row execute function set_updated_at();
create trigger pages_set_updated_at before update on pages
  for each row execute function set_updated_at();
create trigger tasks_set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger meetings_set_updated_at before update on meetings
  for each row execute function set_updated_at();
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ---------- auto-create a profile row on signup ----------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- row level security ----------

alter table notebooks enable row level security;
alter table pages     enable row level security;
alter table tasks     enable row level security;
alter table meetings  enable row level security;
alter table profiles  enable row level security;

create policy "Users manage own notebooks" on notebooks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own pages" on pages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own meetings" on meetings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- storage: page images ----------

insert into storage.buckets (id, name, public)
values ('page-images', 'page-images', true)
on conflict (id) do nothing;

create policy "Users upload own page images" on storage.objects
  for insert with check (
    bucket_id = 'page-images' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users manage own page images" on storage.objects
  for update using (
    bucket_id = 'page-images' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own page images" on storage.objects
  for delete using (
    bucket_id = 'page-images' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view page images" on storage.objects
  for select using (bucket_id = 'page-images');
