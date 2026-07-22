-- Ensure the navigation target exists and reserve announcement publishing for staff.
insert into public.boards (slug, name, description, position)
values ('announcements', '社团公告', '社团官方公告与重要通知。', 0)
on conflict (slug) do nothing;

drop policy if exists "posts member create" on public.posts;
create policy "posts member create"
  on public.posts
  for insert
  with check (
    author_id = auth.uid()
    and public.is_active_member()
    and status = 'pending'
    and exists (
      select 1
      from public.boards
      where id = board_id
        and (slug <> 'announcements' or public.is_staff())
    )
  );
