
-- An approved post may be revised by its author, but every revision returns to
-- the moderation queue before it becomes public again.
drop policy if exists "posts owner update pending" on public.posts;
create policy "posts owner submit revision" on public.posts
for update using (author_id = auth.uid() and status in ('pending', 'rejected', 'approved'))
with check (author_id = auth.uid() and status = 'pending');
