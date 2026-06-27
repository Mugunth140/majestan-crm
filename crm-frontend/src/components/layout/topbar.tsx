"use client";

import { Bell, Moon, Sun, UserCircle, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-close dropdown after a certain duration (e.g., 4 seconds)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isDropdownOpen) {
      timeoutId = setTimeout(() => {
        setIsDropdownOpen(false);
      }, 3000);
    }
    return () => clearTimeout(timeoutId);
  }, [isDropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    document.cookie = "crm_token=; path=/; max-age=0";
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <header className="absolute right-8 top-8 z-50 flex items-center justify-end bg-transparent pointer-events-none">
      <div className="flex items-center gap-1 rounded-full border bg-card px-2 py-1.5 shadow-sm pointer-events-auto">
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

        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 rounded-full">
            <UserCircle size={20} />
            <span className="sr-only">Toggle user menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 mr-10">
            <div className="px-2 py-1.5 text-sm font-semibold text-center border-b mb-1 text-muted-foreground">My Account</div>
            <DropdownMenuItem className="text-center justify-center">Profile</DropdownMenuItem>
            <DropdownMenuItem className="text-center justify-center">Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex justify-center text-red-600 focus:text-white focus:bg-red-600 dark:focus:bg-red-800  dark:focus:text-white cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </header>
  );
}
