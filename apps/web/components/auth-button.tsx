"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function AuthButton() {
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` }
    });
    setNotice(error ? error.message : "登录链接已发送，请查收邮箱。");
  }

  if (userEmail) return <button className="quietButton" onClick={() => createSupabaseBrowserClient().auth.signOut()}>退出 {userEmail}</button>;
  return <div className="authBox"><input aria-label="邮箱" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱地址" /><button onClick={signIn} disabled={!email}>登录</button>{notice && <small>{notice}</small>}</div>;
}
