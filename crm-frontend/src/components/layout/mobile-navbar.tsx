"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutGrid, 
  MessageSquareText, 
  Settings, 
  CheckCircle2, 
  Plus, 
  Contact,
  X,
  Briefcase,
  Users,
  Network,
  Building2,
  Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Overview" },
  { href: "/tasks", icon: CheckCircle2, label: "Tasks" },
  { href: "/logs", icon: MessageSquareText, label: "Logs" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const getDynamicAddRoute = () => {
    if (pathname.startsWith("/leads")) return "/leads/new";
    if (pathname.startsWith("/inbound")) return "/inbound/new";
    if (pathname.startsWith("/asset-inventory")) return "/asset-inventory/new";
    if (pathname.startsWith("/agent-network")) return "/agent-network/new";
    if (pathname.startsWith("/hr")) return "/hr/new";
    if (pathname.startsWith("/users")) return "/users/new";
    return null; 
  };

  const handleAddClick = () => {
    const route = getDynamicAddRoute();
    if (route) {
      router.push(route);
    } else {
      setIsAddMenuOpen(true);
    }
  };

  return (
    <>
      <motion.div 
        initial={{ y: 150, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className="md:hidden fixed left-0 right-0 px-4 z-50 flex items-center justify-center gap-4 pointer-events-none bottom-3"
      >
        <div className="flex-1 max-w-[320px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-border/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-[2.5rem] p-1.5 flex items-center justify-around pointer-events-auto relative overflow-hidden">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="relative flex flex-col items-center justify-center w-19 h-[3.5rem] rounded-[2rem] transition-all duration-300 active:scale-90 z-10"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavBackground"
                    className="absolute inset-0 bg-[#0052FF]/10 dark:bg-white/15 rounded-[2rem]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}
                <item.icon 
                  className={cn(
                    "w-[22px] h-[22px] mb-1 transition-colors relative z-20", 
                    isActive ? "text-[#0052FF] dark:text-white" : "text-muted-foreground dark:text-white/60"
                  )} 
                  strokeWidth={isActive ? 2 : 2} 
                />
                <span className={cn(
                  "text-[10px] font-medium transition-colors tracking-wide relative z-20",
                  isActive ? "text-[#0052FF] dark:text-white" : "text-muted-foreground dark:text-white/60"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleAddClick}
          className="w-[3.5rem] h-[3.5rem] shrink-0 bg-white/90 dark:bg-[#2C2C2E]/95 backdrop-blur-xl text-foreground dark:text-white rounded-[2rem] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center active:scale-90 transition-all pointer-events-auto border border-border/60 dark:border-white/10 hover:bg-muted dark:hover:bg-[#3C3C3E]"
        >
          <Plus className="w-7 h-7" strokeWidth={2} />
        </button>
      </motion.div>

      <AnimatePresence>
        {isAddMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex flex-col justify-end"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="bg-card border-t border-border rounded-t-[2.5rem] p-6 shadow-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold tracking-tight">Create New</h2>
                <button onClick={() => setIsAddMenuOpen(false)} className="p-2 bg-muted rounded-full active:scale-95 transition-transform">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                <QuickAddButton icon={Contact} label="Lead" onClick={() => { setIsAddMenuOpen(false); router.push("/leads/new"); }} color="bg-blue-500/10 text-blue-600" />
                <QuickAddButton icon={Building2} label="Inbound" onClick={() => { setIsAddMenuOpen(false); router.push("/inbound/new"); }} color="bg-emerald-500/10 text-emerald-600" />
                <QuickAddButton icon={Layers} label="Asset" onClick={() => { setIsAddMenuOpen(false); router.push("/asset-inventory/new"); }} color="bg-amber-500/10 text-amber-600" />
                <QuickAddButton icon={Network} label="Agent" onClick={() => { setIsAddMenuOpen(false); router.push("/agent-network/new"); }} color="bg-indigo-500/10 text-indigo-600" />
                <QuickAddButton icon={Briefcase} label="Project" onClick={() => { setIsAddMenuOpen(false); router.push("/projects/new"); }} color="bg-rose-500/10 text-rose-600" />
                <QuickAddButton icon={Users} label="User" onClick={() => { setIsAddMenuOpen(false); router.push("/users/new"); }} color="bg-purple-500/10 text-purple-600" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function QuickAddButton({ icon: Icon, label, onClick, color }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
      <div className={cn("w-14 h-14 rounded-[1.2rem] flex items-center justify-center border border-border/50 shadow-sm", color)}>
        <Icon className="w-6 h-6" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </button>
  );
}
