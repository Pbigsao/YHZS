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
