"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { TopNav } from "../../../components/top-nav";
import { SidebarNav } from "../../../components/sidebar-nav";
import { SidebarInfo } from "../../../components/sidebar-info";
import { PostCard } from "../../../components/post-card";

type Board = { id: string; name: string; description: string | null };
type Post = { id: string; title: string; created_at: string; profiles: { display_name: string } | null };

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.from("boards").select("id,name,description").eq("slug", slug).single().then(({ data, error }) => {
      if (error || !data) return setMessage("板块不存在或不可访问。");
      setBoard(data);
      supabase.from("posts").select("id,title,created_at,profiles!posts_author_id_fkey(display_name)").eq("board_id", data.id).eq("status", "approved").order("created_at", { ascending: false }).then(({ data: items }) => setPosts((items as Post[] | null) ?? []));
    });
  }, [slug]);

  return (
    <>
      <TopNav />
      <div className="app-layout">
        <SidebarNav />
        <main className="content-main">
          <div className="page-header">
            <a href="/" className="back-link">← 返回社区</a>
          </div>
          {board ? (
            <>
              <div className="page-header">
                <h1 className="page-header__title">{board.name}</h1>
                {board.description && <p className="page-header__description">{board.description}</p>}
                <a href="/posts/new" className="btn btn-primary" style={{marginTop:16}}>发布主题</a>
              </div>
              <div className="post-feed" style={{marginTop:24}}>
                {posts.length > 0 ? posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={{
                      id: post.id,
                      title: post.title,
                      created_at: post.created_at,
                      author: { display_name: post.profiles?.display_name || "成员" },
                    }}
                  />
                )) : (
                  <p className="text-muted">暂无已审核主题。</p>
                )}
              </div>
            </>
          ) : (
            <p>{message || "加载中..."}</p>
          )}
        </main>
        <SidebarInfo />
      </div>
    </>
  );
}
