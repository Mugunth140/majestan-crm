import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LottieAnimation } from "@/components/shared/LottieAnimation";

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
    <div className="flex h-screen w-screen items-center justify-center p-4 md:p-6 lg:p-8 bg-muted/20 bg-linear-to-b from-[#D4F1FF] via-[#A8E0FF] to-[#87CEEB] overflow-hidden relative">

      {/* Left */}
      <div className="flex-1 lg:flex-1 flex items-center justify-center h-[calc(100vh-3rem)] rounded-2xl border bg-card shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]">
        {/* Floating Card for the Form */}
        <div className="flex w-full max-w-120 flex-col justify-center p-10 rounded-[2.5rem] z-10">
          <div className="mb-8 flex items-center justify-center">
            <div className="flex size-auto items-center">
              <Image 
                src="/logo/logo.png" 
                alt="Majestan Logo" 
                width={64} 
                height={64} 
                className="object-contain filter saturate-120 drop-shadow-xs"
                priority
              />
            </div>
          </div>

          <div className="mb-10 text-center">
            <h1 className="mb-2 text-[2.5rem] font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-[15px] text-muted-foreground mt-3">
              Log in to access your account and manage your projects seamlessly
            </p>
          </div>

          <form className="space-y-5">
            <div>
              <Input 
                type="email" 
                placeholder="Email Address" 
                className="h-14 rounded-2xl bg-muted/30 px-5 text-[15px] border-border/50 focus-visible:ring-1 focus-visible:ring-[#27427F] transition-all"
              />
            </div>
            
            <div>
              <Input 
                type="password" 
                placeholder="Password" 
                className="h-14 rounded-2xl bg-muted/30 px-5 text-[15px] border-border/50 focus-visible:ring-1 focus-visible:ring-[#27427F] transition-all"
              />
            </div>

            <div className="pt-6">
              <Button 
                className="h-14 w-full rounded-2xl bg-[#27427F] text-white hover:bg-[#1e3466] shadow-[0_8px_20px_-6px_rgba(39,66,127,0.4)] transition-all active:scale-[0.98] text-[15px] font-semibold"
                >
                Sign In
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            Trouble signing in? <a href="#" className="text-[#27427F] font-medium hover:underline transition-colors">Contact Support</a>
          </div>
        </div>
      </div>

      {/* Lottie Animation & Sky Background */}  
      <div className="md:flex-1 lg:flex-1 relative flex items-center justify-center h-[calc(100vh-3rem)]">
          
          {/* Realistic SVG Clouds */}
          <Cloud className="absolute top-[15%] left-[-5%] w-64 drop-shadow-xl" opacity={0.9} />
          <Cloud className="absolute top-[8%] right-[10%] w-48 drop-shadow-xl" opacity={0.8} />
          <Cloud className="absolute top-[40%] right-[-15%] w-80 drop-shadow-lg" opacity={0.6} />
          <Cloud className="absolute bottom-[20%] left-[5%] w-56 drop-shadow-2xl" opacity={0.85} />
          <Cloud className="absolute bottom-[5%] right-[15%] w-72 drop-shadow-xl" opacity={0.95} />
          
          {/* Subtle Sun Glow */}
          <div className="absolute top-[10%] left-[15%] w-40 h-40 rounded-full bg-white/60 blur-3xl pointer-events-none" />

          {/* Lottie Container */}
          <div className="relative z-10 w-full pointer-events-none">
            {/* Added a subtle drop shadow to the Lottie wrapper to lift it off the clouds */}
            <div className="filter drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)]">
              <LottieAnimation src="/lottie/login.lottie" className="w-full h-full" />
            </div>
          </div>
      </div>
    </div>
  );
}
