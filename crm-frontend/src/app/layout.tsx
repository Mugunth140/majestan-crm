import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import { MonitorSmartphone } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Majestan CRM",
  description: "Internal CRM for Majestan Realty",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} transition-colors duration-500 ease-in-out`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          {/* Global Mobile & Small Tablet Restrictor */}
          <div className="flex lg:hidden fixed inset-0 z-[99999] h-screen w-screen flex-col items-center justify-center bg-background p-8 text-center">
            <div className="rounded-full bg-blue-900/10 p-5 mb-6">
              <MonitorSmartphone className="h-12 w-12 text-blue-900" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">Larger Screen Required</h1>
            <p className="text-muted-foreground max-w-sm text-[15px] leading-relaxed">
              Majestan CRM is a professional enterprise tool optimized for desktops and large tablets. Please open this application on a larger screen.
            </p>
          </div>

          <div className="hidden lg:contents">
            {children}
          </div>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
