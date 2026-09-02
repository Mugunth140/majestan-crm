import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
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
