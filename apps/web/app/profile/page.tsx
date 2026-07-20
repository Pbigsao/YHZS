"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";

type Profile = { id: string; display_name: string; avatar_url: string | null; role: string };
export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null); const [name, setName] = useState(""); const [avatar, setAvatar] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { const client = createSupabaseBrowserClient(); void client.auth.getUser().then(async ({ data }) => { if (!data.user) return setMessage("请先登录后管理个人资料。"); const { data: item, error } = await client.from("profiles").select("id,display_name,avatar_url,role").eq("id", data.user.id).single(); if (error || !item) return setMessage(error?.message ?? "无法加载个人资料。"); setProfile(item); setName(item.display_name); setAvatar(item.avatar_url ?? ""); }); }, []);
  async function save(event: FormEvent) { event.preventDefault(); if (!profile) return; setSaving(true); const { error } = await createSupabaseBrowserClient().from("profiles").update({ display_name: name, avatar_url: avatar || null, updated_at: new Date().toISOString() }).eq("id", profile.id); setSaving(false); setMessage(error?.message ?? "个人资料已保存。"); if (!error) setProfile({ ...profile, display_name: name, avatar_url: avatar || null }); }
  if (!profile) return <section className="contentPage"><h1 className="pageTitle">个人设置</h1><p className="emptyState">{message || "正在加载个人资料..."}</p></section>;
  return <section className="contentPage"><Link className="backLink" href={`/users/${profile.id}`}>查看公开资料</Link><h1 className="pageTitle">个人设置</h1><p className="pageLead">你的身份：{profile.role}</p><form className="panel formGrid" onSubmit={save}><label>显示名称<input value={name} minLength={2} maxLength={40} onChange={(event) => setName(event.target.value)} required /></label><label>头像图片 URL（可选）<input type="url" value={avatar} onChange={(event) => setAvatar(event.target.value)} /></label><button className="primaryButton" disabled={saving}>{saving ? "正在保存..." : "保存资料"}</button>{message && <p className="notice">{message}</p>}</form></section>;
}
