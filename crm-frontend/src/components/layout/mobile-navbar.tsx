"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { 
  Home, 
  UserCircle, 
  Building2, 
  Layers, 
  Plus, 
  Contact,
  X,
  Briefcase,
  Users,
  Network
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/leads", icon: Contact, label: "Leads" },
  { href: "/inbound", icon: Building2, label: "Inbound" },
  { href: "/asset-inventory", icon: Layers, label: "Assets" },
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
    return null; // Signals to open the generic menu
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
      {/* Floating Navbar Container */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 px-4 z-50 flex items-center gap-3 safe-bottom pointer-events-none">
        
        {/* Main Nav Pill */}
        <div className="flex-1 bg-card/90 backdrop-blur-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[2rem] p-1.5 flex items-center justify-around pointer-events-auto">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className={cn(
                  "relative flex flex-col items-center justify-center w-14 h-[3.25rem] rounded-[1.5rem] transition-all duration-300 active:scale-95",
                  isActive ? "bg-muted/60" : "hover:bg-muted/30"
                )}
              >
                <item.icon 
                  className={cn(
                    "w-[22px] h-[22px] mb-1 transition-colors", 
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                <span className={cn(
                  "text-[9px] font-semibold transition-colors tracking-wide",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Context-Aware Action Button */}
        <button
          onClick={handleAddClick}
          className="w-14 h-14 shrink-0 bg-[#1e3a8a] text-white rounded-full shadow-[0_8px_20px_-6px_rgba(30,58,138,0.5)] flex items-center justify-center active:scale-90 transition-all pointer-events-auto border border-blue-800/50"
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* Universal 'Add' Overlay Menu (Used when on Home page) */}
      {isAddMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-card border-t border-border rounded-t-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight">Create New...</h2>
              <button onClick={() => setIsAddMenuOpen(false)} className="p-2 bg-muted rounded-full active:scale-95">
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
          </div>
        </div>
      )}
    </>
  );
}

function QuickAddButton({ icon: Icon, label, onClick, color }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border border-border/50 shadow-sm", color)}>
        <Icon className="w-6 h-6" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </button>
  );
}
