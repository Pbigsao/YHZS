"use client";
import { useEffect, useState } from "react";
import { IconSearch, IconPlus } from "./icons";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function TopNav() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    </header>
  );
}
