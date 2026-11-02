"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { InputGroup } from "@cloudflare/kumo/components/input-group";
import {
  EnvelopeSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { PrismarkMark } from "@/components/brand/prismark-mark";
import { PrismarkAssembly } from "@/components/brand/prismark-loader";
import { PrismCanvas } from "./prism-canvas";
import { AccessibilityMenu } from "./accessibility-menu";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "/api/v1"}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to sign in");
      }

      // Store token in localStorage and cookies for client/server-side access
      localStorage.setItem("crm_token", data.data.access_token);
      localStorage.setItem("crm_user", JSON.stringify(data.data.user));
      document.cookie = `crm_token=${data.data.access_token}; path=/; max-age=604800`;

      toast.success("Welcome back!", {
        description: "You have successfully signed in.",
      });

      router.push("/");
    } catch (err) {
      toast.error("Authentication Failed", {
        description: err instanceof Error ? err.message : "Failed to sign in",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#050505]">
      {/* Left: brand canvas (desktop only) */}
      <div className="relative hidden flex-1 lg:block">
        <PrismCanvas className="login-prism absolute inset-y-0 left-0 h-full w-[calc(100%+min(560px,44vw))]" />

        <div
          className="login-rise absolute left-10 top-9 flex items-center gap-2.5 text-white"
          style={{ "--d": "0.4s" } as React.CSSProperties}
        >
          <PrismarkMark className="size-6" />
          <span className="text-[21px] font-semibold leading-none tracking-[-0.02em]">
            PRISMARK
          </span>
        </div>
      </div>

      <AccessibilityMenu className="absolute left-4 top-4 z-20 lg:bottom-8 lg:left-10 lg:top-auto" />

      {/* Right: sign-in panel */}
      <div className="relative z-10 flex w-full p-2 sm:p-3 lg:w-[min(560px,44vw)] lg:shrink-0">
        <div className="login-panel login-panel-enter relative flex w-full flex-col overflow-hidden rounded-[28px] px-5 pb-6 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-10">
          <div className="relative z-10 m-auto flex w-full max-w-[380px] flex-col items-center">
            <PrismarkAssembly className="size-16 text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]" />

            <h1
              style={{ "--d": "0.75s" } as React.CSSProperties}
              className="login-rise mt-8 text-center text-[28px] font-semibold leading-tight tracking-[-0.02em] text-white"
            >
              Welcome back
            </h1>
            <p
              style={{ "--d": "0.85s" } as React.CSSProperties}
              className="login-rise mt-2 text-center text-[13px] leading-relaxed text-white/70"
            >
              Sign in to Prismark CRM to pick up where you left off.
            </p>

            <form
              onSubmit={handleLogin}
              style={{ "--d": "0.95s" } as React.CSSProperties}
              className="login-rise mt-8 flex w-full flex-col gap-5 rounded-[20px] bg-kumo-base p-6 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:ring-white/10"
            >
              <InputGroup label="Email" size="lg">
                <InputGroup.Addon>
                  <EnvelopeSimpleIcon />
                </InputGroup.Addon>
                <InputGroup.Input
                  type="email"
                  aria-label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="you@company.com"
                />
              </InputGroup>

              <InputGroup label="Password" size="lg">
                <InputGroup.Addon>
                  <LockSimpleIcon />
                </InputGroup.Addon>
                <InputGroup.Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-label="Password"
                  placeholder="Your password"
                />
                <InputGroup.Addon align="end">
                  <InputGroup.Button
                    shape="square"
                    className="text-kumo-subtle"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    icon={showPassword ? EyeSlashIcon : EyeIcon}
                    onClick={() => setShowPassword((v) => !v)}
                  />
                </InputGroup.Addon>
              </InputGroup>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isLoading}
                className="mt-1 w-full justify-center"
              >
                Sign in
              </Button>
            </form>
          </div>

          <p
            style={{ "--d": "1.1s" } as React.CSSProperties}
            className="login-rise relative z-10 mt-6 text-center text-[13px] text-white/60"
          >
            Trouble signing in? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
