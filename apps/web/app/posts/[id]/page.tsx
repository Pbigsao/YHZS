"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PostLikeButton } from "../../../components/post-like-button";
import { createCommunityImageUrls } from "../../../lib/community-images";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type RichDocument = { content?: Array<{ content?: Array<{ text?: string }> }> };
type ContentStatus = "pending" | "approved" | "rejected" | "hidden" | "removed";
type Post = {
  id: string;
  title: string;
  body: RichDocument;
  body_markdown: string;
  status: ContentStatus;
  created_at: string;
  profiles: Array<{ id: string; display_name: string; avatar_url: string | null }>;
  post_images: Array<{ storage_path: string; position: number }>;
};
type Comment = { id: string; body: RichDocument; created_at: string; profiles: Array<{ display_name: string }> };

function documentText(document: RichDocument): string {
  return document.content?.flatMap((node) => node.content?.map((part) => part.text ?? "") ?? []).join("") ?? "";
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    async function load() {
      const { data, error } = await supabase.from("posts").select("id,title,body,body_markdown,status,created_at,profiles!posts_author_id_fkey(id,display_name,avatar_url),post_images(storage_path,position)").eq("id", id).single();
      if (cancelled) return;
      if (error || !data) {
        setMessage("主题不存在或你没有预览权限。");
        setLoading(false);
        return;
      }
      const currentPost = data as Post;
      setPost(currentPost);
      const urls = await createCommunityImageUrls(supabase, (currentPost.post_images ?? []).sort((a, b) => a.position - b.position).map((image) => image.storage_path));
      if (cancelled) return;
      setImageUrls(urls);
      const { data: items } = await supabase.from("comments").select("id,body,created_at,profiles!comments_author_id_fkey(display_name)").eq("post_id", id).order("created_at");
      if (cancelled) return;
      setComments((items as Comment[] | null) ?? []);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  async function addComment(event: FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage("请先登录后评论。");
    const richBody = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] };
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: id, author_id: auth.user.id, body: richBody, body_markdown: body, status: "approved" })
      .select("id,body,created_at,profiles!comments_author_id_fkey(display_name)")
      .single();
    if (error) return setMessage(error.message);
    setComments((items) => [...items, data as Comment]);
    setBody("");
    setMessage("评论已发布。");
  }

  if (loading) return <main className="content-main"><p className="text-muted">加载中...</p></main>;
  if (!post) return <main className="content-main"><p className="text-muted">{message}</p></main>;
  const author = post.profiles[0];
  const content = documentText(post.body) || post.body_markdown;

  return <main className="content-main"><div className="page-header"><a href="/" className="back-link">返回社区</a></div><article className="detail-card"><h1 className="detail-card__title">{post.title}</h1><p className="detail-card__meta">{author?.avatar_url && <img className="detail-card__avatar" src={author.avatar_url} alt="" />}{author?.display_name || "成员"} · {new Date(post.created_at).toLocaleString("zh-CN")}</p><div className="detail-card__body">{content}</div>{imageUrls.length > 0 && <div className={`post-card__images post-card__images--${Math.min(imageUrls.length, 3)}`}>{imageUrls.map((url) => <div className="post-card__image" key={url}><img src={url} alt="帖子图片" /></div>)}</div>}<div className="detail-card__actions"><PostLikeButton postId={post.id} /></div>{post.status !== "approved" && <p className="detail-card__notice">这是待审核内容预览，仅作者和审核人员可见。</p>}</article><section className="content-section"><div className="content-section__heading"><h2>评论</h2></div>{post.status === "approved" ? <form className="form-card" onSubmit={addComment}><label className="form-card__label">发表评论</label><textarea className="form-card__textarea" value={body} minLength={2} onChange={(event) => setBody(event.target.value)} required /><button className="btn btn-primary" type="submit">发表评论</button></form> : <p className="text-muted">待审核主题暂不开放评论。</p>}<div className="post-feed" style={{ marginTop: 24 }}>{comments.map((comment) => <div className="comment-card" key={comment.id}><div className="comment-card__header"><span className="comment-card__author">{comment.profiles[0]?.display_name || "成员"}</span><span className="comment-card__date">{new Date(comment.created_at).toLocaleDateString("zh-CN")}</span></div><p className="comment-card__body">{documentText(comment.body)}</p></div>)}{comments.length === 0 && <p className="text-muted">暂无可见评论。</p>}</div></section>{message && <p className="alert alert-info">{message}</p>}</main>;
}
