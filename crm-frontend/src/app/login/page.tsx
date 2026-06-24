import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LottieAnimation } from "@/components/shared/LottieAnimation";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center mx-4">

      {/* Left */}
      <div className="flex-1 flex items-center justify-center">
       <div className="flex max-w-xl flex-col justify-center p-10">
          <div className="mb-8 flex items-center justify-center">
            <div className="flex size-auto items-center">
              <Image 
                src="/logo/logo.png" 
                alt="Majestan Logo" 
                width={64} 
                height={64} 
                className="object-contain filter saturate-120"
                priority
              />
            </div>
            {/* <span className="text-4xl font-semibold tracking-tight text-foreground">
              Majestan Realty
            </span> */}
          </div>

          <div className="mb-8">
            <h1 className="mb-2 text-4xl font-semibold tracking-tight text-foreground text-left">
              Welcome Back !
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              Enter your email and password to sign in to your account.
            </p>
          </div>

          <form className="space-y-5">
            <div className="space-y-2">
              <Input 
                type="email" 
                placeholder="admin@majestan.com" 
                className="h-14 rounded-xl bg-background px-4 text-base focus-visible:ring-0.5 focus-visible:ring-blue-300"
              />
            </div>
            
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="••••••••" 
                className="h-14 rounded-xl bg-background px-4 text-base focus-visible:ring-0.5 focus-visible:ring-blue-300"
              />
            </div>

            <div className="pt-4">
              <Button 
                className="h-14 w-full rounded-xl bg-[#27427F] text-white hover:bg-[#1e3466] shadow-md transition-all active:scale-[0.98] text-base font-medium"
                >
                Sign In
              </Button>
            </div>
          </form>

          <div className="mt-5 text-sm text-muted-foreground">
            Trouble signing in? <a href="#" className="text-[#27427F] hover:underline">Contact Support</a>
          </div>
        </div>
      </div>


      {/* Lottie Animation */}  
      <div className="flex-1 relative flex items-center justify-center h-[calc(100vh-2rem)] rounded-2xl overflow-hidden bg-linear-to-b from-sky-200 via-sky-300 to-blue-400">
          <div className="absolute top-10 -left-10 w-40 h-16 rounded-full bg-white/40 blur-2xl" />
          <div className="absolute top-20 right-10 w-60 h-24 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-10 left-20 w-80 h-32 rounded-full bg-white/30 blur-3xl" />
          
          <div className="relative z-10 w-full max-w-2xl">
            <LottieAnimation src="/lottie/login.lottie" className="w-full h-full drop-shadow-2xl" />
          </div>
      </div>
    </div>
  );
}
