-- Run this in your Supabase SQL editor
create table if not exists pomo_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       uuid,          -- nullable; task may be deleted later
  task_title    text,
  completed_at  timestamptz not null default now(),
  duration_mins int not null default 25,
  session_type  text not null default 'work'
);

alter table pomo_sessions enable row level security;

create policy "Users see own sessions"
  on pomo_sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on pomo_sessions for insert
  with check (auth.uid() = user_id);

create index on pomo_sessions (user_id, completed_at desc);
