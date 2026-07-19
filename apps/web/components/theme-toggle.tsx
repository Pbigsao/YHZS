"use client";

import { useEffect, useState } from "react";

const storageKey = "yh-theme";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as "light" | "dark" | null;
    const theme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setIsDark(theme === "dark");
    applyTheme(theme);
  }, []);

  function toggleTheme() {
    const theme = isDark ? "light" : "dark";
    setIsDark(!isDark);
    window.localStorage.setItem(storageKey, theme);
    applyTheme(theme);
  }

  return <label className="themeToggle" title={isDark ? "切换为浅色主题" : "切换为深色主题"}>
    <input type="checkbox" checked={isDark} onChange={toggleTheme} aria-label="切换深色主题" />
    <span aria-hidden="true" />
  </label>;
}
