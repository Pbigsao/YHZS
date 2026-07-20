"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../../lib/supabase";

type Post = { id: string; title: string; body_markdown: string; author_id: string };
export default function EditPostPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const [post, setPost] = useState<Post | null>(null); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { const client = createSupabaseBrowserClient(); void Promise.all([client.from("posts").select("id,title,body_markdown,author_id").eq("id", id).single(), client.auth.getUser()]).then(([{ data, error }, { data: auth }]) => { if (error || !data || auth.user?.id !== data.author_id) return setMessage("无法编辑这个主题。"); setPost(data); setTitle(data.title); setBody(data.body_markdown); }); }, [id]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!post) return; setSaving(true); const legacy = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] }; const { error } = await createSupabaseBrowserClient().from("posts").update({ title, body: legacy, body_markdown: body, status: "pending", updated_at: new Date().toISOString() }).eq("id", post.id); setSaving(false); if (error) return setMessage(error.message); router.push(`/posts/${post.id}`); }
  if (!post) return <section className="contentPage"><Link className="backLink" href={`/posts/${id}`}>返回主题</Link><p className="emptyState">{message || "正在加载主题..."}</p></section>;
  return <section className="contentPage"><Link className="backLink" href={`/posts/${id}`}>取消编辑</Link><h1 className="pageTitle">编辑主题</h1><p className="pageLead">保存后主题会重新进入审核队列。</p><form className="panel formGrid" onSubmit={submit}><label>标题<input value={title} minLength={2} maxLength={160} onChange={(event) => setTitle(event.target.value)} required /></label><label>内容<textarea value={body} minLength={2} onChange={(event) => setBody(event.target.value)} required /></label><button className="primaryButton" disabled={saving}>{saving ? "正在保存..." : "保存并提交审核"}</button>{message && <p className="notice errorNotice">{message}</p>}</form></section>;
}
