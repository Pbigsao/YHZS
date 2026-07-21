"use client";
import {
  IconHome, IconCompass, IconFlame, IconHeart,
  IconMessageCircle, IconImage, IconHelpCircle,
  IconCalendar, IconFolderOpen, IconSparkles, IconShield,
} from "./icons";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ size?: number; className?: string }>;

// slug → 图标映射（代码内维护映射，数据库只存板块基本信息）
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

type Board = { id: string; slug: string; name: string };
type Activity = { id: string; slug: string; title: string };

const STATIC_NAV_ITEMS = [
  { section: "浏览", items: [
    { icon: IconHome, label: "首页", href: "/" },
    { icon: IconCompass, label: "最新", href: "/?tab=latest" },
    { icon: IconFlame, label: "热门", href: "/?tab=hot" },
    { icon: IconHeart, label: "关注", href: "/?tab=following" },
  ]},
];

export function SidebarNav({ currentPath = "/", boards = [], activities = [] }: {
  currentPath?: string;
  boards?: Board[];
  activities?: Activity[];
}) {
  const boardItems = boards.map((b) => ({
    icon: BOARD_ICONS[b.slug] ?? DEFAULT_BOARD_ICON,
    label: b.name,
    href: `/boards/${b.slug}`,
  }));
  const activityItems = activities.map((a) => ({
    icon: IconCalendar,
    label: a.title,
    href: `/activities/${a.slug}`,
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

      {boardItems.length > 0 && (
        <div className="nav-sidebar__group">
          <div className="nav-sidebar__group-title">板块</div>
          {boardItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="nav-sidebar__item"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      )}

      {activityItems.length > 0 && (
        <div className="nav-sidebar__group">
          <div className="nav-sidebar__group-title">活动</div>
          {activityItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="nav-sidebar__item"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      )}

      <div className="nav-sidebar__group">
        <div className="nav-sidebar__group-title">管理</div>
        <a href="/boards/announcements" className="nav-sidebar__item">
          <IconShield size={20} />
          <span>社团公告</span>
        </a>
      </div>
    </nav>
  );
}