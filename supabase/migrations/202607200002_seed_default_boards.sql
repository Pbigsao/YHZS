insert into public.boards (slug, name, description, position)
values
  ('general', '综合交流', '日常讨论与社区公告。', 10),
  ('share', '作品分享', '分享创作、经验和灵感。', 20),
  ('help', '问答求助', '提出问题并互相帮助。', 30),
  ('feedback', '建议反馈', '提出对社区的建议与反馈。', 40)
on conflict (slug) do nothing;
