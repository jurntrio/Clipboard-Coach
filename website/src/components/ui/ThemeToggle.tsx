"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "dark";
    setTheme(stored);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <div className="flex gap-2.5 justify-center">
      <button
        type="button"
        onClick={() => applyTheme("dark")}
        className={`flex items-center gap-2 justify-center flex-1 max-w-[140px] border-2 rounded-lg py-2.5 px-4 text-sm font-medium transition ${
          theme === "dark" ? "border-accent bg-cardHover text-textCardTitle" : "border-border bg-cardDeep text-textMuted hover:text-textPrimary hover:border-borderButton"
        }`}
      >
        <span>🌙</span> Dark
      </button>
      <button
        type="button"
        onClick={() => applyTheme("light")}
        className={`flex items-center gap-2 justify-center flex-1 max-w-[140px] border-2 rounded-lg py-2.5 px-4 text-sm font-medium transition ${
          theme === "light" ? "border-accent bg-cardHover text-textCardTitle" : "border-border bg-cardDeep text-textMuted hover:text-textPrimary hover:border-borderButton"
        }`}
      >
        <span>☀️</span> Light
      </button>
    </div>
  );
}
