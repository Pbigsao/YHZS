"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function AuthButton() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="top-nav__skeleton" />;

  if (userEmail) {
    return (
      <button
        className="btn btn-ghost btn--sm"
        onClick={() => createSupabaseBrowserClient().auth.signOut()}
      >
        {userEmail}
      </button>
    );
  }

  return (
    <a href="/auth" className="btn btn-ghost btn--sm">
      登录
    </a>
  );
}
