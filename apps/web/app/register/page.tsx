"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { IconX } from "../../components/icons";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (password !== confirm) {
      setMessage("两次输入的密码不一致");
      setIsError(true);
      return;
    }
    if (password.length < 6) {
      setMessage("密码至少需要 6 位");
      setIsError(true);
      return;
    }
    setLoading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) {
      setMessage(error.message);
      setIsError(true);
    } else {
      setMessage("注册成功！请查收邮箱验证邮件。");
      setIsError(false);
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      {/* 背景图 */}
      <div className="auth-page__bg" />

      {/* 左侧注册卡片 */}
      <div className="auth-page__card">
        <a href="/" className="auth-page__logo">
          <img src="/logo.png" alt="萤火之森漫研社" width={36} height={36} style={{borderRadius:8}} />
          <span>萤火之森漫研社论坛</span>
        </a>

        <h1 className="auth-page__title">创建账号</h1>
        <p className="auth-page__subtitle">加入萤火之森，分享你所热爱的二次元</p>

        <form className="auth-page__form" onSubmit={handleRegister}>
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
              placeholder="至少 6 位密码"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label">确认密码</label>
            <input
              className="input input--glass"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再次输入密码"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {message && (
            <div className={`alert ${isError ? "alert-error" : "alert-info"}`}>
              {message}
            </div>
          )}

          <button className="btn btn-primary btn--full" type="submit" disabled={loading}>
            {loading ? "处理中..." : "注册"}
          </button>
        </form>

        <div className="auth-page__footer">
          已有账号？{" "}
          <a href="/login" className="link-btn">
            立即登录
          </a>
        </div>
      </div>
    </div>
  );
}
