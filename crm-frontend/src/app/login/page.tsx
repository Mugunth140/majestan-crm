import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LottieAnimation } from "@/components/shared/LottieAnimation";
import { MonitorSmartphone, Mail, Lock, ArrowRight } from "lucide-react";

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
  return (
    <>
      {/* Mobile Blocker - Only visible on small screens (< 768px) */}
      <div className="flex md:hidden h-screen w-screen flex-col items-center justify-center bg-background p-8 text-center z-50 fixed inset-0">
        <div className="rounded-full bg-[#0052FF]/10 p-5 mb-6">
          <MonitorSmartphone className="h-12 w-12 text-[#0052FF]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Desktop Required</h1>
        <p className="text-muted-foreground max-w-sm text-[15px] leading-relaxed">
          Majestan CRM is a professional tool optimized for larger screens. Please open this application on a tablet or desktop device.
        </p>
      </div>

      {/* Main Login UI - Full Screen Background */}
      <div className="hidden md:flex h-screen w-screen overflow-hidden relative bg-linear-to-br from-[#D4F1FF] via-[#A8E0FF] to-[#87CEEB ]">
        
        {/* Background Clouds & Elements (Visible globally, optimized for right side on desktop) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <Cloud className="absolute top-[10%] left-[60%] w-64 drop-shadow-xl " opacity={0.9}/>
          <Cloud className="absolute top-[25%] right-[5%] w-48 drop-shadow-xl" opacity={0.8} />
          <Cloud className="absolute top-[50%] right-[35%] w-80 drop-shadow-lg" opacity={0.6} />
          <Cloud className="absolute bottom-[15%] left-[55%] w-56 drop-shadow-2xl" opacity={0.85} />
          <Cloud className="absolute bottom-[10%] right-[10%] w-72 drop-shadow-xl" opacity={0.95} />
          {/* Subtle Sun Glow */}
          <div className="absolute top-[15%] left-[70%] w-64 h-64 rounded-full bg-white/70 blur-[80px]" />
        </div>

        {/* Lottie Animation (Hidden on Tablet, Visible on Desktop lg+) */}  
        <div className="hidden lg:flex absolute right-0 top-0 bottom-0 w-1/2 items-center justify-center z-10 pointer-events-none">
          <div className="relative w-full max-w-200 scale-100 -translate-x-10 filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]">
            <LottieAnimation src="/lottie/login.lottie" className="w-full h-full" />
          </div>
        </div>

        {/* Floating Form Container */}
        <div className="relative z-20 flex h-full w-full lg:w-1/2 items-center justify-center p-6 lg:p-16">
          <div className="flex w-full max-w-120 flex-col justify-center p-10 md:p-12 bg-card/95 backdrop-blur-xl rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-white/50">
            
            <div className="mb-10 flex items-center justify-center">
              <div>
                <Image 
                  src="/logo/logo.png" 
                  alt="Majestan Logo" 
                  width={64} 
                  height={64} 
                  className="object-contain filter drop-shadow-xs saturate-120"
                  priority
                />
              </div>
            </div>

            <div className="mb-10">
              <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground text-center">
                Welcome back
              </h1>
              <p className="text-[15px] text-muted-foreground mt-3 text-center">
                Log in to access your dashboard and manage your projects seamlessly.
              </p>
            </div>

            <form className="space-y-6">
              <div className="space-y-2 relative group">
                <label className="text-xs font-medium tracking-wide text-muted-foreground ml-2">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent-foreground transition-colors" />
                  <Input 
                    type="email" 
                    placeholder="admin@majestan.com" 
                    className="h-14 rounded-xl bg-muted/40 pl-11 pr-4 text-[15px] border-border/60 hover:bg-muted/60 focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/15 focus-visible:border-ring transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-2 relative group">
                <div className="flex justify-between items-center ml-2">
                  <label className="text-xs font-medium tracking-wide text-muted-foreground">
                    Password
                  </label>
                </div>
                <div className="relative
                </div>
                <div c mb-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-accent-foreground transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="h-14 rounded-xl bg-muted/40 pl-11 pr-4 text-[15px] border-border/60 hover:bg-muted/60 focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:border-ring transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 space-y-2 flex flex-col items-center justify-center">
                <Button 
                  className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 text-accent hover:bg-blue-800 shadow-lg transition-all text-sm font-semibold"
                >
                  Sign In
                </Button>
                <p className="text-sm font-normal text-muted-foreground">having trouble signing in? <span className="text-sm hover:text-blue-900">report</span></p>
              </div>
            </form>
          </div>
        </div>

      </div>
    </>
  );  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
}
