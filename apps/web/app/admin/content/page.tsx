"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconCheck, IconX } from "../../../components/icons";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Role = "member" | "admin" | "super_admin";
type Status = "pending" | "approved" | "rejected" | "hidden" | "removed";
type ManagedPost = { id: string; title: string; body_markdown: string; status: Status; created_at: string; profiles: Array<{ display_name: string }>; boards: Array<{ name: string }> };

const STATUS_LABEL: Record<Status, string> = { pending: "待审核", approved: "已通过", rejected: "已驳回", hidden: "已隐藏", removed: "已删除" };

export default function ContentManagementPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [message, setMessage] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage("请先登录。");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "super_admin") return setMessage("只有管理员可以管理内容。");
    setRole(profile.role);
    const { data, error } = await supabase.from("posts").select("id,title,body_markdown,status,created_at,profiles!posts_author_id_fkey(display_name),boards!posts_board_id_fkey(name)").order("created_at", { ascending: false }).limit(100);
    if (error) return setMessage(error.message);
    setPosts((data as ManagedPost[] | null) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(post: ManagedPost, status: Status) {
    setActingId(post.id);
    const { error } = await createSupabaseBrowserClient().rpc("moderate_content", { target_kind: "post", target_id: post.id, next_status: status, note: null });
    setActingId(null);
    if (error) return setMessage(error.message);
    setPosts((items) => items.map((item) => item.id === post.id ? { ...item, status } : item));
    setMessage("内容状态已更新。");
  }

  if (!role) return <section className="profile-page"><div className="page-header"><Link className="back-link" href="/profile">返回个人中心</Link><h1 className="page-header__title">内容管理</h1></div><p className="empty-state">{message || "正在检查权限..."}</p></section>;
  return <section className="profile-page"><div className="page-header"><Link className="back-link" href="/profile">返回个人中心</Link><h1 className="page-header__title">内容管理</h1><p className="page-header__description">管理员可隐藏或软删除主题，删除记录保留在审核日志中。</p></div>{message && <p className="profile-message">{message}</p>}<div className="content-management-list">{posts.map((post) => <article className="management-row" key={post.id}><div className="management-row__body"><div className="management-row__meta"><span>{STATUS_LABEL[post.status]}</span><span>{post.boards[0]?.name || "未分类"}</span><span>{post.profiles[0]?.display_name || "成员"}</span><time>{new Date(post.created_at).toLocaleString("zh-CN")}</time></div><Link className="management-row__title" href={`/posts/${post.id}`}>{post.title}</Link>{post.body_markdown && <p className="management-row__excerpt">{post.body_markdown}</p>}</div><div className="management-row__actions"><Link className="btn btn-ghost btn--sm" href={`/posts/${post.id}`}>预览</Link>{post.status !== "approved" && <button className="btn btn-primary btn--sm" disabled={actingId === post.id} onClick={() => void setStatus(post, "approved")}><IconCheck size={16} />通过</button>}{post.status !== "hidden" && <button className="btn btn-ghost btn--sm" disabled={actingId === post.id} onClick={() => void setStatus(post, "hidden")}>隐藏</button>}{post.status !== "removed" ? <button className="btn btn-ghost btn--sm management-row__remove" disabled={actingId === post.id} onClick={() => void setStatus(post, "removed")}><IconX size={16} />删除</button> : <button className="btn btn-ghost btn--sm" disabled={actingId === post.id} onClick={() => void setStatus(post, "hidden")}>恢复为隐藏</button>}</div></article>)}{posts.length === 0 && <p className="empty-state">暂无可管理主题。</p>}</div></section>;
}
