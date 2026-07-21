"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { TopNav } from "../../../components/top-nav";
import { SidebarNav } from "../../../components/sidebar-nav";
import { SidebarInfo } from "../../../components/sidebar-info";

type RichDocument = { content?: Array<{ content?: Array<{ text?: string }> }> };
type Post = { id: string; title: string; body: RichDocument; created_at: string; profiles: Array<{ display_name: string }>; boards: Array<{ name: string; slug: string }> };
type Comment = { id: string; body: RichDocument; created_at: string; profiles: Array<{ display_name: string }> };
function documentText(document: RichDocument) { return document.content?.flatMap((node) => node.content?.map((part) => part.text ?? "") ?? []).join("") ?? ""; }

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");

  function load() {
    const supabase = createSupabaseBrowserClient();
    supabase.from("posts").select("id,title,body,created_at,profiles!posts_author_id_fkey(display_name),boards!posts_board_id_fkey(name,slug)").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) return setMessage("主题不存在或尚未审核。");
      setPost(data as Post);
      supabase.from("comments").select("id,body,created_at,profiles!comments_author_id_fkey(display_name)").eq("post_id", id).eq("status", "approved").order("created_at").then(({ data: items }) => setComments((items as Comment[] | null) ?? []));
    });
  }

  useEffect(load, [id]);

  async function addComment(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage("请先登录后评论。");
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] };
    const { error } = await supabase.from("comments").insert({ post_id: id, author_id: auth.user.id, body: document });
    setMessage(error ? error.message : "评论已提交审核。");
    if (!error) setBody("");
  }

  if (!post) {
    return (
      <>
        <TopNav />
        <div className="app-layout">
          <SidebarNav />
          <main className="content-main">
            <div className="page-header">
              <a href="/" className="back-link">← 返回社区</a>
            </div>
            <p className="text-muted">{message || "加载中..."}</p>
          </main>
          <SidebarInfo />
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <div className="app-layout">
        <SidebarNav />
        <main className="content-main">
          <div className="page-header">
            <a href={`/boards/${post.boards[0]?.slug ?? ""}`} className="back-link">
              ← {post.boards[0]?.name || "返回板块"}
            </a>
          </div>

          <article className="detail-card">
            <h1 className="detail-card__title">{post.title}</h1>
            <p className="detail-card__meta">
              {post.profiles[0]?.display_name || "成员"} · {new Date(post.created_at).toLocaleString("zh-CN")}
            </p>
            <div className="detail-card__body">{documentText(post.body)}</div>
          </article>

          <section className="content-section">
            <div className="content-section__heading">
              <h2>评论</h2>
            </div>

            <form className="form-card" onSubmit={addComment}>
              <label className="form-card__label">发表评论</label>
              <textarea
                className="form-card__textarea"
                value={body}
                minLength={2}
                onChange={(e) => setBody(e.target.value)}
                placeholder="写下你的想法..."
                required
              />
              <button className="btn btn-primary" type="submit">提交审核</button>
            </form>

            <div className="post-feed" style={{ marginTop: 24 }}>
              {comments.length > 0 ? comments.map((comment) => (
                <div className="comment-card" key={comment.id}>
                  <div className="comment-card__header">
                    <span className="comment-card__author">{comment.profiles[0]?.display_name || "成员"}</span>
                    <span className="comment-card__date">
                      {new Date(comment.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <p className="comment-card__body">{documentText(comment.body)}</p>
                </div>
              )) : (
                <p className="text-muted">暂时没有已审核评论。</p>
              )}
            </div>

            {message && <p className="alert alert-info" style={{ marginTop: 16 }}>{message}</p>}
          </section>
        </main>
        <SidebarInfo />
      </div>
    </>
  );
}
