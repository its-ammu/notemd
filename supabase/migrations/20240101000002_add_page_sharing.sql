-- Run this in your Supabase SQL editor.
-- Adds public sharing of individual notebook pages via an unguessable token,
-- with optional expiry and an option to hide tags from public readers.

-- 1. Columns on pages to track public-share state.
alter table pages add column if not exists is_public         boolean     not null default false;
alter table pages add column if not exists public_token      text        unique;
alter table pages add column if not exists shared_at         timestamptz;
alter table pages add column if not exists public_expires_at timestamptz;
alter table pages add column if not exists public_hide_tags  boolean     not null default false;

create index if not exists pages_public_token_idx on pages (public_token) where is_public;

-- 2. Owners flip these flags. The app's normal sync upsert only writes a fixed
--    column set (title/body/tags/position), so we expose a small SECURITY
--    DEFINER helper that lets a signed-in user toggle sharing on their OWN page
--    and set expiry / hide-tags / mint the token in one call.
drop function if exists set_page_public(uuid, boolean);
create or replace function set_page_public(
  p_page_id    uuid,
  p_public     boolean,
  p_expires_at timestamptz default null,
  p_hide_tags  boolean     default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_public then
    -- Reuse an existing token if the page was shared before.
    select public_token into v_token from pages
      where id = p_page_id and user_id = auth.uid();
    if v_token is null then
      -- gen_random_uuid() is Postgres core (no pgcrypto/search_path issues);
      -- two of them stripped of dashes gives a 64-char unguessable token.
      v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    end if;
    update pages
      set is_public         = true,
          public_token      = v_token,
          shared_at         = now(),
          public_expires_at = p_expires_at,
          public_hide_tags  = coalesce(p_hide_tags, false)
      where id = p_page_id and user_id = auth.uid();
    if not found then
      raise exception 'page not found or not owned by caller';
    end if;
    return v_token;
  else
    update pages
      set is_public = false
      where id = p_page_id and user_id = auth.uid();
    -- Keep public_token so re-sharing yields a stable link; just flip the flag.
    return null;
  end if;
end;
$$;

revoke all on function set_page_public(uuid, boolean, timestamptz, boolean) from public;
grant execute on function set_page_public(uuid, boolean, timestamptz, boolean) to authenticated;

-- 3. Anonymous (and authenticated) readers fetch a shared page by token.
--    SECURITY DEFINER so we never have to open the whole pages table to anon
--    via RLS — only public, non-expired rows, only reader-safe fields. Tags are
--    withheld when the owner chose to hide them.
create or replace function get_public_page(p_token text)
returns table (
  title          text,
  body           text,
  tags           text[],
  updated_at     timestamptz,
  notebook_name  text,
  notebook_color text
)
language sql
security definer
set search_path = public
as $$
  select
    p.title,
    p.body,
    case when p.public_hide_tags then null::text[] else p.tags end,
    p.updated_at,
    n.name,
    n.color
  from pages p
  join notebooks n on n.id = p.notebook_id
  where p.public_token = p_token
    and p.is_public = true
    and (p.public_expires_at is null or p.public_expires_at > now())
  limit 1;
$$;

revoke all on function get_public_page(text) from public;
grant execute on function get_public_page(text) to anon, authenticated;
