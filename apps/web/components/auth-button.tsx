"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";

export function AuthButton() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    void client.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!userEmail) return <Link className="headerCommand" href="/login">登录</Link>;
  return <div className="accountControl"><Link href="/profile" title="个人设置">{userEmail}</Link><button className="textButton" type="button" onClick={() => void createSupabaseBrowserClient().auth.signOut()}>退出</button></div>;
}
