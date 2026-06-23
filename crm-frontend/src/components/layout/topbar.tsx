"use client";

import { Bell, Moon, Sun, UserCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function Topbar() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="absolute right-0 flex h-16 items-center gap-4 pt-4 px-8 justify-between bg-transparent">
      <div className="w-full flex-1">
        {/* Search or Breadcrumbs can go here */}
      </div>
      <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-sm">
        {mounted && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span className="sr-only">Toggle theme</span>
            {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell size={18} />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <UserCircle size={20} />
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </div>
    </header>
  );
}
