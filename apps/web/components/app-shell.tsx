"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { TopNav } from "./top-nav";
import { IconX } from "./icons";
import { SidebarNav } from "./sidebar-nav";
import { SidebarInfo } from "./sidebar-info";
import { createSupabaseBrowserClient } from "../lib/supabase";

type Board = { id: string; slug: string; name: string };
type Activity = { id: string; slug: string; title: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/auth";
  const [boards, setBoards] = useState<Board[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({ members: 0, posts: 0, todayPosts: 0, online: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isAuthPage) return;
    const client = createSupabaseBrowserClient();
    void Promise.all([
      client.from("boards").select("id,slug,name").order("position"),
      client.from("activities").select("id,slug,title").eq("status", "published").limit(6),
      client.from("posts").select("id,created_at", { count: "exact", head: true }).eq("status", "approved"),
    ]).then(([boardResult, activityResult, postCountResult]) => {
      setBoards(boardResult.data ?? []);
      setActivities(activityResult.data ?? []);
      const totalPosts = postCountResult.count ?? 0;
      setStats(prev => ({ ...prev, posts: totalPosts }));
    });
  }, [isAuthPage]);

  const toggleMenu = useCallback(() => setMobileMenuOpen(v => !v), []);
  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <>
      <TopNav onToggleMenu={toggleMenu} />
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <div className="app-layout">
          <SidebarNav boards={boards} activities={activities} />
          <main className="content-main">{children}</main>
          <SidebarInfo stats={stats} />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <div className={`mobile-drawer-overlay ${mobileMenuOpen ? "mobile-drawer-overlay--open" : ""}`} onClick={closeMenu} />
      <aside className={`mobile-drawer ${mobileMenuOpen ? "mobile-drawer--open" : ""}`}>
        <div className="mobile-drawer__header">
          <button className="mobile-drawer__close" onClick={closeMenu} aria-label="关闭菜单">
            <IconX size={22} />
          </button>
        </div>
        <SidebarNav boards={boards} activities={activities} onNavigate={closeMenu} />
      </aside>
    </>
  );
}
