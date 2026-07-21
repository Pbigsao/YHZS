"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function AuthButton() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSent, setLastSent] = useState(0);

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

  async function signIn() {
    const now = Date.now();
    if (now - lastSent < 60_000) {
      setNotice("请等待 60 秒后再试。");
      return;
    }

    setLastSent(now);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setNotice(
      error ? error.message : "登录链接已发送，请查收邮箱。"
    );
  }

  if (userEmail) {
    return (
      <button
        className="btn btn-ghost btn--sm"
        onClick={() => createSupabaseBrowserClient().auth.signOut()}
      >
        退出 {userEmail}
      </button>
    );
  }

  return (
    <div className="auth-menu">
      <input
        aria-label="邮箱"
        className="input"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="邮箱地址"
        style={{ height: 36, fontSize: 13, width: 180 }}
      />
      <button
        className="btn btn-primary btn--sm"
        onClick={signIn}
        disabled={!email}
        style={{ height: 36 }}
      >
        登录
      </button>
      {notice && (
        <small
          className="text-caption"
          style={{ color: "var(--brand-primary)" }}
        >
          {notice}
        </small>
      )}
    </div>
  );
}