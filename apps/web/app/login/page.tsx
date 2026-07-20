"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase";

type View = "form" | "sending" | "sent" | "error";

export default function LoginPage() {
  return <Suspense fallback={null}><LoginContent /></Suspense>;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [view, setView] = useState<View>("form");
  const [error, setError] = useState("");
  const nextPath = searchParams.get("next")?.startsWith("/") && !searchParams.get("next")?.startsWith("//") ? searchParams.get("next")! : "/";

  useEffect(() => {
    void createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (data.user) router.replace(nextPath);
    });
  }, [nextPath, router]);

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setView("sending");
    setError("");
    const { error: requestError } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${nextPath}` }
    });
    if (requestError) {
      setError(requestError.message);
      setView("error");
      return;
    }
    setView("sent");
  }

  return <section className="authPage">
    <div className="authPanel">
      {view === "sent" ? <div className="authConfirmation" aria-live="polite"><p className="authKicker">邮件已发送</p><h1>检查你的收件箱</h1><p>登录链接已发送至 <strong>{email}</strong>。</p><button className="primaryButton" type="button" onClick={() => setView("form")}>使用其他邮箱</button></div> : <><p className="authKicker">账户登录</p><h1>继续进入社区</h1><p className="authIntro">使用邮箱登录，无需设置密码。</p><form className="authForm" onSubmit={sendLink}><label htmlFor="email">邮箱地址</label><input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => { setEmail(event.target.value); if (view === "error") setView("form"); }} placeholder="name@example.com" required autoFocus /><button className="primaryButton authSubmit" disabled={view === "sending"}>{view === "sending" ? "正在发送..." : "发送登录链接"}</button>{view === "error" && <p className="authError" role="alert">{error}</p>}</form><p className="authFootnote">登录链接将发送到你的邮箱。</p></>}
    </div>
  </section>;
}
