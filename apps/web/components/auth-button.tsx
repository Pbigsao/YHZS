"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { LoginModal } from "./login-modal";

export function AuthButton() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <>
      {userEmail ? (
        <button
          className="btn btn-ghost btn--sm"
          onClick={() => {
            createSupabaseBrowserClient().auth.signOut();
          }}
        >
          {userEmail}
        </button>
      ) : (
        <button
          className="btn btn-ghost btn--sm"
          onClick={() => setModalOpen(true)}
        >
          登录
        </button>
      )}
      <LoginModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
