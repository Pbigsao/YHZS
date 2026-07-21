"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase";
import { IconX } from "./icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: Props) {
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
      setTimeout(onClose, 600);
    }
    setLoading(false);
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-card__close" onClick={onClose} aria-label="关闭">
          <IconX size={20} />
        </button>

        <div className="modal-card__header">
          <h2 className="modal-card__title">欢迎回来</h2>
          <p className="modal-card__subtitle">登录你的萤火之森账号</p>
        </div>

        <form className="modal-card__form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">邮箱地址</label>
            <input
              className="input"
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
              className="input"
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

        <div className="modal-card__footer">
          <span>
            还没有账号？{" "}
            <a href="/register" className="link-btn">
              立即注册
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
