"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { useMobileHeader } from "./mobile-header-context";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function MobileGlassHeader() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const { resolvedTitle, showBack: overrideBack, isScrolled } = useMobileHeader();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const showBack = overrideBack || pathname.split("/").filter(Boolean).length >= 2;
  const titleKey = `${pathname}|${resolvedTitle}`;

  // Default to light mode values before hydration to avoid mismatch
  const isDark = mounted && resolvedTheme === "dark";
  const bgGlass = isDark ? "rgba(28, 28, 30, 0.55)" : "rgba(255, 255, 255, 0.6)";
  const borderGlass = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

  return (
    <header className="md:hidden absolute inset-x-0 top-0 z-40">
      <motion.div 
        className="relative pt-[env(safe-area-inset-top)] border-b"
        animate={{
          backgroundColor: isScrolled ? bgGlass : "rgba(0,0,0,0)",
          borderColor: isScrolled ? borderGlass : "rgba(0,0,0,0)",
          backdropFilter: isScrolled ? "blur(24px) saturate(150%)" : "blur(0px) saturate(100%)",
        }}
        transition={{ duration: 0.2 }}
      >
        <motion.div 
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
          animate={{ opacity: isScrolled ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        />
        
        <div className="relative h-12 flex items-center justify-between px-4">
          <div className="z-10 flex items-center">
            {showBack && (
              <button
                onClick={() => router.back()}
                aria-label="Back"
                className="h-10 w-10 rounded-full flex items-center justify-center transition-all active:scale-90 bg-white/70 dark:bg-white/15 backdrop-blur-xl border border-black/[0.07] dark:border-white/20 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                <ChevronLeft className="w-6 h-6 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-24 overflow-hidden">
            <AnimatePresence initial={false}>
              {isScrolled && (
                <motion.h1
                  key={titleKey}
                  initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
                  transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                  className="text-[17px] font-semibold tracking-tight text-foreground truncate max-w-full"
                >
                  {resolvedTitle}
                </motion.h1>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </header>
  );
}