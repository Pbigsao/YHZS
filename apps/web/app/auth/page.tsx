"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setEmailOrUsername("");
    setPassword("");
    setConfirm("");
    setUsername("");
    setEmail("");
    setMessage("");
    setIsError(false);
  }

  function switchMode(m: Mode) {
    setMode(m);
    reset();
  }

  /** Resolve input: if it contains @ treat as email, otherwise look up by username */
  async function resolveEmail(input: string): Promise<string | null> {
    if (input.includes("@")) return input;
    // Treat as username — call RPC
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_email_by_username", {
      p_username: input,
    });
    if (error || !data) {
      return null;
    }
    return data;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOrUsername || !password) return;
    setLoading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();

    // Resolve email from input
    const resolved = await resolveEmail(emailOrUsername.trim());
    if (!resolved) {
      setMessage(
        emailOrUsername.includes("@")
          ? "该邮箱尚未注册"
          : "未找到该用户名，请检查后重试"
      );
      setIsError(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: resolved,
      password,
    });
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !username) return;
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
    if (username.length < 2 || username.length > 40) {
      setMessage("用户名长度需要在 2~40 个字符之间");
      setIsError(true);
      return;
    }
    setLoading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage(error.message);
      setIsError(true);
    } else {
      setMessage("注册成功！请查收邮箱验证邮件。");
      setIsError(false);
      switchMode("login");
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-page__bg" />

      <div className="auth-page__card">
        <a href="/" className="auth-page__logo">
          <img
            src="/logo.png"
            alt="萤火之森漫研社"
            width={36}
            height={36}
            style={{ borderRadius: 8 }}
          />
          <span>萤火之森漫研社论坛</span>
        </a>

        <h1 className="auth-page__title">
          {mode === "login" ? "欢迎回来" : "创建账号"}
        </h1>
        <p className="auth-page__subtitle">
          {mode === "login"
            ? "使用邮箱或用户名登录你的萤火之森账号"
            : "加入萤火之森，分享你所热爱的二次元"}
        </p>

        <form
          className="auth-page__form"
          onSubmit={mode === "login" ? handleLogin : handleRegister}
        >
          {mode === "login" ? (
            /* ---- LOGIN ---- */
            <>
              <div className="form-group">
                <label className="form-label">邮箱 / 用户名</label>
                <input
                  className="input input--glass"
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="输入邮箱或用户名"
                  required
                  autoComplete="username"
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
            </>
          ) : (
            /* ---- REGISTER ---- */
            <>
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
                <label className="form-label">用户名</label>
                <input
                  className="input input--glass"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="你希望在社区中显示的名称"
                  required
                  autoComplete="username"
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
            </>
          )}

          {message && (
            <div className={`alert ${isError ? "alert-error" : "alert-info"}`}>
              {message}
            </div>
          )}

          <button
            className="btn btn-primary btn--full"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "处理中..."
              : mode === "login"
              ? "登录"
              : "注册"}
          </button>
        </form>

        <div className="auth-page__footer">
          {mode === "login" ? (
            <span>
              还没有账号？{" "}
              <button
                className="link-btn"
                onClick={() => switchMode("register")}
              >
                立即注册
              </button>
            </span>
          ) : (
            <span>
              已有账号？{" "}
              <button
                className="link-btn"
                onClick={() => switchMode("login")}
              >
                返回登录
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}