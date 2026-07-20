"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Profile = { id: string; display_name: string; avatar_url: string | null; created_at: string };
type Post = { id: string; title: string; created_at: string; boards: { name: string; slug: string } | { name: string; slug: string }[] | null };
export default function UserPage() {
  const { id } = useParams<{ id: string }>(); const [profile, setProfile] = useState<Profile | null>(null); const [posts, setPosts] = useState<Post[]>([]); const [message, setMessage] = useState("");
  useEffect(() => { let active = true; const client = createSupabaseBrowserClient(); void client.from("profiles").select("id,display_name,avatar_url,created_at").eq("id", id).single().then(async ({ data, error }) => { if (!active) return; if (error || !data) return setMessage("用户不存在。"); setProfile(data); const { data: items } = await client.from("posts").select("id,title,created_at,boards!posts_board_id_fkey(name,slug)").eq("author_id", id).eq("status", "approved").order("created_at", { ascending: false }); if (active) setPosts((items as Post[] | null) ?? []); }); return () => { active = false; }; }, [id]);
  if (!profile) return <section className="contentPage"><Link className="backLink" href="/">返回话题</Link><p className="emptyState">{message || "正在加载成员资料..."}</p></section>;
  return <section className="contentPage"><Link className="backLink" href="/">返回话题</Link><div className="panel profileHeader"><div className="profileAvatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : profile.display_name.slice(0, 1)}</div><div><h1 className="pageTitle">{profile.display_name}</h1><p className="pageLead">加入于 {new Date(profile.created_at).toLocaleDateString("zh-CN")}</p></div></div><section className="panel"><h2>公开主题</h2>{posts.map((post) => { const board = Array.isArray(post.boards) ? post.boards[0] : post.boards; return <Link className="reply" href={`/posts/${post.id}`} key={post.id}><h3>{post.title}</h3><p className="detailMeta">{board?.name || "未分类"} · {new Date(post.created_at).toLocaleDateString("zh-CN")}</p></Link>; })}{posts.length === 0 && <p className="statusLine">还没有公开主题。</p>}</section></section>;
}
