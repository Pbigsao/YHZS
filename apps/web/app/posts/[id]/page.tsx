"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Person = { display_name: string; avatar_url: string | null };
type Post = { id: string; title: string; body_markdown: string; created_at: string; author_id: string; like_count: number; boards: Person & { slug: string; name: string }; profiles: Person };
type Comment = { id: string; body_markdown: string; created_at: string; profiles: Person | Person[] | null };
const profileName = (value: Comment["profiles"]) => Array.isArray(value) ? value[0]?.display_name : value?.display_name;

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  const load = useCallback(async () => {
    const client = createSupabaseBrowserClient();
    const [{ data: postData, error }, { data: auth }] = await Promise.all([client.from("posts").select("id,title,body_markdown,created_at,author_id,like_count,boards!posts_board_id_fkey(slug,name),profiles!posts_author_id_fkey(display_name,avatar_url)").eq("id", id).single(), client.auth.getUser()]);
    if (error || !postData) { setMessage("主题不存在或尚未公开。"); return; }
    setPost(postData as unknown as Post);
    setUserId(auth.user?.id ?? null);
    void client.rpc("increment_post_view", { target_post: id });
    const [commentResult, likeResult] = await Promise.all([client.from("comments").select("id,body_markdown,created_at,profiles!comments_author_id_fkey(display_name,avatar_url)").eq("post_id", id).eq("status", "approved").order("created_at"), auth.user ? client.from("post_likes").select("user_id").eq("post_id", id).eq("user_id", auth.user.id).maybeSingle() : Promise.resolve({ data: null })]);
    setComments((commentResult.data as Comment[] | null) ?? []);
    setLiked(Boolean(likeResult.data));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function addComment(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const client = createSupabaseBrowserClient(); const { data: auth } = await client.auth.getUser();
    if (!auth.user) return setMessage("请先登录后评论。");
    const legacy = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] };
    const { error } = await client.from("comments").insert({ post_id: id, author_id: auth.user.id, body: legacy, body_markdown: body });
    if (error) return setMessage(error.message);
    setBody(""); setMessage("评论已提交审核。");
  }
  async function toggleLike() {
    const client = createSupabaseBrowserClient(); const { data: auth } = await client.auth.getUser();
    if (!auth.user) return setMessage("请先登录后点赞。");
    const result = liked ? await client.from("post_likes").delete().eq("post_id", id).eq("user_id", auth.user.id) : await client.from("post_likes").insert({ post_id: id, user_id: auth.user.id });
    if (result.error) return setMessage(result.error.message);
    setLiked(!liked); setPost((value) => value ? { ...value, like_count: value.like_count + (liked ? -1 : 1) } : value);
  }

  if (!post) return <section className="contentPage"><Link className="backLink" href="/">返回话题</Link><p className="emptyState">{message || "正在加载主题..."}</p></section>;
  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  return <section className="contentPage"><Link className="backLink" href={`/boards/${board?.slug ?? ""}`}>{board?.name || "返回话题"}</Link><article className="panel"><div className="splitActions"><div><h1 className="pageTitle">{post.title}</h1><p className="detailMeta">{author?.display_name || "社区成员"} · {new Date(post.created_at).toLocaleString("zh-CN")}</p></div>{userId === post.author_id && <Link className="secondaryButton" href={`/posts/${post.id}/edit`}>编辑</Link>}</div><div className="markdownBody">{post.body_markdown}</div><div className="splitActions"><button className="secondaryButton" type="button" onClick={toggleLike}>{liked ? "取消喜欢" : "喜欢"} {post.like_count}</button></div></article><section className="panel"><h2>评论</h2><form className="formGrid" onSubmit={addComment}><label>发表回复<textarea value={body} minLength={2} onChange={(event) => setBody(event.target.value)} required /></label><button className="primaryButton">提交审核</button></form>{comments.map((comment) => <article className="reply" key={comment.id}><h3>{profileName(comment.profiles) || "社区成员"}</h3><p className="detailMeta">{new Date(comment.created_at).toLocaleString("zh-CN")}</p><p className="markdownBody">{comment.body_markdown}</p></article>)}{comments.length === 0 && <p className="statusLine">暂时没有公开评论。</p>}{message && <p className="notice">{message}</p>}</section></section>;
}
