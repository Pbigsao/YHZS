"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconMenu, IconPlus, IconSearch, IconUser } from "./icons";
import { createSupabaseBrowserClient } from "../lib/supabase";

type CurrentMember = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export function TopNav({ onToggleMenu, isMenuOpen = false }: { onToggleMenu?: () => void; isMenuOpen?: boolean }) {
  const router = useRouter();
  const [member, setMember] = useState<CurrentMember | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadMember = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMember(null);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .eq("id", auth.user.id)
      .single();

    setMember(data ?? {
      id: auth.user.id,
      display_name: auth.user.email?.split("@")[0] ?? "Member",
      avatar_url: null,
    });
  }, []);

  useEffect(() => {
    void loadMember();
    const supabase = createSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void loadMember());
    window.addEventListener("profile-updated", loadMember);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("profile-updated", loadMember);
    };
  }, [loadMember]);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    setMember(null);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <button
          className="top-nav__hamburger"
          onClick={onToggleMenu}
          aria-label="打开菜单"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
        >
          <IconMenu size={22} />
        </button>
        <a href="/" className="top-nav__logo">
          <img src="/logo.png" alt="萤火之森漫研社" width={32} height={32} />
          <span className="top-nav__logo-text">萤火之森漫研社论坛</span>
        </a>
        <form
          id="site-search"
          className={`search-box top-nav__search ${searchOpen ? "top-nav__search--open" : ""}`}
          onSubmit={submitSearch}
        >
          <button className="search-box__submit" type="submit" aria-label="搜索">
            <IconSearch size={18} />
          </button>
          <input className="search-box__input" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索已审核主题..." />
        </form>
        <button
          className="top-nav__search-toggle"
          onClick={() => setSearchOpen((value) => !value)}
          aria-label="搜索"
          aria-expanded={searchOpen}
          aria-controls="site-search"
        >
          <IconSearch size={20} />
        </button>
        <div className="top-nav__right">
          <div className="top-nav__actions">
            <a href="/posts/new" className="btn btn-primary">
              <IconPlus size={18} /> <span>发布主题</span>
            </a>
          </div>
          <div className="top-nav__auth">
            {member ? (
              <div className="top-nav__member">
                <a className="top-nav__profile-link" href="/profile" aria-label="进入个人中心">
                  {member.avatar_url ? (
                    <img className="top-nav__avatar" src={member.avatar_url} alt={`${member.display_name}的头像`} />
                  ) : (
                    <span className="top-nav__avatar top-nav__avatar--fallback" aria-hidden="true">
                      {member.display_name.slice(0, 1) || <IconUser size={18} />}
                    </span>
                  )}
                  <span className="top-nav__member-name">{member.display_name}</span>
                </a>
                <button className="btn btn-ghost btn--sm top-nav__sign-out" onClick={() => void signOut()}>
                  退出
                </button>
              </div>
            ) : (
              <a href="/auth" className="btn btn-primary">登录</a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
