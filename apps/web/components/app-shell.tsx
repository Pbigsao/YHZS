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
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);

  useEffect(() => {
    setRightSidebarCollapsed(window.localStorage.getItem("right-sidebar-collapsed") === "true");
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem("right-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

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

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, mobileMenuOpen]);

  return (
    <>
      <TopNav onToggleMenu={toggleMenu} isMenuOpen={mobileMenuOpen} />
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <div className={`app-layout ${rightSidebarCollapsed ? "app-layout--right-collapsed" : ""}`}>
          <SidebarNav boards={boards} activities={activities} />
          <main className="content-main">{children}</main>
          <SidebarInfo stats={stats} collapsed={rightSidebarCollapsed} onToggleCollapse={toggleRightSidebar} />
        </div>
      )}

      {/* Mobile sidebar drawer */}
      <div className={`mobile-drawer-overlay ${mobileMenuOpen ? "mobile-drawer-overlay--open" : ""}`} onClick={closeMenu} />
      <aside
        className={`mobile-drawer ${mobileMenuOpen ? "mobile-drawer--open" : ""}`}
        id="mobile-navigation"
        aria-label="网站导航"
        aria-hidden={!mobileMenuOpen}
      >
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
