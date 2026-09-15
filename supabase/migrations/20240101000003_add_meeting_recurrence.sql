-- Run this in your Supabase SQL editor
-- Adds columns used by recurring meetings (utils/meetings.js, lib/sync.js).
-- end_date: meetings stop recurring on/after this date (YYYY-MM-DD)
-- skip_dates: individual recurrence instances the user deleted
alter table meetings add column if not exists end_date  text;
alter table meetings add column if not exists skip_dates text[] default '{}'::text[];
