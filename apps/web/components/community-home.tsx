"use client";

import { useEffect, useMemo, useState } from "react";
import { PostCard } from "./post-card";
import { IconMessageCircle } from "./icons";
import { createCommunityImageUrls } from "../lib/community-images";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Board = { id: string; slug: string; name: string; description: string | null };
type Post = {
  id: string;
  title: string;
  created_at: string;
  profiles: { id: string; display_name: string; avatar_url: string | null } | null;
  post_images: Array<{ storage_path: string; position: number }>;
  imageUrls?: string[];
};
type Activity = { id: string; title: string; slug: string; submission_ends_at: string; voting_ends_at: string };

export function CommunityHome() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function load() {
      const [boardsResult, postsResult, activitiesResult] = await Promise.all([
        supabase.from("boards").select("id,slug,name,description").order("position"),
        supabase.from("posts").select("id,title,created_at,profiles!posts_author_id_fkey(id,display_name,avatar_url),post_images(storage_path,position)").eq("status", "approved").order("created_at", { ascending: false }).limit(12),
        supabase.from("activities").select("id,title,slug,submission_ends_at,voting_ends_at").eq("status", "published").order("voting_ends_at").limit(6),
      ]);
      if (cancelled) return;
      if (boardsResult.error || postsResult.error || activitiesResult.error) setError("加载社区内容失败，请检查 Supabase 配置和权限策略。");
      setBoards(boardsResult.data ?? []);
      const postItems = (postsResult.data as Post[] | null) ?? [];
      const postsWithImages = await Promise.all(postItems.map(async (post) => ({
        ...post,
        imageUrls: await createCommunityImageUrls(supabase, (post.post_images ?? []).sort((a, b) => a.position - b.position).map((image) => image.storage_path)),
      })));
      if (cancelled) return;
      setPosts(postsWithImages);
      setActivities((activitiesResult.data as Activity[] | null) ?? []);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const visiblePosts = useMemo(() => posts.filter((post) => post.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [posts, query]);

  return <main>
    <section className="hero-section"><p className="hero-section__eyebrow">COMMUNITY</p><h1 className="hero-section__title">分享作品，讨论你热爱的事。</h1><p className="hero-section__desc">所有公开内容均经过审核。登录后可以发帖、评论、提交活动作品与投票。</p></section>
    {error && <div className="alert alert-error">{error}</div>}
    <section id="boards" className="content-section"><div className="content-section__heading"><h2>讨论板块</h2></div><div className="board-grid">{boards.map((board) => <a className="board-card" href={`/boards/${board.slug}`} key={board.id}><div className="board-card__icon"><IconMessageCircle size={24} /></div><h3 className="board-card__name">{board.name}</h3><p className="board-card__desc">{board.description || "等待第一篇讨论。"}</p></a>)}</div></section>
    <section id="activities" className="content-section"><div className="content-section__heading"><h2>正在进行的活动</h2></div><div className="activity-grid">{activities.map((activity) => <a className="activity-card" href={`/activities/${activity.slug}`} key={activity.id}><span className="activity-card__badge">作品征集 / 投票</span><h3 className="activity-card__title">{activity.title}</h3><p className="activity-card__meta">投稿截止 {new Date(activity.submission_ends_at).toLocaleDateString("zh-CN")}</p><span className="activity-card__link">查看活动</span></a>)}</div></section>
    <section id="posts" className="content-section"><div className="content-section__heading"><h2>最新帖子</h2></div><div className="post-feed">{visiblePosts.map((post) => <PostCard key={post.id} post={{ id: post.id, title: post.title, created_at: post.created_at, author: { id: post.profiles?.id, display_name: post.profiles?.display_name || "匿名成员", avatar_url: post.profiles?.avatar_url }, images: post.imageUrls }} />)}{visiblePosts.length === 0 && <p className="text-muted">没有匹配的帖子。</p>}</div></section>
  </main>;
}
