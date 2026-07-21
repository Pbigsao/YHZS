"use client";
import { useEffect, useMemo, useState } from "react";
import { TopNav } from "./top-nav";
import { SidebarNav } from "./sidebar-nav";
import { SidebarInfo } from "./sidebar-info";
import { PostCard } from "./post-card";
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

  // 计算统计数据
  const stats = {
    members: 0, // Supabase auth 无法直接计数，暂为0
    posts: posts.length,
    todayPosts: posts.filter(p => new Date(p.created_at).toDateString() === new Date().toDateString()).length,
    online: 0,
  };

  return (
    <>
      <TopNav />
      <div className="app-layout">
        {/* 左侧导航 */}
        <SidebarNav />

        {/* 中间内容 */}
        <main className="content-main">
          {/* Hero 区域 */}
          <section className="hero-section">
            <p className="hero-section__eyebrow">COMMUNITY</p>
            <h1 className="hero-section__title">分享作品，讨论你热爱的事。</h1>
            <p className="hero-section__desc">
              所有公开内容均经过审核。登录后可以发帖、评论、提交活动作品与投票。
            </p>
          </section>

          {error && <div className="alert alert-error">{error}</div>}

          {/* 板块区域 */}
          <section id="boards" className="content-section">
            <div className="content-section__heading">
              <h2>讨论板块</h2>
            </div>
            <div className="board-grid">
              {boards.length > 0 ? boards.map((board) => (
                <a className="board-card" href={`/boards/${board.slug}`} key={board.id}>
                  <div className="board-card__icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="4"/>
                      <path d="M8 8h8M8 12h8M8 16h5"/>
                    </svg>
                  </div>
                  <h3 className="board-card__name">{board.name}</h3>
                  <p className="board-card__desc">{board.description || "等待第一篇讨论"}</p>
                </a>
              )) : (
                <p className="text-muted">尚无板块，请由管理员在后台创建。</p>
              )}
            </div>
          </section>

          {/* 活动区域 */}
          <section id="activities" className="content-section">
            <div className="content-section__heading">
              <h2>正在进行的活动</h2>
            </div>
            <div className="activity-grid">
              {activities.length > 0 ? activities.map((activity) => (
                <a className="activity-card" href={`/activities/${activity.slug}`} key={activity.id}>
                  <span className="activity-card__badge">作品征集 / 投票</span>
                  <h3 className="activity-card__title">{activity.title}</h3>
                  <p className="activity-card__meta">
                    投稿截止 {new Date(activity.submission_ends_at).toLocaleDateString("zh-CN")}
                  </p>
                  <span className="activity-card__link">查看活动 →</span>
                </a>
              )) : (
                <p className="text-muted">暂时没有公开活动。</p>
              )}
            </div>
          </section>

          {/* 帖子区域 */}
          <section id="posts" className="content-section">
            <div className="content-section__heading">
              <h2>最新帖子</h2>
            </div>
            <div className="post-feed">
              {visiblePosts.length > 0 ? visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    title: post.title,
                    created_at: post.created_at,
                    author: { display_name: post.profiles?.display_name || "匿名成员" },
                  }}
                />
              )) : (
                <p className="text-muted">没有匹配的帖子。</p>
              )}
            </div>
          </section>
        </main>

        {/* 右侧信息栏 */}
        <SidebarInfo stats={stats} />
      </div>
    </>
  );
}
