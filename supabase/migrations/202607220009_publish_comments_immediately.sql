-- Comments are published immediately. Posts and activity submissions retain
-- their independent moderation workflows.
drop policy if exists "comments member create" on public.comments;
create policy "comments member create"
  on public.comments
  for insert
  with check (
    author_id = auth.uid()
    and public.is_active_member()
    and status = 'approved'
    and exists(select 1 from public.posts where id = post_id and status = 'approved')
  );
