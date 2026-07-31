"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function MobileHeader({ title, showBack = false, rightAction }: MobileHeaderProps) {
  const router = useRouter();

  return (
    <header className="md:hidden sticky top-0 z-40 w-full bg-background/85 backdrop-blur-xl border-b border-border/50 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between h-12 px-4 relative">
        <div className="flex-1 flex justify-start z-10">
          {showBack && (
            <button 
              onClick={() => router.back()} 
              className="flex items-center text-[#007AFF] active:opacity-70 -ml-2"
            >
              <ChevronLeft className="w-[26px] h-[26px]" strokeWidth={2.5} />
              <span className="text-[17px] font-medium tracking-tight">Back</span>
            </button>
          )}
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground truncate max-w-[60%]">
            {title}
          </h1>
        </div>
        <div className="flex-1 flex justify-end z-10">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
