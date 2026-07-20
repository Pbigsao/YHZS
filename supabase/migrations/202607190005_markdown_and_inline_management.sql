
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

alter table public.posts drop column search_document;
alter table public.posts add column search_document tsvector generated always as (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(nullif(body_markdown, ''), body #>> '{}', ''))
) stored;
create index posts_public_search_idx on public.posts using gin(search_document);

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
