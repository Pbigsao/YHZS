"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { IMAGE_RULES, validateImage } from "@yh/core";

type Board = { id: string; name: string };
const legacyDocument = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

export default function NewPostPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => { let active = true; const client = createSupabaseBrowserClient(); void client.auth.getUser().then(async ({ data }) => { if (!data.user) return router.replace("/login?next=/posts/new"); const { data: boardData } = await client.from("boards").select("id,name").eq("is_archived", false).order("position"); if (!active) return; setAuthorized(true); setBoards(boardData ?? []); setBoardId(boardData?.[0]?.id ?? ""); }); return () => { active = false; }; }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!boardId) return setMessage("请先选择一个可用板块。");
    if (files.length > IMAGE_RULES.maxPostImages) return setMessage(`每个主题最多上传 ${IMAGE_RULES.maxPostImages} 张图片。`);
    const invalid = files.map(validateImage).find(Boolean);
    if (invalid) return setMessage(invalid);
    setSaving(true);
    const client = createSupabaseBrowserClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) { setSaving(false); return setMessage("请先登录后发布主题。"); }
    const { data: post, error } = await client.from("posts").insert({ author_id: auth.user.id, board_id: boardId, title, body: legacyDocument(body), body_markdown: body }).select("id").single();
    if (error || !post) { setSaving(false); return setMessage(error?.message ?? "主题创建失败。"); }
    for (const [position, file] of files.entries()) {
      const path = `${auth.user.id}/posts/${post.id}/${crypto.randomUUID()}`;
      const { error: uploadError } = await client.storage.from("community-images").upload(path, file);
      if (uploadError) { setSaving(false); return setMessage(uploadError.message); }
      const { error: imageError } = await client.from("post_images").insert({ post_id: post.id, storage_path: path, position });
      if (imageError) { setSaving(false); return setMessage(imageError.message); }
    }
    router.push(`/posts/${post.id}`);
  }

  if (!authorized) return <section className="contentPage"><p className="emptyState">正在确认登录状态...</p></section>;
  return <section className="contentPage"><a className="backLink" href="/">返回话题</a><h1 className="pageTitle">发布主题</h1><p className="pageLead">提交后将进入审核队列，通过后才会公开显示。</p><form className="panel formGrid" onSubmit={submit}><label>板块<select value={boardId} onChange={(event) => setBoardId(event.target.value)} required>{boards.map((board) => <option value={board.id} key={board.id}>{board.name}</option>)}</select></label><label>标题<input value={title} minLength={2} maxLength={160} onChange={(event) => setTitle(event.target.value)} required /></label><label>内容<textarea value={body} minLength={2} onChange={(event) => setBody(event.target.value)} required /></label><label>图片（JPEG、PNG、WebP 或 GIF，单张不超过 5 MB）<input type="file" accept={IMAGE_RULES.acceptedTypes.join(",")} multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label><button className="primaryButton" disabled={saving}>{saving ? "正在提交..." : "提交审核"}</button>{message && <p className="notice errorNotice">{message}</p>}</form></section>;
}
