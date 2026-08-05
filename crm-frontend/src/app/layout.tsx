import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { ThemeStatusBar } from "@/components/layout/theme-status-bar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Majestan CRM",
  description: "Internal CRM for Majestan Realty",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon/favicon.ico",
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Majestan",
  },
};

// Inline script injected into <head> before any rendering.
// Reads the saved theme from localStorage and immediately applies the class
// to <html> so there is no flash of light mode on dark-mode refreshes.
// Also syncs the theme-color meta so Android Chrome's status bar matches.
// Note: apple-mobile-web-app-status-bar-style is static "black-translucent"
// (set in metadata) because iOS only reads it at page load / PWA launch.
const themeScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var preferred = saved
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var isDark = preferred === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    var color = isDark ? '#1C1C1E' : '#ffffff';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script — prevents flash by applying theme class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} text-[14px] bg-background text-foreground transition-colors duration-500 ease-in-out antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="theme"
        >
          <ThemeStatusBar />
          {children}
          <Toaster
            position="top-right"
            richColors
            offset={{ top: "calc(env(safe-area-inset-top) + 12px)", right: 16 }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)", right: 12 }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
