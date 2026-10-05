"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@/components/icons";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme(
      (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark"
    );
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bm-theme", next);
    setTheme(next);
  };

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
      {theme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}
    </button>
  );
}
