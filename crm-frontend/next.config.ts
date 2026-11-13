import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  // Unique per build; the in-app update check compares it with the deployed build's.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID || Date.now().toString(36) },
  turbopack: {},
  // .next/standalone with a minimal server.js; the Docker runner runs it on Node
  // rather than `next start` under Bun (same move as the public site, for memory).
  output: 'standalone',
  // Keep the dev badge clear of the login page's bottom-left accessibility button
  devIndicators: { position: 'bottom-right' },
  allowedDevOrigins: ['192.168.13.167', 'localhost'],
  async rewrites() {
    const backendBase = process.env.BACKEND_URL || 'http://localhost:8000';
    const siteBackendBase = process.env.SITE_BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendBase}/api/v1/:path*`,
      },
      {
        source: '/site-api/:path*',
        destination: `${siteBackendBase}/api/v1/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
