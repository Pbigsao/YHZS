"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase";

type AnnouncementBoard = { id: string; name: string; description: string | null; position: number };

export default function AnnouncementSettingsPage() {
  const [board, setBoard] = useState<AnnouncementBoard | null>(null);
  const [name, setName] = useState("社团公告");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return setMessage("请先登录。");
      const [{ data: profile }, { data: announcement }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).single(),
        supabase.from("boards").select("id,name,description,position").eq("slug", "announcements").maybeSingle(),
      ]);
      if (cancelled) return;
      if (profile?.role !== "super_admin") return setMessage("只有超级管理员可以编辑社团公告板块。");
      setAllowed(true);
      if (announcement) {
        setBoard(announcement);
        setName(announcement.name);
        setDescription(announcement.description ?? "");
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!allowed || saving) return;
    setSaving(true);
    const { data, error } = await createSupabaseBrowserClient().rpc("save_board", {
      board_id: board?.id ?? null,
      board_slug: "announcements",
      board_name: name.trim(),
      board_description: description.trim() || null,
      board_archived: false,
      board_position: board?.position ?? 0,
    });
    setSaving(false);
    if (error) return setMessage(error.message);
    setBoard((current) => ({ id: current?.id ?? data, name: name.trim(), description: description.trim() || null, position: current?.position ?? 0 }));
    setMessage("公告板块已保存。");
  }

  return <section className="profile-page"><div className="page-header"><Link className="back-link" href="/profile">返回个人中心</Link><h1 className="page-header__title">社团公告设置</h1><p className="page-header__description">公告板块由管理员发布和维护。</p></div>{allowed ? <form className="form-card" onSubmit={save}><label className="form-label" htmlFor="announcement-name">板块名称</label><input id="announcement-name" className="input" value={name} minLength={2} maxLength={50} onChange={(event) => setName(event.target.value)} required /><label className="form-label" htmlFor="announcement-description">板块说明</label><textarea id="announcement-description" className="textarea" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /><div className="form-card__actions"><button className="btn btn-primary" disabled={saving}>{saving ? "保存中..." : "保存公告板块"}</button><Link className="btn btn-ghost" href="/posts/new?board=announcements">发布公告</Link></div></form> : <p className="empty-state">{message || "正在检查权限..."}</p>}{allowed && message && <p className="profile-message">{message}</p>}</section>;
}
