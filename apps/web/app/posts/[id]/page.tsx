"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type RichDocument = {
  content?: Array<{ content?: Array<{ text?: string }> }>;
};

type Post = {
  id: string;
  title: string;
  body: RichDocument;
  created_at: string;
  profiles: Array<{ display_name: string }>;
  boards: Array<{ name: string; slug: string }>;
};

type Comment = {
  id: string;
  body: RichDocument;
  created_at: string;
  profiles: Array<{ display_name: string }>;
};

function documentText(document: RichDocument): string {
  return (
    document.content
      ?.flatMap((node) => node.content?.map((part) => part.text ?? "") ?? [])
      .join("") ?? ""
  );
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function load() {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id,title,body,created_at,profiles!posts_author_id_fkey(display_name),boards!posts_board_id_fkey(name,slug)"
        )
        .eq("id", id)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setMessage("主题不存在或尚未审核。");
        setLoading(false);
        return;
      }

      setPost(data as Post);

      const { data: items } = await supabase
        .from("comments")
        .select("id,body,created_at,profiles!comments_author_id_fkey(display_name)")
        .eq("post_id", id)
        .eq("status", "approved")
        .order("created_at");

      if (cancelled) return;
      setComments((items as Comment[] | null) ?? []);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  async function addComment(event: FormEvent) {
    event.preventDefault();

    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("请先登录后评论。");
      return;
    }

    const richBody = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
    };

    const { error } = await supabase.from("comments").insert({
      post_id: id,
      author_id: auth.user.id,
      body: richBody,
    });

    setMessage(error ? error.message : "评论已提交审核。");
    if (!error) setBody("");
  }

  return (
    <main className="content-main">
          <div className="page-header">
            <a href="/" className="back-link">← 返回社区</a>
          </div>

          {loading ? (
            <p className="text-muted">加载中...</p>
          ) : post ? (
            <>
              <article className="detail-card">
                <h1 className="detail-card__title">{post.title}</h1>
                <p className="detail-card__meta">
                  {post.profiles[0]?.display_name || "成员"} ·{" "}
                  {new Date(post.created_at).toLocaleString("zh-CN")}
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
                  <button className="btn btn-primary" type="submit">
                    提交审核
                  </button>
                </form>

                <div className="post-feed" style={{ marginTop: 24 }}>
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <div className="comment-card" key={comment.id}>
                        <div className="comment-card__header">
                          <span className="comment-card__author">
                            {comment.profiles[0]?.display_name || "成员"}
                          </span>
                          <span className="comment-card__date">
                            {new Date(comment.created_at).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                        <p className="comment-card__body">{documentText(comment.body)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">暂时没有已审核评论。</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <p className="text-muted">{message || "主题不存在。"}</p>
          )}

          {message && (
            <p className="alert alert-info" style={{ marginTop: 16 }}>
              {message}
            </p>
          )}
    </main>
  );
}