"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LottieAnimation } from "@/components/shared/LottieAnimation";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to sign in");
      }

      // Store token in localStorage and cookies for client/server-side access
      localStorage.setItem("crm_token", data.data.access_token);
      localStorage.setItem("crm_user", JSON.stringify(data.data.user));
      document.cookie = `crm_token=${data.data.access_token}; path=/; max-age=86400`;

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
      <div className="flex h-[100dvh] w-full overflow-hidden relative bg-linear-to-br from-[#D4F1FF] via-[#A8E0FF] to-[#87CEEB]">
        
        {/* Background Clouds & Elements (Visible globally, optimized for right side on desktop) */}
        <div className="hidden lg:block absolute inset-0 z-0 pointer-events-none overflow-hidden">
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
        <div className="relative z-20 flex h-full w-full lg:w-1/2 items-center justify-center p-4 sm:p-6 lg:p-16">
          <div className="flex w-full max-w-[480px] flex-col justify-center p-8 sm:p-10 md:p-12 bg-white/95 backdrop-blur-xl rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-white/50">
            
            <div className="mb-8 sm:mb-10 flex items-center justify-center">
              <div>
                <Image 
                  src="/logo/logo.png" 
                  alt="Majestan Logo" 
                  width={64} 
                  height={64} 
                  className="object-contain filter saturate-120"
                  priority
                />
              </div>
            </div>

            <div className="mb-8 sm:mb-10">
              <h1 className="mb-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gray-900 text-center">
                Welcome back
              </h1>
              <p className="text-[14px] sm:text-[15px] text-gray-500 mt-2 sm:mt-3 text-center leading-relaxed">
                Log in to access your dashboard and manage your projects seamlessly.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
              <div className="space-y-1.5 relative group">
                <label className="text-xs font-semibold tracking-wide text-gray-500 ml-1">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-900 transition-colors" />
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="admin@majestanrealty.com" 
                    className="h-12 sm:h-14 rounded-xl bg-gray-50 text-gray-900 pl-11 pr-4 text-[15px] border-gray-200 hover:bg-gray-100 placeholder:text-gray-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-900/20 focus-visible:border-blue-900 transition-all shadow-none"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5 relative group">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold tracking-wide text-gray-500">
                    Password
                  </label>
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-900 transition-colors" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••" 
                    className="h-12 sm:h-14 rounded-xl bg-gray-50 text-gray-900 pl-11 pr-12 text-[15px] border-gray-200 hover:bg-gray-100 placeholder:text-gray-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-900/20 focus-visible:border-blue-900 transition-all shadow-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword(!showPassword);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors z-10"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 sm:pt-4 space-y-4 flex flex-col items-center justify-center">
                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="group flex h-12 sm:h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 shadow-[0_8px_20px_-6px_rgba(30,58,138,0.4)] transition-all active:scale-[0.98] text-[15px] font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
                </Button>
                <p className="text-xs sm:text-sm font-medium text-gray-500">
                  Having trouble signing in? <a href="#" className="text-[#1e3a8a] font-semibold hover:underline transition-colors">Report</a>
                </p>
              </div>
            </form>
          </div>
        </div>

      </div>
    </>
  );
}
