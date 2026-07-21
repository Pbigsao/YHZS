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