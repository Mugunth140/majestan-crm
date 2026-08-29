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
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.BACKEND_URL || 'http://localhost:8000/api/v1/:path*',
      },
      {
        source: '/site-api/:path*',
        destination: (process.env.SITE_BACKEND_URL || 'http://localhost:5000') + '/api/v1/:path*',
      },
    ];
  },
};

export default withPWA(nextConfig);
