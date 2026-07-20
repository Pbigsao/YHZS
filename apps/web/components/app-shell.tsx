"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "./auth-button";
import { ThemeToggle } from "./theme-toggle";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Board = { id: string; slug: string; name: string };
type Activity = { id: string; slug: string; title: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";
  const [menuOpen, setMenuOpen] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    if (isAuthPage) return;
    const client = createSupabaseBrowserClient();
    void client.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));
    void Promise.all([
      client.from("boards").select("id,slug,name").eq("is_archived", false).order("position"),
      client.from("activities").select("id,slug,title").in("status", ["published", "closed"]).limit(6)
    ]).then(([boardResult, activityResult]) => {
      setBoards(boardResult.data ?? []);
      setActivities(activityResult.data ?? []);
    });
    return () => listener.subscription.unsubscribe();
  }, [isAuthPage]);

  const active = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));

  if (isAuthPage) return <div className="communityApp authApp"><header className="authHeader"><Link className="headerCommand" href="/">返回社区</Link><ThemeToggle /></header><main>{children}</main></div>;

  return <div className="communityApp">
    <header className="siteHeader"><button className="iconButton" type="button" aria-label={menuOpen ? "收起菜单" : "展开菜单"} title={menuOpen ? "收起菜单" : "展开菜单"} onClick={() => setMenuOpen((value) => !value)}><span aria-hidden="true">&#8801;</span></button><div className="headerSpacer" /><div className="headerTools">{isSignedIn && <Link className="headerCommand publishCommand" href="/posts/new">发布</Link>}<ThemeToggle /><AuthButton /></div></header>
    <div className="appFrame">
      <aside className={`sideMenu ${menuOpen ? "isOpen" : ""}`} aria-label="主导航">
        <nav className="mainNav"><Link className={active("/") ? "selected" : ""} href="/">话题</Link><Link className={active("/activities") ? "selected" : ""} href="/activities">活动</Link>{isSignedIn && <Link className={active("/posts/new") ? "selected" : ""} href="/posts/new">发布主题</Link>}</nav>
        <section className="menuGroup"><h2>板块</h2>{boards.map((board) => <Link href={`/boards/${board.slug}`} key={board.id}>{board.name}</Link>)}{boards.length === 0 && <p className="menuEmpty">暂无板块</p>}</section>
        {activities.length > 0 && <section className="menuGroup"><h2>进行中的活动</h2>{activities.map((activity) => <Link href={`/activities/${activity.slug}`} key={activity.id}>{activity.title}</Link>)}</section>}
      </aside>
      <main className="appContent">{children}</main>
    </div>
  </div>;
}
