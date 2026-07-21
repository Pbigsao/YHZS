"use client";
import { IconSearch, IconPlus } from "./icons";
import { AuthButton } from "./auth-button";

export function TopNav() {
  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <a href="/" className="top-nav__logo">
          {/* 浅绿色狐狸图标 SVG */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" fill="#86D8B2" opacity="0.15"/>
            <path d="M10 22 C10 16, 14 10, 16 8 C18 10, 22 16, 22 22 C22 26, 19 28, 16 28 C13 28, 10 26, 10 22Z" fill="#86D8B2"/>
            <circle cx="12" cy="18" r="1.5" fill="#181818"/>
            <circle cx="20" cy="18" r="1.5" fill="#181818"/>
            <path d="M14 22 C15 24, 17 24, 18 22" stroke="#181818" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          YH Community
        </a>
        <div className="search-box top-nav__search">
          <IconSearch className="search-box__icon" size={18} />
          <input className="search-box__input" type="text" placeholder="搜索帖子、社团成员、作品..." />
        </div>
        <div className="top-nav__actions">
          <a href="/posts/new" className="btn btn-primary">
            <IconPlus size={18} /> 发布主题
          </a>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
