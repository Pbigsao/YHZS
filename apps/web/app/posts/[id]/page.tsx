"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type RichDocument = { content?: Array<{ content?: Array<{ text?: string }> }> };
type Post = { id: string; title: string; body: RichDocument; created_at: string; profiles: Array<{ display_name: string }>; boards: Array<{ name: string; slug: string }> };
type Comment = { id: string; body: RichDocument; created_at: string; profiles: Array<{ display_name: string }> };
function documentText(document: RichDocument) { return document.content?.flatMap((node) => node.content?.map((part) => part.text ?? "") ?? []).join("") ?? ""; }

export default function PostPage() {
  const { id } = useParams<{ id: string }>(); const [post, setPost] = useState<Post | null>(null); const [comments, setComments] = useState<Comment[]>([]); const [body, setBody] = useState(""); const [message, setMessage] = useState("");
  function load() { const supabase = createSupabaseBrowserClient(); supabase.from("posts").select("id,title,body,created_at,profiles!posts_author_id_fkey(display_name),boards!posts_board_id_fkey(name,slug)").eq("id", id).single().then(({ data, error }) => { if (error || !data) return setMessage("主题不存在或尚未审核。"); setPost(data as Post); supabase.from("comments").select("id,body,created_at,profiles!comments_author_id_fkey(display_name)").eq("post_id", id).eq("status", "approved").order("created_at").then(({ data: items }) => setComments((items as Comment[] | null) ?? [])); }); }
  useEffect(load, [id]);
  async function addComment(event: FormEvent) { event.preventDefault(); const supabase = createSupabaseBrowserClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return setMessage("请先登录后评论。"); const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] }; const { error } = await supabase.from("comments").insert({ post_id: id, author_id: auth.user.id, body: document }); setMessage(error ? error.message : "评论已提交审核。"); if (!error) setBody(""); }
  if (!post) return <main className="formPage"><a href="/">返回社区</a><p>{message || "加载中..."}</p></main>;
  return <main className="formPage"><a href={`/boards/${post.boards[0]?.slug ?? ""}`}>{post.boards[0]?.name || "返回板块"}</a><article className="detail"><h1>{post.title}</h1><p className="meta">{post.profiles[0]?.display_name || "成员"} · {new Date(post.created_at).toLocaleString("zh-CN")}</p><p className="bodyText">{documentText(post.body)}</p></article><section><h2>评论</h2><form onSubmit={addComment}><label>发表评论<textarea value={body} minLength={2} onChange={(e) => setBody(e.target.value)} required /></label><button>提交审核</button></form><div className="postList">{comments.map((comment) => <article className="postRow" key={comment.id}><div><h3>{comment.profiles[0]?.display_name || "成员"}</h3><p>{documentText(comment.body)}</p></div><span>{new Date(comment.created_at).toLocaleDateString("zh-CN")}</span></article>)}{comments.length === 0 && <p className="empty">暂时没有已审核评论。</p>}</div>{message && <p className="formNotice">{message}</p>}</section></main>;
}
