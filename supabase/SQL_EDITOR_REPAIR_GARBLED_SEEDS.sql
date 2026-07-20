-- Run this once in Supabase Dashboard > SQL Editor only if the previous
-- SQL_EDITOR_FULL_SETUP.sql was executed while it contained garbled text.

update public.boards
set
  name = case slug
    when 'general' then '综合交流'
    when 'share' then '作品分享'
    when 'help' then '问答求助'
    when 'feedback' then '建议反馈'
  end,
  description = case slug
    when 'general' then '日常讨论与社区公告。'
    when 'share' then '分享创作、经验和灵感。'
    when 'help' then '提出问题并互相帮助。'
    when 'feedback' then '提出对社区的建议与反馈。'
  end
where slug in ('general', 'share', 'help', 'feedback');

with corrected(board_slug, old_title, title, body_markdown) as (
  values
    (
      'general',
      convert_from(convert_to('欢迎来到社区', 'UTF8'), 'GBK'),
      '欢迎来到社区',
      '这里是一个用于交流、提问和分享的社区。选择一个板块，开始你的第一个主题吧。'
    ),
    (
      'share',
      convert_from(convert_to('展示你正在制作的内容', 'UTF8'), 'GBK'),
      '展示你正在制作的内容',
      '无论是代码、设计、文字还是其他创作，都欢迎在作品分享板块留下进度和想法。'
    ),
    (
      'help',
      convert_from(convert_to('如何写出一个清晰的问题', 'UTF8'), 'GBK'),
      '如何写出一个清晰的问题',
      '说明你尝试过什么、期待什么结果，以及遇到的实际情况，其他成员会更容易帮助你。'
    )
)
update public.posts post
set
  title = corrected.title,
  body_markdown = corrected.body_markdown,
  body = jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', corrected.body_markdown))
    ))
  ),
  updated_at = now()
from corrected
join public.boards board on board.slug = corrected.board_slug
where post.board_id = board.id
  and post.title = corrected.old_title;
