
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
