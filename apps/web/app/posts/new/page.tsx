"use client";

import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { IMAGE_RULES, validateImage } from "../../../lib/core";
import { formatImageUploadFailures, uploadCommunityImages } from "../../../lib/image-upload";

type Board = { id: string; name: string };

export default function NewPostPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    createSupabaseBrowserClient()
      .from("boards")
      .select("id,name")
      .order("position")
      .then(({ data }) => {
        if (cancelled) return;
        setBoards(data ?? []);
        setBoardId(data?.[0]?.id ?? "");
      });

    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (submitting) return;
    setSubmitting(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("请先在首页通过邮箱登录。");
      setSubmitting(false);
      return;
    }

    if (files.length > IMAGE_RULES.maxPostImages) {
      setMessage(`每个主题最多上传 ${IMAGE_RULES.maxPostImages} 张图片。`);
      setSubmitting(false);
      return;
    }

    const invalid = files.map(validateImage).find(Boolean);
    if (invalid) {
      setMessage(invalid);
      setSubmitting(false);
      return;
    }

    const bodyDocument = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
    };

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        author_id: auth.user.id,
        board_id: boardId,
        title,
        body: bodyDocument,
      })
      .select("id")
      .single();

    if (error || !post) {
      setMessage(error?.message ?? "创建主题失败。");
      setSubmitting(false);
      return;
    }

    const failures = await uploadCommunityImages({
      supabase,
      userId: auth.user.id,
      scope: "posts",
      parentId: post.id,
      files,
      createImageRecord: (storagePath, position) => supabase
        .from("post_images")
        .insert({ post_id: post.id, storage_path: storagePath, position }),
    });

    if (failures.length > 0) {
      setMessage(formatImageUploadFailures(failures));
      setSubmitting(false);
      return;
    }

    setMessage("主题已提交审核，通过后会公开显示。");
    setTitle("");
    setBody("");
    setFiles([]);
    setSubmitting(false);
  }

  return (
    <main className="content-main">
          <div className="page-header">
            <a href="/" className="back-link">← 返回社区</a>
            <h1 className="page-header__title" style={{ marginTop: 16 }}>发布主题</h1>
            <p className="page-header__description">主题提交后会进入审核队列。</p>
          </div>
          <form className="form-card" onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">板块</label>
              <select
                className="select"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                required
              >
                {boards.map((board) => (
                  <option value={board.id} key={board.id}>{board.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">标题</label>
              <input
                className="input"
                value={title}
                minLength={2}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">内容</label>
              <textarea
                className="textarea"
                value={body}
                minLength={2}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                图片（JPEG、PNG、WebP 或 GIF，单张不超过 5 MB）
              </label>
              <input
                className="input"
                type="file"
                accept={IMAGE_RULES.acceptedTypes.join(",")}
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <span className="form-hint">最多上传 {IMAGE_RULES.maxPostImages} 张图片</span>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "提交中..." : "提交审核"}
            </button>
            {message && (
              <p
                className={`alert ${message.includes("失败") || message.includes("超过") ? "alert-error" : "alert-info"}`}
                style={{ marginTop: 12 }}
              >
                {message}
              </p>
            )}
          </form>
    </main>
  );
}
