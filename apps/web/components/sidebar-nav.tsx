"use client";
import { IconHome, IconCompass, IconFlame, IconHeart, IconMessageCircle, IconImage, IconHelpCircle, IconCalendar, IconFolderOpen, IconSparkles, IconShield } from "./icons";

const NAV_ITEMS = [
  { section: "浏览", items: [
    { icon: IconHome, label: "首页", href: "/", active: true },
    { icon: IconCompass, label: "最新", href: "/?tab=latest" },
    { icon: IconFlame, label: "热门", href: "/?tab=hot" },
    { icon: IconHeart, label: "关注", href: "/?tab=following" },
  ]},
  { section: "板块", items: [
    { icon: IconMessageCircle, label: "综合交流", href: "/boards/general" },
    { icon: IconImage, label: "作品分享", href: "/boards/artworks" },
    { icon: IconHelpCircle, label: "问题求助", href: "/boards/help" },
    { icon: IconCalendar, label: "活动通知", href: "/boards/events" },
    { icon: IconFolderOpen, label: "资源分享", href: "/boards/resources" },
    { icon: IconSparkles, label: "动漫推荐", href: "/boards/anime-rec" },
  ]},
  { section: "管理", items: [
    { icon: IconShield, label: "社团公告", href: "/boards/announcements" },
  ]},
];

export function SidebarNav({ currentPath = "/" }: { currentPath?: string }) {
  return (
    <nav className="nav-sidebar sidebar-left">
      {NAV_ITEMS.map((group) => (
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
    </nav>
  );
}
