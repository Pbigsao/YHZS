-- Deleting an auth user cascades to public.profiles. Make each dependent
-- content relationship explicit so an administrator can delete active users.
alter table public.posts
  drop constraint if exists posts_author_id_fkey,
  add constraint posts_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  drop constraint if exists posts_moderated_by_fkey,
  add constraint posts_moderated_by_fkey
    foreign key (moderated_by) references public.profiles(id) on delete set null;

alter table public.comments
  drop constraint if exists comments_author_id_fkey,
  add constraint comments_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  drop constraint if exists comments_moderated_by_fkey,
  add constraint comments_moderated_by_fkey
    foreign key (moderated_by) references public.profiles(id) on delete set null;

alter table public.activities
  drop constraint if exists activities_created_by_fkey,
  add constraint activities_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_author_id_fkey,
  add constraint activity_submissions_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  drop constraint if exists activity_submissions_moderated_by_fkey,
  add constraint activity_submissions_moderated_by_fkey
    foreign key (moderated_by) references public.profiles(id) on delete set null;

alter table public.moderation_events
  drop constraint if exists moderation_events_actor_id_fkey,
  add constraint moderation_events_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete cascade;

-- Cascading table deletes do not remove objects from Supabase Storage by
-- themselves. Remove the associated community image within the same transaction.
create or replace function public.delete_community_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  object_path text;
begin
  object_path := coalesce(to_jsonb(old) ->> 'storage_path', to_jsonb(old) ->> 'cover_path');

  if object_path is not null then
    delete from storage.objects
    where bucket_id = 'community-images' and name = object_path;
  end if;

  return old;
end;
$$;

drop trigger if exists post_images_delete_storage_object on public.post_images;
create trigger post_images_delete_storage_object
after delete on public.post_images
for each row execute procedure public.delete_community_storage_object();

drop trigger if exists submission_images_delete_storage_object on public.submission_images;
create trigger submission_images_delete_storage_object
after delete on public.submission_images
for each row execute procedure public.delete_community_storage_object();

drop trigger if exists activities_delete_storage_object on public.activities;
create trigger activities_delete_storage_object
after delete on public.activities
for each row execute procedure public.delete_community_storage_object();
