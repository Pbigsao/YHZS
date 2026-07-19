"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthButton } from "./auth-button";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Board = { id: string; slug: string; name: string; description: string | null };
type Post = { id: string; title: string; created_at: string; board_id: string; profiles: { display_name: string } | null };
type Activity = { id: string; title: string; slug: string; submission_ends_at: string; voting_ends_at: string };

export function CommunityHome() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    Promise.all([
      supabase.from("boards").select("id,slug,name,description").order("position"),
      supabase.from("posts").select("id,title,created_at,board_id,profiles!posts_author_id_fkey(display_name)").eq("status", "approved").order("created_at", { ascending: false }).limit(12),
      supabase.from("activities").select("id,title,slug,submission_ends_at,voting_ends_at").eq("status", "published").order("voting_ends_at").limit(6)
    ]).then(([boardsResult, postsResult, activitiesResult]) => {
      if (boardsResult.error || postsResult.error || activitiesResult.error) setError("加载社区内容失败，请检查 Supabase 配置和 RLS 策略。");
      setBoards(boardsResult.data ?? []);
      setPosts((postsResult.data as Post[] | null) ?? []);
      setActivities((activitiesResult.data as Activity[] | null) ?? []);
    });
  }, []);

  const visiblePosts = useMemo(() => posts.filter((post) => post.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [posts, query]);
  return <main>
    <header className="topbar"><a className="brand" href="/">YH Community</a><nav><a href="#boards">板块</a><a href="#activities">活动</a><a href="#posts">最新帖子</a></nav><AuthButton /></header>
    <section className="intro"><div><p className="eyebrow">Community</p><h1>分享作品，讨论你热爱的事。</h1><p>所有公开内容均经过审核。登录后可以发帖、评论、提交活动作品与投票。</p></div><a className="primaryAction" href="/posts/new">发布主题</a></section>
    {error && <p className="error">{error}</p>}
    <section id="boards" className="section"><div className="sectionHeading"><h2>讨论板块</h2></div><div className="boardGrid">{boards.map((board) => <a className="board" href={`/boards/${board.slug}`} key={board.id}><h3>{board.name}</h3><p>{board.description || "等待第一篇讨论"}</p></a>)}{boards.length === 0 && <p className="empty">尚无板块，请由管理员在后台创建。</p>}</div></section>
    <section id="activities" className="section"><div className="sectionHeading"><h2>正在进行的活动</h2></div><div className="activityGrid">{activities.map((activity) => <a className="activity" href={`/activities/${activity.slug}`} key={activity.id}><p className="eyebrow">作品征集 / 投票</p><h3>{activity.title}</h3><p>投稿截止 {new Date(activity.submission_ends_at).toLocaleDateString("zh-CN")}</p><span>查看活动</span></a>)}{activities.length === 0 && <p className="empty">暂时没有公开活动。</p>}</div></section>
    <section id="posts" className="section"><div className="sectionHeading"><h2>最新主题</h2><input aria-label="搜索主题" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索已审核主题" /></div><div className="postList">{visiblePosts.map((post) => <a href={`/posts/${post.id}`} className="postRow" key={post.id}><div><h3>{post.title}</h3><p>{post.profiles?.display_name || "匿名成员"} · {new Date(post.created_at).toLocaleDateString("zh-CN")}</p></div><span>查看</span></a>)}{visiblePosts.length === 0 && <p className="empty">没有匹配的主题。</p>}</div></section>
  </main>;
}
