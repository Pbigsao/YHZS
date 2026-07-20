"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const storageKey = "community-editor-theme";
type Theme = "light" | "dark";
type ViewTransitionDocument = Document & { startViewTransition?: (callback: () => void) => { ready: Promise<void> } };

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const origin = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as Theme | null;
    const theme = stored ?? "dark";
    setIsDark(theme === "dark");
    applyTheme(theme);
  }, []);

  function captureOrigin(event: PointerEvent<HTMLLabelElement>) {
    origin.current = { x: event.clientX, y: event.clientY };
  }

  function toggleTheme() {
    const theme: Theme = isDark ? "light" : "dark";
    const fallbackX = window.innerWidth / 2;
    const fallbackY = window.innerHeight / 2;
    const { x, y } = origin.current.x || origin.current.y ? origin.current : { x: fallbackX, y: fallbackY };
    document.documentElement.style.setProperty("--theme-origin-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-origin-y", `${y}px`);

    const apply = () => {
      flushSync(() => setIsDark(theme === "dark"));
      window.localStorage.setItem(storageKey, theme);
      applyTheme(theme);
    };

    const transitionDocument = document as ViewTransitionDocument;
    if (!transitionDocument.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }

    transitionDocument.startViewTransition(apply);
  }

  return <label className="themeToggle" title={isDark ? "切换为浅色主题" : "切换为深色主题"} onPointerDown={captureOrigin}>
    <input type="checkbox" checked={isDark} onChange={toggleTheme} aria-label="切换深色主题" />
    <span aria-hidden="true" />
  </label>;
}
