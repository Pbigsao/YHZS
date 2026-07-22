-- Run this in the Supabase SQL Editor for an existing database.
create or replace function public.enforce_image_limit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_table_name = 'post_images' then
    if (select count(*) from public.post_images where post_id = new.post_id) >= 5 then
      raise exception 'A post may contain at most 5 images';
    end if;
  elsif tg_table_name = 'submission_images' then
    if (select count(*) from public.submission_images where submission_id = new.submission_id) >= 10 then
      raise exception 'A submission may contain at most 10 images';
    end if;
  end if;
  return new;
end;
$$;
