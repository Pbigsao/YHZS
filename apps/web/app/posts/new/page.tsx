"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { IMAGE_RULES, validateImage } from "@yh/core";

type Board = { id: string; name: string };

export default function NewPostPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { createSupabaseBrowserClient().from("boards").select("id,name").order("position").then(({ data }) => { setBoards(data ?? []); setBoardId(data?.[0]?.id ?? ""); }); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const supabase = createSupabaseBrowserClient(); const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage("请先在首页通过邮箱登录。");
    if (files.length > IMAGE_RULES.maxPostImages) return setMessage(`每个主题最多上传 ${IMAGE_RULES.maxPostImages} 张图片。`);
    const invalid = files.map(validateImage).find(Boolean); if (invalid) return setMessage(invalid);
    const bodyDocument = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] };
    const { data: post, error } = await supabase.from("posts").insert({ author_id: auth.user.id, board_id: boardId, title, body: bodyDocument }).select("id").single();
    if (error || !post) return setMessage(error?.message ?? "创建主题失败。");
    for (const [position, file] of files.entries()) { const path = `${auth.user.id}/posts/${post.id}/${crypto.randomUUID()}`; const { error: uploadError } = await supabase.storage.from("community-images").upload(path, file); if (uploadError) return setMessage(uploadError.message); const { error: imageError } = await supabase.from("post_images").insert({ post_id: post.id, storage_path: path, position }); if (imageError) return setMessage(imageError.message); }
    setMessage("主题已提交审核，通过后会公开显示。"); setTitle(""); setBody(""); setFiles([]);
  }
  return <main className="formPage"><a href="/">返回社区</a><h1>发布主题</h1><p>主题提交后会进入审核队列。</p><form onSubmit={submit}><label>板块<select value={boardId} onChange={(e) => setBoardId(e.target.value)} required>{boards.map((board) => <option value={board.id} key={board.id}>{board.name}</option>)}</select></label><label>标题<input value={title} minLength={2} maxLength={160} onChange={(e) => setTitle(e.target.value)} required /></label><label>内容<textarea value={body} minLength={2} onChange={(e) => setBody(e.target.value)} required /></label><label>图片（JPEG、PNG、WebP 或 GIF，单张不超过 5 MB）<input type="file" accept={IMAGE_RULES.acceptedTypes.join(",")} multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></label><button>提交审核</button>{message && <p className="formNotice">{message}</p>}</form></main>;
}
