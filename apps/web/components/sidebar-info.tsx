"use client";
import { IconFlame, IconTag, IconUsers, IconCalendar, IconExternalLink } from "./icons";

type HotPost = { id: string; title: string; views: number };
type TagItem = { name: string; count: number };
type Member = { name: string; avatar: string };
type Stats = { members: number; posts: number; todayPosts: number; online: number };

interface SidebarInfoProps {
  hotPosts?: HotPost[];
  tags?: TagItem[];
  members?: Member[];
  stats?: Stats;
}

export function SidebarInfo({ hotPosts = [], tags = [], members = [], stats }: SidebarInfoProps) {
  return (
    <aside className="sidebar-right">
      {/* 今日热门 */}
      <section className="info-widget">
        <div className="info-widget__title">
          <IconFlame size={18} /> 今日热门
        </div>
        <div className="info-widget__list">
          {hotPosts.length > 0 ? hotPosts.map((post, i) => (
            <a key={post.id} href={`/posts/${post.id}`} className="info-widget__item">
              <span className="info-widget__rank">{i + 1}</span>
              <span className="info-widget__text truncate">{post.title}</span>
              <span className="info-widget__meta">{post.views} 浏览</span>
            </a>
          )) : (
            <p className="text-muted" style={{fontSize:13}}>暂无热门帖子</p>
          )}
        </div>
      </section>

      {/* 热门标签 */}
      <section className="info-widget">
        <div className="info-widget__title">
          <IconTag size={18} /> 热门标签
        </div>
        <div className="tag-cloud">
          {tags.length > 0 ? tags.map((tag) => (
            <span key={tag.name} className="tag">{tag.name} · {tag.count}</span>
          )) : (
            <p className="text-muted" style={{fontSize:13}}>暂无标签</p>
          )}
        </div>
      </section>

      {/* 活跃成员 */}
      <section className="info-widget">
        <div className="info-widget__title">
          <IconUsers size={18} /> 活跃成员
        </div>
        <div className="member-list">
          {members.length > 0 ? members.map((m) => (
            <div key={m.name} className="member-item" title={m.name}>
              <div className="member-avatar">{m.name[0]}</div>
            </div>
          )) : (
            <p className="text-muted" style={{fontSize:13}}>暂无活跃成员</p>
          )}
        </div>
      </section>

      {/* 社团统计 */}
      {stats && (
        <section className="info-widget">
          <div className="info-widget__title">
            <IconUsers size={18} /> 社团统计
          </div>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-item__num">{stats.members}</span>
              <span className="stat-item__label">成员</span>
            </div>
            <div className="stat-item">
              <span className="stat-item__num">{stats.posts}</span>
              <span className="stat-item__label">帖子</span>
            </div>
            <div className="stat-item">
              <span className="stat-item__num">{stats.todayPosts}</span>
              <span className="stat-item__label">今日发帖</span>
            </div>
            <div className="stat-item">
              <span className="stat-item__num">{stats.online}</span>
              <span className="stat-item__label">在线</span>
            </div>
          </div>
        </section>
      )}
    </aside>
  );
}
