"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LottieAnimation } from "@/components/shared/LottieAnimation";
import { Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Reusable SVG Cloud Component
const Cloud = ({ className, opacity = 1 }: { className?: string; opacity?: number }) => (
  <svg 
    viewBox="0 0 105 36" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    style={{ opacity }}
  >
    <path 
      d="M28.3242 16.8927C28.3242 16.8927 28.5303 9.4287 36.3117 7.2144C44.093 4.99995 50.1581 9.4287 50.1581 9.4287C50.1581 9.4287 53.0768 1.67845 62.7981 1.67845C72.5195 1.67845 76.4086 9.4287 76.4086 9.4287C76.4086 9.4287 84.1899 6.10705 90.0261 10.5358C95.8622 14.9646 94.8899 22.7148 94.8899 22.7148C94.8899 22.7148 103.64 23.822 103.64 30.465C103.64 37.108 94.8899 34.8936 94.8899 34.8936H11.7876C11.7876 34.8936 1.08779 34.8936 1.08779 28.2506C1.08779 21.6076 9.84001 21.6076 9.84001 21.6076C9.84001 21.6076 9.84001 16.072 16.6493 14.9648C23.4586 13.8576 28.3242 16.8927 28.3242 16.8927Z" 
      fill="white"
    />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@majestanrealty.com");
  const [password, setPassword] = useState("Prismark@2026");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to sign in");
      }

      // Store token in localStorage for immediate client-side access
      localStorage.setItem("crm_token", data.data.access_token);
      localStorage.setItem("crm_user", JSON.stringify(data.data.user));

      toast.success("Welcome back!", {
        description: "You have successfully signed in.",
      });

      router.push("/");
    } catch (err: any) {
      toast.error("Authentication Failed", {
        description: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Main Login UI - Full Screen Background */}
      <div className="flex h-screen w-screen overflow-hidden relative bg-linear-to-br from-[#D4F1FF] via-[#A8E0FF] to-[#87CEEB]">
        
        {/* Background Clouds & Elements (Visible globally, optimized for right side on desktop) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <Cloud className="absolute top-[10%] left-[60%] w-64 drop-shadow-xl" opacity={0.9} />
          <Cloud className="absolute top-[25%] right-[5%] w-48 drop-shadow-xl" opacity={0.8} />
          <Cloud className="absolute top-[50%] right-[35%] w-80 drop-shadow-lg" opacity={0.6} />
          <Cloud className="absolute bottom-[15%] left-[55%] w-56 drop-shadow-2xl" opacity={0.85} />
          <Cloud className="absolute bottom-[10%] right-[10%] w-72 drop-shadow-xl" opacity={0.95} />
          {/* Subtle Sun Glow */}
          <div className="absolute top-[15%] left-[70%] w-64 h-64 rounded-full bg-white/70 blur-[80px]" />
        </div>

        {/* Lottie Animation (Hidden on Tablet, Visible on Desktop lg+) */}  
        <div className="hidden lg:flex absolute right-0 top-0 bottom-0 w-1/2 items-center justify-center z-10 pointer-events-none">
          <div className="relative w-full max-w-125 xl:max-w-150 scale-100 -translate-x-10 filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]">
            <LottieAnimation src="/lottie/login.lottie" className="w-full h-full" />
          </div>
        </div>

        {/* Floating Form Container */}
        <div className="relative z-20 flex h-full w-full lg:w-1/2 items-center justify-center p-6 lg:p-16">
          <div className="flex w-full max-w-120 flex-col justify-center p-10 md:p-12 bg-card/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-white/50">
            
            <div className="mb-10 flex items-center justify-center">
              <div>
                <Image 
                  src="/logo/logo.png" 
                  alt="Majestan Logo" 
                  width={64} 
                  height={64} 
                  className="object-contain filter drop-shadow-sm saturate-120"
                  priority
                />
              </div>
            </div>

            <div className="mb-10">
              <h1 className="mb-2 text-3xl md:text-4xl font-bold tracking-tight text-foreground text-center">
                Welcome back
              </h1>
              <p className="text-[15px] text-muted-foreground mt-3 text-center">
                Log in to access your dashboard and manage your projects seamlessly.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 relative group">
                <label className="text-xs font-medium tracking-wide text-muted-foreground ml-2">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-900 transition-colors" />
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@majestanrealty.com" 
                    className="h-14 rounded-xl bg-muted/40 pl-11 pr-4 text-[15px] border-border/60 hover:bg-muted/60 focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-blue-900/20 focus-visible:border-blue-900 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2 relative group">
                <div className="flex justify-between items-center ml-2">
                  <label className="text-xs font-medium tracking-wide text-muted-foreground">
                    Password
                  </label>
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-900 transition-colors" />
                  <Input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••" 
                    className="h-14 rounded-xl bg-muted/40 pl-11 pr-4 text-[15px] border-border/60 hover:bg-muted/60 focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-blue-900/20 focus-visible:border-blue-900 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-4 flex flex-col items-center justify-center">
                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 text-white hover:bg-blue-800 shadow-[0_8px_20px_-6px_rgba(30,58,138,0.4)] transition-all active:scale-[0.98] text-[15px] font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
                </Button>
                <p className="text-sm font-normal text-muted-foreground">
                  Having trouble signing in? <a href="#" className="text-blue-900 font-medium hover:underline transition-colors">Report</a>
                </p>
              </div>
            </form>
          </div>
        </div>

      </div>
    </>
  );
}
