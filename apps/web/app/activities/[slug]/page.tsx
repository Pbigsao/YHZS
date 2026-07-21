"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase";
import { IMAGE_RULES, validateImage } from "../../../lib/core";
import { TopNav } from "../../../components/top-nav";
import { SidebarNav } from "../../../components/sidebar-nav";
import { SidebarInfo } from "../../../components/sidebar-info";

type Activity = { id: string; title: string; submission_ends_at: string; voting_starts_at: string; voting_ends_at: string; vote_limit: number };
type Submission = { id: string; title: string; profiles: { display_name: string } | null };

export default function ActivityPage() {
  const { slug } = useParams<{ slug: string }>(); const [activity, setActivity] = useState<Activity | null>(null); const [entries, setEntries] = useState<Submission[]>([]); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [files, setFiles] = useState<File[]>([]); const [message, setMessage] = useState("");
  useEffect(() => { const supabase = createSupabaseBrowserClient(); supabase.from("activities").select("id,title,submission_ends_at,voting_starts_at,voting_ends_at,vote_limit").eq("slug", slug).single().then(({ data, error }) => { if (error) setMessage("活动不存在或尚未公开。"); setActivity(data); if (data) supabase.from("activity_submissions").select("id,title,profiles!activity_submissions_author_id_fkey(display_name)").eq("activity_id", data.id).eq("status", "approved").then(({ data: submissions }) => setEntries((submissions as Submission[] | null) ?? [])); }); }, [slug]);
  async function submitWork(event: FormEvent) { event.preventDefault(); if (!activity) return; const supabase = createSupabaseBrowserClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return setMessage("请先登录后投稿。"); if (files.length > IMAGE_RULES.maxSubmissionImages) return setMessage(`每个作品最多上传 ${IMAGE_RULES.maxSubmissionImages} 张图片。`); const invalid = files.map(validateImage).find(Boolean); if (invalid) return setMessage(invalid); const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] }; const { data: submission, error } = await supabase.from("activity_submissions").insert({ activity_id: activity.id, author_id: auth.user.id, title, body: document }).select("id").single(); if (error || !submission) return setMessage(error?.message ?? "提交作品失败。"); for (const [position, file] of files.entries()) { const path = `${auth.user.id}/submissions/${submission.id}/${crypto.randomUUID()}`; const { error: uploadError } = await supabase.storage.from("community-images").upload(path, file); if (uploadError) return setMessage(uploadError.message); const { error: imageError } = await supabase.from("submission_images").insert({ submission_id: submission.id, storage_path: path, position }); if (imageError) return setMessage(imageError.message); } setMessage("作品已提交审核。"); setTitle(""); setBody(""); setFiles([]); }
  async function vote(submissionId: string) { const { error } = await createSupabaseBrowserClient().rpc("cast_activity_vote", { target_submission: submissionId }); setMessage(error ? error.message : "投票成功。"); }

  if (!activity) return (
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

  const now = Date.now(); const accepting = now < new Date(activity.submission_ends_at).getTime(); const voting = now >= new Date(activity.voting_starts_at).getTime() && now < new Date(activity.voting_ends_at).getTime();

  return (
    <>
      <TopNav />
      <div className="app-layout">
        <SidebarNav />
        <main className="content-main">
          <div className="page-header">
            <a href="/" className="back-link">← 返回社区</a>
            <h1 className="page-header__title" style={{marginTop:16}}>{activity.title}</h1>
            <p className="page-header__description">
              投稿截止：{new Date(activity.submission_ends_at).toLocaleString("zh-CN")} · 可投 {activity.vote_limit} 票
            </p>
          </div>

          {accepting && (
            <form className="form-card" onSubmit={submitWork} style={{marginBottom:32}}>
              <h2 style={{fontSize:'var(--font-h2)',fontWeight:600,color:'var(--text-primary)',marginBottom:16}}>提交作品</h2>
              <div className="form-group">
                <label className="form-label">作品标题</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">作品说明</label>
                <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">作品图片</label>
                <input className="input" type="file" accept={IMAGE_RULES.acceptedTypes.join(",")} multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                <span className="form-hint">最多上传 {IMAGE_RULES.maxSubmissionImages} 张图片</span>
              </div>
              <button className="btn btn-primary" type="submit">提交审核</button>
            </form>
          )}

          <div className="content-section">
            <div className="content-section__heading">
              <h2>已审核作品</h2>
            </div>
            <div className="post-feed">
              {entries.map((entry) => (
                <div className="comment-card" key={entry.id}>
                  <div className="comment-card__header">
                    <span className="comment-card__author">{entry.title}</span>
                    <span className="comment-card__date">{entry.profiles?.display_name || "成员"}</span>
                  </div>
                  {voting && (
                    <button className="btn btn-primary btn--sm" onClick={() => vote(entry.id)} style={{marginTop:12}}>投票</button>
                  )}
                </div>
              ))}
              {entries.length === 0 && <p className="text-muted">暂无已审核作品。</p>}
            </div>
          </div>

          {message && <p className={`alert ${message.includes('失败') || message.includes('超过') ? 'alert-error' : 'alert-info'}`} style={{marginTop:16}}>{message}</p>}
        </main>
        <SidebarInfo />
      </div>
    </>
  );
}
