"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setIsError(true);
    } else {
      setMessage("登录成功！");
      setIsError(false);
      setTimeout(() => router.push("/"), 600);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-page__bg" />

      <div className="auth-page__card">
        <a href="/" className="auth-page__logo">
          <img src="/logo.png" alt="萤火之森漫研社" width={36} height={36} style={{borderRadius:8}} />
          <span>萤火之森漫研社论坛</span>
        </a>

        <h1 className="auth-page__title">欢迎回来</h1>
        <p className="auth-page__subtitle">登录你的萤火之森账号</p>

        <form className="auth-page__form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">邮箱地址</label>
            <input
              className="input input--glass"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              className="input input--glass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>

          {message && (
            <div className={`alert ${isError ? "alert-error" : "alert-info"}`}>
              {message}
            </div>
          )}

          <button className="btn btn-primary btn--full" type="submit" disabled={loading}>
            {loading ? "处理中..." : "登录"}
          </button>
        </form>

        <div className="auth-page__footer">
          还没有账号？{" "}
          <a href="/register" className="link-btn">
            立即注册
          </a>
        </div>
      </div>
    </div>
  );
}
