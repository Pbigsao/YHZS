"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { IconCheck, IconShield, IconUser, IconUsers, IconX } from "../../components/icons";
import { IMAGE_RULES, validateImage } from "../../lib/core";
import { createSupabaseBrowserClient } from "../../lib/supabase";

type Role = "member" | "admin" | "super_admin";
type Profile = { id: string; display_name: string; avatar_url: string | null; role: Role; created_at?: string };
type ModerationKind = "post" | "comment" | "submission";
type ModerationStatus = "approved" | "rejected" | "hidden" | "removed";
type ModerationItem = {
  id: string;
  kind: ModerationKind;
  title: string;
  excerpt: string;
  author: string;
  createdAt: string;
  href: string | null;
};

const ROLE_LABELS: Record<Role, string> = {
  member: "普通成员",
  admin: "管理员",
  super_admin: "超级管理员",
};

function getRelationName(value: unknown): string {
  if (Array.isArray(value)) return value[0]?.display_name ?? "成员";
  if (value && typeof value === "object" && "display_name" in value) {
    return String(value.display_name ?? "成员");
  }
  return "成员";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function moderationMessage(error: { message: string } | null) {
  return error?.message ?? "操作已完成。";
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [moderationItems, setModerationItems] = useState<ModerationItem[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loadingStaffData, setLoadingStaffData] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const loadStaffData = useCallback(async (currentProfile: Profile) => {
    if (currentProfile.role === "member") return;
    setLoadingStaffData(true);
    const supabase = createSupabaseBrowserClient();
    const [postsResult, commentsResult, submissionsResult, membersResult] = await Promise.all([
      supabase.from("posts").select("id,title,body_markdown,created_at,profiles!posts_author_id_fkey(display_name)").eq("status", "pending").order("created_at", { ascending: true }).limit(30),
      supabase.from("comments").select("id,body_markdown,created_at,post_id,profiles!comments_author_id_fkey(display_name)").eq("status", "pending").order("created_at", { ascending: true }).limit(30),
      supabase.from("activity_submissions").select("id,title,body_markdown,created_at,profiles!activity_submissions_author_id_fkey(display_name),activities!activity_submissions_activity_id_fkey(slug)").eq("status", "pending").order("created_at", { ascending: true }).limit(30),
      currentProfile.role === "super_admin"
        ? supabase.from("profiles").select("id,display_name,avatar_url,role,created_at").order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] as Profile[] }),
    ]);

    const pendingPosts = (postsResult.data ?? []).map((item) => ({
      id: item.id,
      kind: "post" as const,
      title: item.title,
      excerpt: asText(item.body_markdown),
      author: getRelationName(item.profiles),
      createdAt: item.created_at,
      href: `/posts/${item.id}`,
    }));
    const pendingComments = (commentsResult.data ?? []).map((item) => ({
      id: item.id,
      kind: "comment" as const,
      title: "评论",
      excerpt: asText(item.body_markdown),
      author: getRelationName(item.profiles),
      createdAt: item.created_at,
      href: item.post_id ? `/posts/${item.post_id}` : null,
    }));
    const pendingSubmissions = (submissionsResult.data ?? []).map((item) => {
      const activity = Array.isArray(item.activities) ? item.activities[0] : item.activities;
      return {
        id: item.id,
        kind: "submission" as const,
        title: item.title,
        excerpt: asText(item.body_markdown),
        author: getRelationName(item.profiles),
        createdAt: item.created_at,
        href: activity?.slug ? `/activities/${activity.slug}` : null,
      };
    });

    setModerationItems([...pendingPosts, ...pendingComments, ...pendingSubmissions].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    if (currentProfile.role === "super_admin") setMembers((membersResult.data ?? []) as Profile[]);
    setLoadingStaffData(false);
  }, []);

  const loadProfile = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("请先登录后进入个人中心。");
      return;
    }
    const { data, error } = await supabase.from("profiles").select("id,display_name,avatar_url,role,created_at").eq("id", auth.user.id).single();
    if (error || !data) {
      setMessage(error?.message ?? "无法加载个人资料。");
      return;
    }
    const currentProfile = data as Profile;
    setProfile(currentProfile);
    setName(currentProfile.display_name);
    void loadStaffData(currentProfile);
  }, [loadStaffData]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    const { error } = await createSupabaseBrowserClient()
      .from("profiles")
      .update({ display_name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setProfile({ ...profile, display_name: name.trim() });
    window.dispatchEvent(new Event("profile-updated"));
    setMessage("个人资料已保存。");
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!profile || !file) return;
    const validationMessage = validateImage(file);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setUploadingAvatar(true);
    const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "image";
    const storagePath = `${profile.id}/avatars/${crypto.randomUUID()}.${extension}`;
    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage.from("community-avatars").upload(storagePath, file, { upsert: false });
    if (uploadError) {
      setUploadingAvatar(false);
      setMessage(`头像上传失败：${uploadError.message}`);
      return;
    }
    const { data: publicUrl } = supabase.storage.from("community-avatars").getPublicUrl(storagePath);
    const { error: profileError } = await supabase.from("profiles").update({ avatar_url: publicUrl.publicUrl, updated_at: new Date().toISOString() }).eq("id", profile.id);
    setUploadingAvatar(false);
    if (profileError) {
      await supabase.storage.from("community-avatars").remove([storagePath]);
      setMessage(`头像保存失败：${profileError.message}`);
      return;
    }
    setProfile({ ...profile, avatar_url: publicUrl.publicUrl });
    window.dispatchEvent(new Event("profile-updated"));
    setMessage("头像已更新。");
  }

  async function moderate(item: ModerationItem, status: ModerationStatus) {
    if (actingOn) return;
    setActingOn(item.id);
    const { error } = await createSupabaseBrowserClient().rpc("moderate_content", {
      target_kind: item.kind,
      target_id: item.id,
      next_status: status,
      note: null,
    });
    setActingOn(null);
    if (error) {
      setMessage(`审核失败：${moderationMessage(error)}`);
      return;
    }
    setModerationItems((items) => items.filter((entry) => entry.id !== item.id));
    setMessage(status === "approved" ? "内容已通过审核。" : "内容已驳回。");
  }

  async function setMemberRole(member: Profile, role: Role) {
    if (actingOn || member.id === profile?.id || member.role === role) return;
    setActingOn(member.id);
    const { error } = await createSupabaseBrowserClient().rpc("set_member_role", {
      target_user: member.id,
      target_role: role,
    });
    setActingOn(null);
    if (error) {
      setMessage(`角色更新失败：${error.message}`);
      return;
    }
    setMembers((items) => items.map((item) => item.id === member.id ? { ...item, role } : item));
    setMessage(`${member.display_name}的角色已更新。`);
  }

  if (!profile) {
    return <section className="profile-page"><h1 className="page-header__title">个人中心</h1><p className="empty-state">{message || "正在加载个人资料..."}</p></section>;
  }

  const isStaff = profile.role !== "member";
  const isSuperAdmin = profile.role === "super_admin";

  return (
    <section className="profile-page">
      <div className="page-header profile-page__header">
        <div>
          <h1 className="page-header__title">个人中心</h1>
          <p className="page-header__description">管理你的资料和社区权限。</p>
        </div>
        <Link className="back-link" href={`/users/${profile.id}`}>查看公开资料</Link>
      </div>

      <section className="profile-card">
        <div className="profile-card__avatar-wrap">
          {profile.avatar_url ? <img className="profile-card__avatar" src={profile.avatar_url} alt="当前头像" /> : <span className="profile-card__avatar profile-card__avatar--fallback"><IconUser size={36} /></span>}
          <label className="profile-card__avatar-upload">
            <input type="file" accept={IMAGE_RULES.acceptedTypes.join(",")} onChange={uploadAvatar} disabled={uploadingAvatar} />
            {uploadingAvatar ? "上传中..." : "上传头像"}
          </label>
          <p className="profile-card__hint">JPEG、PNG、WebP 或 GIF，最大 5 MB。</p>
        </div>
        <form className="profile-card__form" onSubmit={save}>
          <div className="profile-card__identity"><span className={`role-badge role-badge--${profile.role}`}>{ROLE_LABELS[profile.role]}</span></div>
          <label className="form-label" htmlFor="profile-name">显示名称</label>
          <input id="profile-name" className="input" value={name} minLength={2} maxLength={40} onChange={(event) => setName(event.target.value)} required />
          <button className="btn btn-primary" disabled={saving}>{saving ? "保存中..." : "保存资料"}</button>
        </form>
      </section>

      {message && <p className="profile-message" role="status">{message}</p>}

      {isStaff && (
        <section className="staff-section" aria-labelledby="moderation-heading">
          <div className="section-heading">
            <div>
              <h2 id="moderation-heading" className="section-heading__title"><IconShield size={20} /> 审核队列</h2>
              <p className="staff-section__description">待审核的主题、评论和活动投稿。</p>
            </div>
            <span className="queue-count">{moderationItems.length} 待处理</span>
          </div>
          {loadingStaffData ? <p className="empty-state">正在加载审核队列...</p> : moderationItems.length === 0 ? <p className="staff-empty">当前没有待审核内容。</p> : (
            <div className="moderation-list">
              {moderationItems.map((item) => (
                <article className="moderation-item" key={`${item.kind}-${item.id}`}>
                  <div className="moderation-item__body">
                    <div className="moderation-item__meta"><span>{item.kind === "post" ? "主题" : item.kind === "comment" ? "评论" : "活动投稿"}</span><span>{item.author}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("zh-CN")}</time></div>
                    {item.href ? <Link href={item.href} className="moderation-item__title">{item.title}</Link> : <h3 className="moderation-item__title">{item.title}</h3>}
                    {item.excerpt && <p className="moderation-item__excerpt">{item.excerpt}</p>}
                  </div>
                  <div className="moderation-item__actions">
                    {item.href && <Link className="btn btn-ghost btn--sm" href={item.href}>预览</Link>}
                    <button className="btn btn-primary btn--sm" disabled={actingOn === item.id} onClick={() => void moderate(item, "approved")}><IconCheck size={16} />通过</button>
                    <button className="btn btn-ghost btn--sm moderation-item__reject" disabled={actingOn === item.id} onClick={() => void moderate(item, "rejected")}><IconX size={16} />驳回</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {isStaff && (
        <section className="staff-section" aria-labelledby="content-management-heading">
          <div className="section-heading">
            <div>
              <h2 id="content-management-heading" className="section-heading__title"><IconShield size={20} /> 内容管理</h2>
              <p className="staff-section__description">管理主题状态，隐藏或软删除违规内容。</p>
            </div>
            <Link className="btn btn-primary btn--sm" href="/admin/content">管理内容</Link>
          </div>
        </section>
      )}

      {isSuperAdmin && (
        <>
        <section className="staff-section" aria-labelledby="announcement-heading">
          <div className="section-heading">
            <div>
              <h2 id="announcement-heading" className="section-heading__title"><IconShield size={20} /> 社团公告</h2>
              <p className="staff-section__description">创建、编辑公告板块，并发布社团公告。</p>
            </div>
            <div className="profile-admin-links"><Link className="btn btn-ghost btn--sm" href="/admin/boards">板块管理</Link><Link className="btn btn-primary btn--sm" href="/admin/announcements">管理公告</Link></div>
          </div>
        </section>
        <section className="staff-section" aria-labelledby="members-heading">
          <div className="section-heading">
            <div>
              <h2 id="members-heading" className="section-heading__title"><IconUsers size={20} /> 成员角色</h2>
              <p className="staff-section__description">超级管理员可以分配管理员角色，不能修改自己的角色。</p>
            </div>
          </div>
          {loadingStaffData ? <p className="empty-state">正在加载成员...</p> : (
            <div className="member-role-list">
              {members.map((member) => (
                <div className="member-role-row" key={member.id}>
                  {member.avatar_url ? <img className="member-role-row__avatar" src={member.avatar_url} alt="" /> : <span className="member-role-row__avatar member-role-row__avatar--fallback">{member.display_name.slice(0, 1)}</span>}
                  <div className="member-role-row__identity"><strong>{member.display_name}</strong><span>{ROLE_LABELS[member.role]}</span></div>
                  <select aria-label={`设置${member.display_name}的角色`} value={member.role} disabled={member.id === profile.id || actingOn === member.id} onChange={(event) => void setMemberRole(member, event.target.value as Role)}>
                    <option value="member">普通成员</option><option value="admin">管理员</option><option value="super_admin">超级管理员</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
      )}
    </section>
  );
}
