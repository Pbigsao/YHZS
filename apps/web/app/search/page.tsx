"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconEye, IconMessageCircle } from "../../components/icons";
import { PostLikeButton } from "../../components/post-like-button";
import { createSupabaseBrowserClient } from "../../lib/supabase";

type SearchResult = {
  id: string;
  title: string;
  created_at: string;
  board_name: string;
  board_slug: string;
  author_name: string;
  avatar_url: string | null;
  reply_count: number;
  like_count: number;
  view_count: number;
};

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!query) {
      setResults([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    void createSupabaseBrowserClient().rpc("search_public_posts", {
      search_query: query,
      sort_by: "latest",
      target_board: null,
    }).then(({ data, error: searchError }) => {
      if (cancelled) return;
      setLoading(false);
      if (searchError) {
        setError(searchError.message);
        return;
      }
      setResults((data ?? []) as SearchResult[]);
    });

    return () => { cancelled = true; };
  }, [query]);

  return (
    <section className="search-page">
      <div className="page-header">
        <Link className="back-link" href="/">返回社区</Link>
        <h1 className="page-header__title">搜索主题</h1>
        <p className="page-header__description">{query ? `“${query}” 的搜索结果` : "输入关键词后即可搜索已审核主题。"}</p>
      </div>

      {error && <p className="alert alert-error">搜索失败：{error}</p>}
      {loading && <p className="empty-state">正在搜索...</p>}
      {!loading && query && !error && results.length === 0 && <p className="empty-state">没有找到匹配的主题。</p>}
      {!loading && !query && <p className="empty-state">请在顶部搜索框中输入关键词。</p>}

      <div className="post-feed">
        {results.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="post-card__header">
              {post.avatar_url ? <img className="post-card__avatar" src={post.avatar_url} alt="" /> : <span className="post-card__avatar">{post.author_name.slice(0, 1)}</span>}
              <div className="post-card__meta">
                <span className="post-card__author">{post.author_name}</span>
                <span className="post-card__time">{new Date(post.created_at).toLocaleDateString("zh-CN")}</span>
              </div>
              <Link className="post-card__tag" href={`/boards/${post.board_slug}`}>{post.board_name}</Link>
            </div>
            <Link className="post-card__title" href={`/posts/${post.id}`}>{post.title}</Link>
            <div className="post-card__actions">
              <span className="post-card__action"><IconEye size={18} /> {post.view_count}</span>
              <PostLikeButton postId={post.id} initialLikeCount={post.like_count} />
              <span className="post-card__action"><IconMessageCircle size={18} /> {post.reply_count}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<section className="search-page"><p className="empty-state">正在加载搜索...</p></section>}><SearchResults /></Suspense>;
}
