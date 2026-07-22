"use client";
import { useEffect, useState } from "react";
import { IconSearch, IconPlus, IconMenu } from "./icons";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function TopNav({ onToggleMenu }: { onToggleMenu?: () => void }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled) setUserEmail(session?.user.email ?? null);
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <button className="top-nav__hamburger" onClick={onToggleMenu} aria-label="打开菜单">
          <IconMenu size={22} />
        </button>
        <a href="/" className="top-nav__logo">
          <img src="/logo.png" alt="萤火之森漫研社" width={32} height={32} style={{borderRadius:8}} />
          <span className="top-nav__logo-text">萤火之森漫研社论坛</span>
        </a>
        <div className={`search-box top-nav__search ${searchOpen ? "top-nav__search--open" : ""}`}>
          <IconSearch className="search-box__icon" size={18} />
          <input className="search-box__input" type="text" placeholder="搜索帖子、社团成员、作品..." />
        </div>
        <button className="top-nav__search-toggle" onClick={() => setSearchOpen(v => !v)} aria-label="搜索">
          <IconSearch size={20} />
        </button>
        <div className="top-nav__right">
          <div className="top-nav__actions">
            <a href="/posts/new" className="btn btn-primary">
              <IconPlus size={18} /> <span>发布主题</span>
            </a>
          </div>
          <div className="top-nav__auth">
            {userEmail ? (
              <button
                className="btn btn-ghost btn--sm"
                onClick={() => createSupabaseBrowserClient().auth.signOut()}
              >
                退出 {userEmail}
              </button>
            ) : (
              <a href="/auth" className="btn btn-primary">
                登录
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}