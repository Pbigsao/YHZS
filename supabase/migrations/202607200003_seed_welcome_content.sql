
create or replace function public.seed_community_examples(seed_author uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.posts) then
    return;
  end if;

  insert into public.boards (slug, name, description, position)
  values
    ('general', '综合交流', '日常讨论与社区公告。', 10),
    ('share', '作品分享', '分享创作、经验和灵感。', 20),
    ('help', '问答求助', '提出问题并互相帮助。', 30),
    ('feedback', '建议反馈', '提出对社区的建议与反馈。', 40)
  on conflict (slug) do nothing;

  insert into public.posts (board_id, author_id, title, body, body_markdown, status, created_at, last_activity_at)
  select
    board.id,
    seed_author,
    example.title,
    jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', example.body_markdown))
      ))
    ),
    example.body_markdown,
    'approved'::public.content_status,
    now() - example.age,
    now() - example.age
  from (
    values
      ('general', '欢迎来到社区', '这里是一个用于交流、提问和分享的社区。选择一个板块，开始你的第一个主题吧。', interval '3 days'),
      ('share', '展示你正在制作的内容', '无论是代码、设计、文字还是其他创作，都欢迎在作品分享板块留下进度和想法。', interval '2 days'),
      ('help', '如何写出一个清晰的问题', '说明你尝试过什么、期待什么结果，以及遇到的实际情况，其他成员会更容易帮助你。', interval '1 day')
  ) as example(board_slug, title, body_markdown, age)
  join public.boards board on board.slug = example.board_slug
  where not exists (select 1 from public.posts);
end;
$$;

do $$
declare
  existing_author uuid;
begin
  select id into existing_author from public.profiles order by created_at limit 1;
  if existing_author is not null then
    perform public.seed_community_examples(existing_author);
  end if;
end;
$$;

create or replace function public.seed_first_profile_content() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_community_examples(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_seed_first_content on public.profiles;
create trigger profiles_seed_first_content
after insert on public.profiles
for each row execute procedure public.seed_first_profile_content();
