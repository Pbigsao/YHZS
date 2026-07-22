-- Complete Supabase setup for a new project.
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- This file is intended for a fresh database and combines the schema, policies,
-- forum features, seed data, voting fixes, and username-login support.
-- Do not run this file on a database that already has these migrations applied.

-- BEGIN 202607190001_initial_schema.sql

create extension if not exists pgcrypto;

create type public.app_role as enum ('member', 'admin', 'super_admin');
create type public.content_status as enum ('pending', 'approved', 'rejected', 'hidden', 'removed');
create type public.activity_status as enum ('draft', 'published', 'closed', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_url text,
  role public.app_role not null default 'member',
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 50),
  description text,
  position integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id),
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 2 and 160),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  search_document tsvector generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body #>> '{}', ''))) stored,
  status public.content_status not null default 'pending',
  moderated_at timestamptz,
  moderated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_public_search_idx on public.posts using gin(search_document);
create index posts_board_status_idx on public.posts(board_id, status, created_at desc);

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0 check (position between 0 and 4),
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  parent_id uuid references public.comments(id) on delete cascade,
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  status public.content_status not null default 'pending',
  moderated_at timestamptz,
  moderated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_status_idx on public.comments(post_id, status, created_at);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null check (char_length(title) between 2 and 160),
  description jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  cover_path text,
  status public.activity_status not null default 'draft',
  submission_starts_at timestamptz not null,
  submission_ends_at timestamptz not null,
  voting_starts_at timestamptz not null,
  voting_ends_at timestamptz not null,
  vote_limit integer not null default 1 check (vote_limit between 1 and 100),
  allow_vote_change boolean not null default true,
  results_visible boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (submission_starts_at < submission_ends_at),
  check (submission_ends_at <= voting_starts_at),
  check (voting_starts_at < voting_ends_at)
);

create table public.activity_submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 2 and 160),
  body jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  status public.content_status not null default 'pending',
  moderated_at timestamptz,
  moderated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id, author_id)
);
create index submissions_activity_status_idx on public.activity_submissions(activity_id, status, created_at desc);

create table public.submission_images (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.activity_submissions(id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0 check (position between 0 and 9),
  created_at timestamptz not null default now()
);

create table public.activity_votes (
  activity_id uuid not null references public.activities(id) on delete cascade,
  submission_id uuid not null references public.activity_submissions(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, submission_id, voter_id)
);
create index activity_votes_submission_idx on public.activity_votes(submission_id);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment', 'submission', 'user')),
  target_id uuid not null,
  action public.content_status,
  reason text,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create function public.current_role() returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() in ('admin', 'super_admin') $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() = 'super_admin' $$;
create function public.is_active_member() returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and not is_banned) $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Member-' || substr(new.id::text, 1, 8)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.cast_activity_vote(target_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target_activity public.activities; count_used integer;
begin
  select a.* into target_activity from public.activities a join public.activity_submissions s on s.activity_id = a.id where s.id = target_submission and s.status = 'approved' for update;
  if target_activity.id is null or target_activity.status <> 'published' or now() < target_activity.voting_starts_at or now() >= target_activity.voting_ends_at then raise exception 'Voting is not open'; end if;
  if not public.is_active_member() then raise exception 'Active verified account required'; end if;
  if exists(select 1 from public.activity_votes where activity_id = target_activity.id and submission_id = target_submission and voter_id = auth.uid()) then return; end if;
  select count(*) into count_used from public.activity_votes where activity_id = target_activity.id and voter_id = auth.uid();
  if count_used >= target_activity.vote_limit then raise exception 'Vote allowance exhausted'; end if;
  insert into public.activity_votes(activity_id, submission_id, voter_id) values(target_activity.id, target_submission, auth.uid());
end;
$$;

create function public.enforce_image_limit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'post_images' and (select count(*) from public.post_images where post_id = new.post_id) >= 5 then
    raise exception 'A post may contain at most 5 images';
  end if;
  if tg_table_name = 'submission_images' and (select count(*) from public.submission_images where submission_id = new.submission_id) >= 10 then
    raise exception 'A submission may contain at most 10 images';
  end if;
  return new;
end;
$$;
create trigger post_image_limit before insert on public.post_images for each row execute procedure public.enforce_image_limit();
create trigger submission_image_limit before insert on public.submission_images for each row execute procedure public.enforce_image_limit();

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.activities enable row level security;
alter table public.activity_submissions enable row level security;
alter table public.submission_images enable row level security;
alter table public.activity_votes enable row level security;
alter table public.moderation_events enable row level security;

create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = public.current_role());
create policy "boards public read" on public.boards for select using (not is_archived or public.is_staff());
create policy "boards admin write" on public.boards for all using (public.is_admin()) with check (public.is_admin());
create policy "posts public approved read" on public.posts for select using (status = 'approved' or author_id = auth.uid() or public.is_staff());
create policy "posts member create" on public.posts for insert with check (author_id = auth.uid() and public.is_active_member() and status = 'pending');
create policy "posts owner update pending" on public.posts for update using (author_id = auth.uid() and status in ('pending', 'rejected')) with check (author_id = auth.uid() and status = 'pending');
create policy "posts staff update" on public.posts for update using (public.is_staff()) with check (public.is_staff());
create policy "post images readable with post" on public.post_images for select using (exists(select 1 from public.posts p where p.id = post_id and (p.status = 'approved' or p.author_id = auth.uid() or public.is_staff())));
create policy "post images owner insert" on public.post_images for insert with check (exists(select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid() and public.is_active_member()));
create policy "comments public approved read" on public.comments for select using (status = 'approved' or author_id = auth.uid() or public.is_staff());
create policy "comments member create" on public.comments for insert with check (author_id = auth.uid() and public.is_active_member() and status = 'pending' and exists(select 1 from public.posts where id = post_id and status = 'approved'));
create policy "comments staff update" on public.comments for update using (public.is_staff()) with check (public.is_staff());
create policy "post likes public read" on public.post_likes for select using (true);
create policy "post likes member write" on public.post_likes for insert with check (user_id = auth.uid() and public.is_active_member());
create policy "post likes self delete" on public.post_likes for delete using (user_id = auth.uid());
create policy "comment likes public read" on public.comment_likes for select using (true);
create policy "comment likes member write" on public.comment_likes for insert with check (user_id = auth.uid() and public.is_active_member());
create policy "comment likes self delete" on public.comment_likes for delete using (user_id = auth.uid());
create policy "activities public visible read" on public.activities for select using (status in ('published', 'closed') or public.is_staff());
create policy "activities admin write" on public.activities for all using (public.is_admin()) with check (public.is_admin());
create policy "submissions public approved read" on public.activity_submissions for select using (status = 'approved' or author_id = auth.uid() or public.is_staff());
create policy "submissions member create" on public.activity_submissions for insert with check (author_id = auth.uid() and public.is_active_member() and status = 'pending' and exists(select 1 from public.activities where id = activity_id and status = 'published' and now() >= submission_starts_at and now() < submission_ends_at));
create policy "submissions staff update" on public.activity_submissions for update using (public.is_staff()) with check (public.is_staff());
create policy "submission images read" on public.submission_images for select using (exists(select 1 from public.activity_submissions s where s.id = submission_id and (s.status = 'approved' or s.author_id = auth.uid() or public.is_staff())));
create policy "submission images owner insert" on public.submission_images for insert with check (exists(select 1 from public.activity_submissions s where s.id = submission_id and s.author_id = auth.uid() and public.is_active_member()));
create policy "votes results public read" on public.activity_votes for select using (exists(select 1 from public.activities where id = activity_id and results_visible) or voter_id = auth.uid() or public.is_staff());
create policy "votes through rpc only" on public.activity_votes for insert with check (false);
create policy "moderation staff read" on public.moderation_events for select using (public.is_staff());
create policy "moderation staff write" on public.moderation_events for insert with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-images', 'community-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
create policy "public image read" on storage.objects for select using (bucket_id = 'community-images');
create policy "users upload own image paths" on storage.objects for insert with check (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_member());
create policy "users delete own images" on storage.objects for delete using (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- RLS can limit rows but not columns. Members must never be able to clear bans
-- or elevate their own role through a profile update.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;
-- END 202607190001_initial_schema.sql

-- BEGIN 202607190002_add_super_admin_role.sql

alter type public.app_role add value if not exists 'super_admin';
-- END 202607190002_add_super_admin_role.sql

-- BEGIN 202607190003_update_role_permissions.sql

update public.profiles
set role = 'super_admin'
where role::text = 'admin';

update public.profiles
set role = 'admin'
where role::text = 'reviewer';

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() in ('admin', 'super_admin') $$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() = 'super_admin' $$;

create or replace function public.set_member_role(target_user uuid, target_role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'super_admin' then
    raise exception 'Super administrator role required';
  end if;
  if target_user = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  update public.profiles set role = target_role, updated_at = now() where id = target_user;
end;
$$;

grant execute on function public.set_member_role(uuid, public.app_role) to authenticated;
-- END 202607190003_update_role_permissions.sql

-- BEGIN SQL_EDITOR_CATCH_UP.sql
-- Paste this entire file into Supabase Dashboard > SQL Editor.
-- For databases where migrations 202607190001 through 202607190003 already exist.
-- This applies the later forum feed, markdown, revision, board, and example-content changes.
-- It does not recreate tables or enum types.
-- BEGIN 202607190004_topic_feed_metrics.sql

alter table public.posts
  add column if not exists is_pinned boolean not null default false,
  add column if not exists view_count integer not null default 0 check (view_count >= 0),
  add column if not exists reply_count integer not null default 0 check (reply_count >= 0),
  add column if not exists like_count integer not null default 0 check (like_count >= 0),
  add column if not exists last_activity_at timestamptz not null default now();

create index if not exists posts_feed_latest_idx on public.posts(status, is_pinned desc, created_at desc);
create index if not exists posts_feed_activity_idx on public.posts(status, is_pinned desc, last_activity_at desc);

create or replace function public.sync_post_metrics(target_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.posts p
  set
    reply_count = (select count(*) from public.comments c where c.post_id = target_post and c.status = 'approved'),
    like_count = (select count(*) from public.post_likes l where l.post_id = target_post),
    last_activity_at = greatest(
      p.created_at,
      coalesce((select max(c.created_at) from public.comments c where c.post_id = target_post and c.status = 'approved'), p.created_at)
    )
  where p.id = target_post;
end;
$$;

create or replace function public.handle_comment_metrics() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_post_metrics(coalesce(new.post_id, old.post_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_post_like_metrics() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_post_metrics(coalesce(new.post_id, old.post_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists comments_sync_post_metrics on public.comments;
create trigger comments_sync_post_metrics
after insert or update of status or delete on public.comments
for each row execute procedure public.handle_comment_metrics();

drop trigger if exists post_likes_sync_post_metrics on public.post_likes;
create trigger post_likes_sync_post_metrics
after insert or delete on public.post_likes
for each row execute procedure public.handle_post_like_metrics();

update public.posts p
set
  reply_count = (select count(*) from public.comments c where c.post_id = p.id and c.status = 'approved'),
  like_count = (select count(*) from public.post_likes l where l.post_id = p.id),
  last_activity_at = greatest(
    p.created_at,
    coalesce((select max(c.created_at) from public.comments c where c.post_id = p.id and c.status = 'approved'), p.created_at)
  );

create or replace function public.increment_post_view(target_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.posts
  set view_count = view_count + 1
  where id = target_post and status = 'approved';
end;
$$;

create or replace function public.set_post_pinned(target_post uuid, pinned boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Super administrator role required';
  end if;
  update public.posts set is_pinned = pinned where id = target_post and status = 'approved';
end;
$$;

create or replace function public.search_public_posts(
  search_query text default '',
  sort_by text default 'latest',
  target_board uuid default null
) returns table(
  id uuid,
  title text,
  created_at timestamptz,
  last_activity_at timestamptz,
  board_id uuid,
  board_name text,
  board_slug text,
  author_name text,
  avatar_url text,
  reply_count integer,
  like_count integer,
  view_count integer,
  is_pinned boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.title,
    p.created_at,
    p.last_activity_at,
    b.id,
    b.name,
    b.slug,
    pr.display_name,
    pr.avatar_url,
    p.reply_count,
    p.like_count,
    p.view_count,
    p.is_pinned
  from public.posts p
  join public.boards b on b.id = p.board_id
  join public.profiles pr on pr.id = p.author_id
  where p.status = 'approved'
    and not b.is_archived
    and (target_board is null or p.board_id = target_board)
    and (coalesce(search_query, '') = '' or p.search_document @@ websearch_to_tsquery('simple', search_query))
  order by
    p.is_pinned desc,
    case when sort_by = 'hot' then p.like_count * 2 + p.reply_count end desc nulls last,
    case when sort_by = 'replies' then p.last_activity_at end desc nulls last,
    case when sort_by = 'latest' then p.created_at end desc nulls last,
    p.created_at desc;
$$;

grant execute on function public.increment_post_view(uuid) to anon, authenticated;
grant execute on function public.set_post_pinned(uuid, boolean) to authenticated;
grant execute on function public.search_public_posts(text, text, uuid) to anon, authenticated;

-- END 202607190004_topic_feed_metrics.sql

-- BEGIN 202607190005_markdown_and_inline_management.sql

-- Markdown is now the canonical editable format. The original JSON columns stay
-- populated during the compatibility period so older clients can still read data.
create or replace function public.jsonb_to_plain_markdown(input jsonb) returns text
language plpgsql immutable as $$
declare
  child jsonb;
  result text := '';
  child_text text;
begin
  if input is null then return ''; end if;
  if jsonb_typeof(input) = 'string' then return trim(both '"' from input::text); end if;
  if input ? 'text' then result := coalesce(input ->> 'text', ''); end if;
  if jsonb_typeof(input -> 'content') = 'array' then
    for child in select value from jsonb_array_elements(input -> 'content') loop
      child_text := public.jsonb_to_plain_markdown(child);
      if child_text <> '' then
        result := result || case when result <> '' then E'\n\n' else '' end || child_text;
      end if;
    end loop;
  end if;
  return result;
end;
$$;

alter table public.posts add column if not exists body_markdown text not null default '';
alter table public.comments add column if not exists body_markdown text not null default '';
alter table public.activity_submissions add column if not exists body_markdown text not null default '';
alter table public.activities add column if not exists description_markdown text not null default '';

update public.posts set body_markdown = public.jsonb_to_plain_markdown(body) where body_markdown = '';
update public.comments set body_markdown = public.jsonb_to_plain_markdown(body) where body_markdown = '';
update public.activity_submissions set body_markdown = public.jsonb_to_plain_markdown(body) where body_markdown = '';
update public.activities set description_markdown = public.jsonb_to_plain_markdown(description) where description_markdown = '';

drop index if exists public.posts_public_search_idx;
alter table public.posts drop column if exists search_document;
alter table public.posts add column search_document tsvector generated always as (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(nullif(body_markdown, ''), body #>> '{}', ''))
) stored;
create index if not exists posts_public_search_idx on public.posts using gin(search_document);

-- Keep approval decisions auditable and prevent staff clients from directly
-- changing moderation fields through a table update.
drop policy if exists "posts staff update" on public.posts;
drop policy if exists "comments staff update" on public.comments;
drop policy if exists "submissions staff update" on public.activity_submissions;

create or replace function public.moderate_content(
  target_kind text,
  target_id uuid,
  next_status public.content_status,
  note text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Administrator role required'; end if;
  if next_status not in ('approved', 'rejected', 'hidden', 'removed') then raise exception 'Invalid moderation status'; end if;

  if target_kind = 'post' then
    update public.posts set status = next_status, moderated_at = now(), moderated_by = auth.uid(), updated_at = now() where id = target_id;
  elsif target_kind = 'comment' then
    update public.comments set status = next_status, moderated_at = now(), moderated_by = auth.uid(), updated_at = now() where id = target_id;
  elsif target_kind = 'submission' then
    update public.activity_submissions set status = next_status, moderated_at = now(), moderated_by = auth.uid(), updated_at = now() where id = target_id;
  else
    raise exception 'Unsupported moderation target';
  end if;

  if not found then raise exception 'Moderation target not found'; end if;
  insert into public.moderation_events(target_type, target_id, action, reason, actor_id)
  values (target_kind, target_id, next_status, note, auth.uid());
end;
$$;

create or replace function public.save_board(
  board_id uuid,
  board_slug text,
  board_name text,
  board_description text,
  board_archived boolean default false,
  board_position integer default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
begin
  if not public.is_admin() then raise exception 'Super administrator role required'; end if;
  if board_id is null then
    insert into public.boards(slug, name, description, is_archived, position)
    values (board_slug, board_name, board_description, board_archived, board_position)
    returning id into saved_id;
  else
    update public.boards set slug = board_slug, name = board_name, description = board_description, is_archived = board_archived, position = board_position where id = board_id returning id into saved_id;
  end if;
  if saved_id is null then raise exception 'Board not found'; end if;
  return saved_id;
end;
$$;

create or replace function public.save_activity(
  activity_id uuid,
  activity_slug text,
  activity_title text,
  activity_description text,
  activity_submission_starts_at timestamptz,
  activity_submission_ends_at timestamptz,
  activity_voting_starts_at timestamptz,
  activity_voting_ends_at timestamptz,
  activity_vote_limit integer,
  activity_status public.activity_status default 'draft'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare saved_id uuid;
declare legacy_description jsonb;
begin
  if not public.is_admin() then raise exception 'Super administrator role required'; end if;
  legacy_description := jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', activity_description)))));
  if activity_id is null then
    insert into public.activities(slug, title, description, description_markdown, status, submission_starts_at, submission_ends_at, voting_starts_at, voting_ends_at, vote_limit, created_by)
    values (activity_slug, activity_title, legacy_description, activity_description, activity_status, activity_submission_starts_at, activity_submission_ends_at, activity_voting_starts_at, activity_voting_ends_at, activity_vote_limit, auth.uid())
    returning id into saved_id;
  else
    update public.activities set slug = activity_slug, title = activity_title, description = legacy_description, description_markdown = activity_description, status = activity_status, submission_starts_at = activity_submission_starts_at, submission_ends_at = activity_submission_ends_at, voting_starts_at = activity_voting_starts_at, voting_ends_at = activity_voting_ends_at, vote_limit = activity_vote_limit, updated_at = now() where id = activity_id returning id into saved_id;
  end if;
  if saved_id is null then raise exception 'Activity not found'; end if;
  return saved_id;
end;
$$;

create or replace function public.set_activity_status(
  target_activity uuid,
  next_status public.activity_status
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Super administrator role required'; end if;
  update public.activities set status = next_status, updated_at = now() where id = target_activity;
  if not found then raise exception 'Activity not found'; end if;
end;
$$;

grant execute on function public.moderate_content(text, uuid, public.content_status, text) to authenticated;
grant execute on function public.save_board(uuid, text, text, text, boolean, integer) to authenticated;
grant execute on function public.save_activity(uuid, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, integer, public.activity_status) to authenticated;
grant execute on function public.set_activity_status(uuid, public.activity_status) to authenticated;

-- END 202607190005_markdown_and_inline_management.sql

-- BEGIN 202607200001_post_revisions.sql

-- An approved post may be revised by its author, but every revision returns to
-- the moderation queue before it becomes public again.
drop policy if exists "posts owner update pending" on public.posts;
drop policy if exists "posts owner submit revision" on public.posts;
create policy "posts owner submit revision" on public.posts
for update using (author_id = auth.uid() and status in ('pending', 'rejected', 'approved'))
with check (author_id = auth.uid() and status = 'pending');

-- END 202607200001_post_revisions.sql

-- BEGIN 202607200002_seed_default_boards.sql

insert into public.boards (slug, name, description, position)
values
  ('general', '综合交流', '日常讨论与社区公告。', 10),
  ('share', '作品分享', '分享创作、经验和灵感。', 20),
  ('help', '问答求助', '提出问题并互相帮助。', 30),
  ('feedback', '建议反馈', '提出对社区的建议与反馈。', 40)
on conflict (slug) do nothing;

-- END 202607200002_seed_default_boards.sql

-- BEGIN 202607200003_seed_welcome_content.sql

create or replace function public.seed_community_examples(seed_author uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.posts) then
    return;
  end if;

  insert into public.boards (slug, name, description, position)
  values
    ('general', '综合交流', '日常讨论与社区公告。', 10),
    ('share', '作品分享', '分享创作、经验和灵感。', 20),
    ('help', '问答求助', '提出问题并互相帮助。', 30),
    ('feedback', '建议反馈', '提出对社区的建议与反馈。', 40)
  on conflict (slug) do nothing;

  insert into public.posts (board_id, author_id, title, body, body_markdown, status, created_at, last_activity_at)
  select
    board.id,
    seed_author,
    example.title,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', example.body_markdown))
      ))
    ),
    example.body_markdown,
    'approved'::public.content_status,
    now() - example.age,
    now() - example.age
  from (
    values
      ('general', '欢迎来到社区', '这里是一个用于交流、提问和分享的社区。选择一个板块，开始你的第一个主题吧。', interval '3 days'),
      ('share', '展示你正在制作的内容', '无论是代码、设计、文字还是其他创作，都欢迎在作品分享板块留下进度和想法。', interval '2 days'),
      ('help', '如何写出一个清晰的问题', '说明你尝试过什么、期待什么结果，以及遇到的实际情况，其他成员会更容易帮助你。', interval '1 day')
  ) as example(board_slug, title, body_markdown, age)
  join public.boards board on board.slug = example.board_slug
  where not exists (select 1 from public.posts);
end;
$$;

do $$
declare
  existing_author uuid;
begin
  select id into existing_author from public.profiles order by created_at limit 1;
  if existing_author is not null then
    perform public.seed_community_examples(existing_author);
  end if;
end;
$$;

create or replace function public.seed_first_profile_content() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_community_examples(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_seed_first_content on public.profiles;
create trigger profiles_seed_first_content
after insert on public.profiles
for each row execute procedure public.seed_first_profile_content();

-- END 202607200003_seed_welcome_content.sql
-- END SQL_EDITOR_CATCH_UP.sql

-- BEGIN 202607220001_fix_voting_race_bucket_rls.sql
-- Issue #2: Fix voting race condition with advisory lock
-- Replace the cast_activity_vote function to use pg_advisory_xact_lock
-- to serialize voting per user per activity

create or replace function public.cast_activity_vote(target_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  target_activity public.activities;
  count_used integer;
  lock_key bigint;
begin
  -- Advisory lock: serialize per (voter, activity) pair to prevent TOCTOU race
  lock_key := (
    ('x' || substr(auth.uid()::text || target_submission::text, 1, 16))::bit(64)::bigint
  );
  perform pg_advisory_xact_lock(lock_key);

  select a.* into target_activity
  from public.activities a
  join public.activity_submissions s on s.activity_id = a.id
  where s.id = target_submission and s.status = 'approved'
  for update;

  if target_activity.id is null
    or target_activity.status <> 'published'
    or now() < target_activity.voting_starts_at
    or now() >= target_activity.voting_ends_at
  then
    raise exception 'Voting is not open';
  end if;

  if not public.is_active_member() then
    raise exception 'Active verified account required';
  end if;

  if exists(
    select 1 from public.activity_votes
    where activity_id = target_activity.id
      and submission_id = target_submission
      and voter_id = auth.uid()
  ) then
    return;
  end if;

  select count(*) into count_used
  from public.activity_votes
  where activity_id = target_activity.id
    and voter_id = auth.uid();

  if count_used >= target_activity.vote_limit then
    raise exception 'Vote allowance exhausted';
  end if;

  insert into public.activity_votes(activity_id, submission_id, voter_id)
  values(target_activity.id, target_submission, auth.uid());
end;
$$;

-- Issue #4: Fix bucket RLS - community-images bucket shouldn't be public
-- Update bucket to not be public (remove `public = true`)
update storage.buckets
set public = false
where id = 'community-images';

-- Replace the existing read policy with one that only allows reads for
-- authenticated users who can view the associated content
drop policy if exists "public image read" on storage.objects;

create policy "authenticated can read community images"
  on storage.objects
  for select
  using (
    bucket_id = 'community-images'
    and (
      -- Post images: user can see them if the post is approved
      exists(
        select 1 from public.post_images pi
        join public.posts p on p.id = pi.post_id
        where pi.storage_path = name
          and (p.status = 'approved' or p.author_id = auth.uid() or public.is_staff())
      )
      or
      -- Submission images: user can see them if submission is approved
      exists(
        select 1 from public.submission_images si
        join public.activity_submissions s on s.id = si.submission_id
        where si.storage_path = name
          and (s.status = 'approved' or s.author_id = auth.uid() or public.is_staff())
      )
      or
      -- Cover images for activities (stored directly under activities/)
      (public.is_staff())
    )
  );
-- END 202607220001_fix_voting_race_bucket_rls.sql

-- BEGIN 202607220002_add_get_email_by_username.sql
-- Function: get email by display_name (for username login support)
-- SECURITY DEFINER so browser client can look up auth.users via profiles
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.display_name = p_username
  limit 1;
$$;
-- END 202607220002_add_get_email_by_username.sql

-- BEGIN 202607220003_cascade_user_deletion.sql
-- Deleting an auth user cascades to public.profiles. Make each dependent
-- content relationship explicit so an administrator can delete active users.
alter table public.posts
  drop constraint if exists posts_author_id_fkey,
  add constraint posts_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  drop constraint if exists posts_moderated_by_fkey,
  add constraint posts_moderated_by_fkey
    foreign key (moderated_by) references public.profiles(id) on delete set null;

alter table public.comments
  drop constraint if exists comments_author_id_fkey,
  add constraint comments_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  drop constraint if exists comments_moderated_by_fkey,
  add constraint comments_moderated_by_fkey
    foreign key (moderated_by) references public.profiles(id) on delete set null;

alter table public.activities
  drop constraint if exists activities_created_by_fkey,
  add constraint activities_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_author_id_fkey,
  add constraint activity_submissions_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  drop constraint if exists activity_submissions_moderated_by_fkey,
  add constraint activity_submissions_moderated_by_fkey
    foreign key (moderated_by) references public.profiles(id) on delete set null;

alter table public.moderation_events
  drop constraint if exists moderation_events_actor_id_fkey,
  add constraint moderation_events_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade;

-- Cascading table deletes do not remove objects from Supabase Storage by
-- themselves. Remove the associated community image within the same transaction.
create or replace function public.delete_community_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  object_path text;
begin
  object_path := coalesce(to_jsonb(old) ->> 'storage_path', to_jsonb(old) ->> 'cover_path');

  if object_path is not null then
    delete from storage.objects
    where bucket_id = 'community-images' and name = object_path;
  end if;

  return old;
end;
$$;

drop trigger if exists post_images_delete_storage_object on public.post_images;
create trigger post_images_delete_storage_object
after delete on public.post_images
for each row execute procedure public.delete_community_storage_object();

drop trigger if exists submission_images_delete_storage_object on public.submission_images;
create trigger submission_images_delete_storage_object
after delete on public.submission_images
for each row execute procedure public.delete_community_storage_object();

drop trigger if exists activities_delete_storage_object on public.activities;
create trigger activities_delete_storage_object
after delete on public.activities
for each row execute procedure public.delete_community_storage_object();
-- END 202607220003_cascade_user_deletion.sql

-- BEGIN 202607220004_fix_image_upload_storage_rls.sql
-- Keep the bucket configuration and write policies aligned with the browser upload flow.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own image paths" on storage.objects;
drop policy if exists "authenticated users upload own community images" on storage.objects;
create policy "authenticated users upload own community images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_member()
  );

drop policy if exists "users delete own images" on storage.objects;
drop policy if exists "authenticated users delete own community images" on storage.objects;
create policy "authenticated users delete own community images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- END 202607220004_fix_image_upload_storage_rls.sql

-- BEGIN 202607220005_add_public_avatar_storage.sql
-- Avatars are public profile metadata. Keep uploaded post and submission
-- images in the private community-images bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-avatars',
  'community-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public avatar read" on storage.objects;
create policy "public avatar read"
  on storage.objects
  for select
  using (bucket_id = 'community-avatars');

drop policy if exists "authenticated users upload own avatars" on storage.objects;
create policy "authenticated users upload own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_member()
  );

drop policy if exists "authenticated users delete own avatars" on storage.objects;
create policy "authenticated users delete own avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- END 202607220005_add_public_avatar_storage.sql
