"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type Board = { id: string; slug: string; name: string; description: string | null; position: number; is_archived: boolean };
const EMPTY_BOARD = { slug: "", name: "", description: "", position: 10, is_archived: false };

export default function BoardManagementPage() {
  const [allowed, setAllowed] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [editing, setEditing] = useState<Board | null>(null);
  const [form, setForm] = useState(EMPTY_BOARD);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage("请先登录。");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "super_admin") return setMessage("只有超级管理员可以管理板块。");
    setAllowed(true);
    const { data, error } = await supabase.from("boards").select("id,slug,name,description,position,is_archived").order("position");
    if (error) return setMessage(error.message);
    setBoards((data as Board[] | null) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function edit(board: Board | null) {
    setEditing(board);
    setForm(board ? { slug: board.slug, name: board.name, description: board.description ?? "", position: board.position, is_archived: board.is_archived } : EMPTY_BOARD);
    setMessage("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await createSupabaseBrowserClient().rpc("save_board", { board_id: editing?.id ?? null, board_slug: form.slug.trim(), board_name: form.name.trim(), board_description: form.description.trim() || null, board_archived: form.is_archived, board_position: Number(form.position) });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage("板块已保存。");
    edit(null);
    void load();
  }

  if (!allowed) return <section className="profile-page"><div className="page-header"><Link className="back-link" href="/profile">返回个人中心</Link><h1 className="page-header__title">板块管理</h1></div><p className="empty-state">{message || "正在检查权限..."}</p></section>;
  return <section className="profile-page"><div className="page-header"><Link className="back-link" href="/profile">返回个人中心</Link><h1 className="page-header__title">板块管理</h1><p className="page-header__description">创建、编辑和归档讨论板块。归档板块保留历史内容，不接受新主题。</p></div>{message && <p className="profile-message">{message}</p>}<div className="board-management-layout"><section className="staff-section"><div className="section-heading"><h2 className="section-heading__title">现有板块</h2><button className="btn btn-primary btn--sm" onClick={() => edit(null)}>新建板块</button></div><div className="member-role-list">{boards.map((board) => <div className="management-row" key={board.id}><div className="management-row__body"><strong className="management-row__title">{board.name}</strong><p className="management-row__excerpt">/{board.slug} · 排序 {board.position} · {board.is_archived ? "已归档" : "公开"}</p></div><button className="btn btn-ghost btn--sm" onClick={() => edit(board)}>编辑</button></div>)}</div></section><section className="staff-section"><h2 className="section-heading__title">{editing ? "编辑板块" : "新建板块"}</h2><form className="form-card" onSubmit={save}><label className="form-label">URL 标识<input className="input" value={form.slug} pattern="[a-z0-9-]{2,60}" minLength={2} maxLength={60} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} required /></label><label className="form-label">板块名称<input className="input" value={form.name} minLength={2} maxLength={50} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label className="form-label">板块说明<textarea className="textarea" value={form.description} maxLength={500} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="form-label">排序<input className="input" type="number" value={form.position} onChange={(event) => setForm({ ...form, position: Number(event.target.value) })} /></label><label className="form-checkbox"><input type="checkbox" checked={form.is_archived} onChange={(event) => setForm({ ...form, is_archived: event.target.checked })} />归档板块</label><button className="btn btn-primary" disabled={saving}>{saving ? "保存中..." : "保存板块"}</button></form></section></div></section>;
}
