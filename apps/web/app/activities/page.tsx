"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";

type Activity = { id: string; slug: string; title: string; description_markdown: string; status: string; submission_ends_at: string; voting_ends_at: string };
export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  useEffect(() => { void createSupabaseBrowserClient().from("activities").select("id,slug,title,description_markdown,status,submission_ends_at,voting_ends_at").in("status", ["published", "closed"]).order("created_at", { ascending: false }).then(({ data }) => setActivities(data ?? [])); }, []);
  return <section className="contentPage wide"><h1 className="pageTitle">活动</h1><p className="pageLead">参与社区活动、提交作品并在开放投票期间支持喜欢的作品。</p><div className="cardGrid">{activities.map((activity) => <article className="infoCard" key={activity.id}><h2>{activity.title}</h2><p>{activity.description_markdown || "查看活动详情和参与时间。"}</p><p className="statusLine">{activity.status === "published" ? `投稿截止：${new Date(activity.submission_ends_at).toLocaleString("zh-CN")}` : "活动已结束"}</p><Link href={`/activities/${activity.slug}`}>查看活动</Link></article>)}{activities.length === 0 && <p className="emptyState">目前没有公开活动。</p>}</div></section>;
}
