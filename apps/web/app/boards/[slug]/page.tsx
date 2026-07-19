"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Board = { id: string; name: string; description: string | null };
type Post = { id: string; title: string; created_at: string; profiles: { display_name: string } | null };

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>(); const [board, setBoard] = useState<Board | null>(null); const [posts, setPosts] = useState<Post[]>([]); const [message, setMessage] = useState("");
  useEffect(() => { const supabase = createSupabaseBrowserClient(); supabase.from("boards").select("id,name,description").eq("slug", slug).single().then(({ data, error }) => { if (error || !data) return setMessage("板块不存在或不可访问。"); setBoard(data); supabase.from("posts").select("id,title,created_at,profiles!posts_author_id_fkey(display_name)").eq("board_id", data.id).eq("status", "approved").order("created_at", { ascending: false }).then(({ data: items }) => setPosts((items as Post[] | null) ?? [])); }); }, [slug]);
  return <main className="formPage"><a href="/">返回社区</a>{board ? <><h1>{board.name}</h1><p>{board.description}</p><a className="primaryAction" href="/posts/new">发布主题</a><div className="postList">{posts.map((post) => <a className="postRow" href={`/posts/${post.id}`} key={post.id}><div><h3>{post.title}</h3><p>{post.profiles?.display_name || "成员"} · {new Date(post.created_at).toLocaleDateString("zh-CN")}</p></div><span>查看</span></a>)}{posts.length === 0 && <p className="empty">暂无已审核主题。</p>}</div></> : <p>{message || "加载中..."}</p>}</main>;
}
