"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

type FeedPost = {
  id: string;
  title: string;
  created_at: string;
  last_activity_at: string;
  board_name: string;
  board_slug: string;
  author_name: string;
  avatar_url: string | null;
  reply_count: number;
  like_count: number;
  view_count: number;
  is_pinned: boolean;
};

const filters = [
  { value: "latest", label: "最新" },
  { value: "hot", label: "热门" },
  { value: "replies", label: "最新回复" }
] as const;

export function CommunityHome() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<(typeof filters)[number]["value"]>("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void client.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void createSupabaseBrowserClient().rpc("search_public_posts", { search_query: query, sort_by: sort, target_board: null }).then(({ data, error: requestError }) => {
        if (!active) return;
        setPosts((data as FeedPost[] | null) ?? []);
        setError(requestError?.message ?? "");
        setLoading(false);
      });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, sort]);

  return <section className="feedPage">
    <div className="feedToolbar">
      <div className="filterTabs" role="tablist" aria-label="主题排序">{filters.map((filter) => <button key={filter.value} type="button" className={sort === filter.value ? "active" : ""} onClick={() => setSort(filter.value)}>{filter.label}</button>)}</div>
      <label className="searchField"><span className="srOnly">搜索主题</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索主题" /></label>
    </div>
    {error && <p className="notice errorNotice">{error}</p>}
    <div className="topicList" aria-live="polite">
      {loading && <p className="emptyState">正在加载主题...</p>}
      {!loading && posts.map((post) => <Link className="topicRow" href={`/posts/${post.id}`} key={post.id}>
        <div className="avatar" aria-hidden="true">{post.avatar_url ? <img src={post.avatar_url} alt="" /> : post.author_name.slice(0, 1)}</div>
        <div className="topicCopy"><h1>{post.is_pinned && <span className="pinned">置顶</span>}{post.title}</h1><p>{post.author_name}<span>{post.board_name}</span><time dateTime={post.last_activity_at}>{new Date(post.last_activity_at).toLocaleDateString("zh-CN")}</time></p></div>
        <div className="topicStats" aria-label={`回复 ${post.reply_count}，喜欢 ${post.like_count}，浏览 ${post.view_count}`}><span>回复 {post.reply_count}</span><span>喜欢 {post.like_count}</span><span>浏览 {post.view_count}</span></div>
      </Link>)}
      {!loading && posts.length === 0 && <p className="emptyState">没有符合条件的主题。</p>}
    </div>
    {isSignedIn && <Link className="floatingPost" href="/posts/new" aria-label="发布主题" title="发布主题">+</Link>}
  </section>;
}
