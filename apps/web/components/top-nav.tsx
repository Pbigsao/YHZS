"use client";
import { IconSearch, IconPlus } from "./icons";
import { AuthButton } from "./auth-button";

export function TopNav() {
  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <a href="/" className="top-nav__logo">
          <img src="/logo.png" alt="萤火之森漫研社" width={32} height={32} style={{borderRadius:8}} />
          萤火之森漫研社论坛
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
