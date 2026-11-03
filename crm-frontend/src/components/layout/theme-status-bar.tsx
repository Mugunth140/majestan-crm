"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeStatusBar() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    // Matches --background, so the status bar reads as part of the app
    const color = isDark ? "#0a0a0a" : "#ffffff";

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
}
