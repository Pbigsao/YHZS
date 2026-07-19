create extension if not exists pgcrypto;

create type public.app_role as enum ('member', 'reviewer', 'admin');
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
as $$ select public.current_role() in ('reviewer', 'admin') $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() = 'admin' $$;
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
