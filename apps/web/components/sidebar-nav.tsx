"use client";
import { useEffect, useState } from "react";
import {
  IconHome, IconCompass, IconFlame, IconHeart,
  IconMessageCircle, IconImage, IconHelpCircle,
  IconCalendar, IconFolderOpen, IconSparkles, IconShield,
} from "./icons";
import { createSupabaseBrowserClient } from "../lib/supabase";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

// slug → 图标映射（方案B：代码内维护映射，数据库只存板块基本信息）
const BOARD_ICONS: Record<string, IconComponent> = {
  general: IconMessageCircle,
  artworks: IconImage,
  help: IconHelpCircle,
  events: IconCalendar,
  resources: IconFolderOpen,
  "anime-rec": IconSparkles,
  announcements: IconShield,
};

const DEFAULT_BOARD_ICON: IconComponent = IconMessageCircle;

type Board = { slug: string; name: string; description: string | null };

const STATIC_NAV_ITEMS = [
  { section: "浏览", items: [
    { icon: IconHome, label: "首页", href: "/" },
    { icon: IconCompass, label: "最新", href: "/?tab=latest" },
    { icon: IconFlame, label: "热门", href: "/?tab=hot" },
    { icon: IconHeart, label: "关注", href: "/?tab=following" },
  ]},
  { section: "管理", items: [
    { icon: IconShield, label: "社团公告", href: "/boards/announcements" },
  ]},
];

export function SidebarNav({ currentPath = "/" }: { currentPath?: string }) {
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("boards")
      .select("slug,name,description")
      .order("position")
      .then(({ data }) => {
        if (data) setBoards(data);
      });
  }, []);

  const boardItems = boards
    .filter((b) => b.slug !== "announcements") // announcements 已在"管理"组
    .map((board) => ({
      icon: BOARD_ICONS[board.slug] ?? DEFAULT_BOARD_ICON,
      label: board.name,
      href: `/boards/${board.slug}`,
    }));

  return (
    <nav className="nav-sidebar sidebar-left">
      {STATIC_NAV_ITEMS.map((group) => (
        <div key={group.section} className="nav-sidebar__group">
          <div className="nav-sidebar__group-title">{group.section}</div>
          {group.items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`nav-sidebar__item ${currentPath === item.href ? "nav-sidebar__item--active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      ))}

      {/* 板块 - 动态从数据库加载 */}
      <div className="nav-sidebar__group">
        <div className="nav-sidebar__group-title">板块</div>
        {boardItems.length > 0 ? (
          boardItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`nav-sidebar__item ${currentPath === item.href ? "nav-sidebar__item--active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </a>
          ))
        ) : (
          <div className="nav-sidebar__item nav-sidebar__item--disabled">
            <IconMessageCircle size={20} />
            <span>加载中…</span>
          </div>
        )}
      </div>
    </nav>
  );
}