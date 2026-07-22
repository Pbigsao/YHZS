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
