"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PostCard } from "../../../components/post-card";
import { createCommunityImageUrls } from "../../../lib/community-images";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Board = { id: string; name: string; description: string | null };
type Post = { id: string; title: string; created_at: string; profiles: { id: string; display_name: string; avatar_url: string | null } | null; post_images: Array<{ storage_path: string; position: number }>; imageUrls?: string[] };

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const { data: boardData, error } = await supabase.from("boards").select("id,name,description").eq("slug", slug).single();
      if (cancelled) return;
      if (error || !boardData) return setMessage("板块不存在或无法访问。");
      setBoard(boardData);
      const { data } = await supabase.from("posts").select("id,title,created_at,profiles!posts_author_id_fkey(id,display_name,avatar_url),post_images(storage_path,position)").eq("board_id", boardData.id).eq("status", "approved").order("created_at", { ascending: false });
      const postItems = (data as Post[] | null) ?? [];
      const postsWithImages = await Promise.all(postItems.map(async (post) => ({ ...post, imageUrls: await createCommunityImageUrls(supabase, (post.post_images ?? []).sort((a, b) => a.position - b.position).map((image) => image.storage_path)) })));
      if (!cancelled) setPosts(postsWithImages);
    }
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  if (!board) return <main className="content-main"><p className="text-muted">{message || "加载中..."}</p></main>;
  return <main className="content-main"><div className="page-header"><a href="/" className="back-link">返回社区</a><h1 className="page-header__title">{board.name}</h1>{board.description && <p className="page-header__description">{board.description}</p>}<a href="/posts/new" className="btn btn-primary" style={{ marginTop: 16 }}>发布主题</a></div><div className="post-feed">{posts.map((post) => <PostCard key={post.id} post={{ id: post.id, title: post.title, created_at: post.created_at, author: { id: post.profiles?.id, display_name: post.profiles?.display_name || "成员", avatar_url: post.profiles?.avatar_url }, images: post.imageUrls }} />)}{posts.length === 0 && <p className="text-muted">暂无已审核主题。</p>}</div></main>;
}
