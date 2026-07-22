-- Avatars are intentionally public because they are displayed in profile cards
-- and navigation without a Supabase authorization header. Community content
-- images remain in the private community-images bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-avatars',
  'community-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public avatar read" on storage.objects;
create policy "public avatar read"
  on storage.objects
  for select
  using (bucket_id = 'community-avatars');

drop policy if exists "authenticated users upload own avatars" on storage.objects;
create policy "authenticated users upload own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_member()
  );

drop policy if exists "authenticated users delete own avatars" on storage.objects;
create policy "authenticated users delete own avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
