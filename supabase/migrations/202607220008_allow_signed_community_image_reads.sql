-- Keep the content bucket private while allowing signed URLs for images that
-- belong to public approved content. Authors and staff retain preview access.
update storage.buckets set public = false where id = 'community-images';
drop policy if exists "public image read" on storage.objects;
drop policy if exists "authenticated can read community images" on storage.objects;
drop policy if exists "community images readable with content" on storage.objects;
create policy "community images readable with content"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'community-images'
    and (
      exists (
        select 1
        from public.post_images pi
        join public.posts p on p.id = pi.post_id
        where pi.storage_path = name
          and (p.status = 'approved' or p.author_id = auth.uid() or public.is_staff())
      )
      or exists (
        select 1
        from public.submission_images si
        join public.activity_submissions s on s.id = si.submission_id
        where si.storage_path = name
          and (s.status = 'approved' or s.author_id = auth.uid() or public.is_staff())
      )
      or public.is_staff()
    )
  );
