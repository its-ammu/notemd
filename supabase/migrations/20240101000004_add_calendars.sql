-- Run this in your Supabase SQL editor (or `supabase db push`).
-- Adds named calendars to the tracker. Purely additive and safe to re-run:
--   * a new `calendars` table,
--   * a nullable `calendar_id` on tasks and meetings.
-- Existing rows are not rewritten. A NULL calendar_id means "the default
-- calendar", so every task and meeting that exists today stays exactly where
-- it is, and clients that don't know about calendars keep working unchanged.

create table if not exists calendars (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '',   -- encrypted client-side, like notebook names
  position   int not null default 0,
  -- Marks the row that only carries the default calendar's name.
  -- Items on the default calendar keep calendar_id NULL; they never point here.
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendars_user_id_idx on calendars (user_id);

-- Its own trigger function: older projects call theirs set_updated_at(),
-- newer ones touch_updated_at(), so depending on either would break the other.
create or replace function calendars_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendars_set_updated_at on calendars;
create trigger calendars_set_updated_at before update on calendars
  for each row execute function calendars_touch_updated_at();

alter table calendars enable row level security;

drop policy if exists "Users manage own calendars" on calendars;
create policy "Users manage own calendars" on calendars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Signed-in users only, and (per the policy above) only their own rows.
-- Supabase normally grants this by default; spelled out so it never depends on it.
grant select, insert, update, delete on calendars to authenticated;

-- Deleting a calendar never deletes what was on it: its tasks and meetings
-- fall back to the default calendar.
alter table tasks    add column if not exists calendar_id uuid references calendars(id) on delete set null;
alter table meetings add column if not exists calendar_id uuid references calendars(id) on delete set null;

create index if not exists tasks_calendar_id_idx    on tasks (calendar_id)    where calendar_id is not null;
create index if not exists meetings_calendar_id_idx on meetings (calendar_id) where calendar_id is not null;

-- Let the API see the new table and columns straight away.
notify pgrst, 'reload schema';
