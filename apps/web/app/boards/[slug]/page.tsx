"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Board = { id: string; name: string; description: string | null };
type FeedPost = { id: string; title: string; author_name: string; reply_count: number; like_count: number; last_activity_at: string; is_pinned: boolean };

export default function BoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; const client = createSupabaseBrowserClient(); void client.from("boards").select("id,name,description").eq("slug", slug).single().then(async ({ data, error }) => { if (!active) return; if (error || !data) return setMessage("板块不存在或无法访问。"); setBoard(data); const { data: items, error: itemError } = await client.rpc("search_public_posts", { search_query: "", sort_by: "latest", target_board: data.id }); if (!active) return; setPosts((items as FeedPost[] | null) ?? []); setMessage(itemError?.message ?? ""); }); return () => { active = false; }; }, [slug]);
  return <section className="contentPage wide"><Link className="backLink" href="/">返回话题</Link>{board ? <><h1 className="pageTitle">{board.name}</h1><p className="pageLead">{board.description || "浏览这个板块中的主题。"}</p><div className="topicList">{posts.map((post) => <Link className="topicRow" href={`/posts/${post.id}`} key={post.id}><div className="avatar">{post.author_name.slice(0, 1)}</div><div className="topicCopy"><h1>{post.is_pinned && <span className="pinned">置顶</span>}{post.title}</h1><p>{post.author_name}<time>{new Date(post.last_activity_at).toLocaleDateString("zh-CN")}</time></p></div><div className="topicStats"><span>回复 {post.reply_count}</span><span>喜欢 {post.like_count}</span></div></Link>)}{posts.length === 0 && <p className="emptyState">这个板块还没有公开主题。</p>}</div></> : <p className="emptyState">{message || "正在加载板块..."}</p>}</section>;
}
