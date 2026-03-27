import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "framer-motion",
      "date-fns",
    ],
  },
  allowedDevOrigins: [
    "192.168.2.196:3000",
    "192.168.2.196",
    "192.168.1.112:3000",
    "192.168.100.73:3000",
    "192.168.100.73",
    "192.168.1.112",
    "localhost:3000",
    "localhost",
    "*.trycloudflare.com",
    "joining-hottest-firmware-footwear.trycloudflare.com",
  ],
  async headers() {
    return [
      // CORS headers for Next.js static assets
      {
        source: "/_next/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
      // Security headers for all routes
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob: https://*.mapbox.com",
              "font-src 'self' data:",
              "connect-src 'self' http://192.168.100.73:5000 ws://192.168.100.73:3000 ws://localhost:3000 ws://192.168.2.196:3000 http://localhost:5000 http://192.168.2.196:5000 https://192.168.2.196:5000 https://*.trycloudflare.com https://*.mapbox.com https://api.mapbox.com https://events.mapbox.com wss://*.mapbox.com https://api.cloudinary.com https://api.novu.co wss://ws.novu.co wss://socket.novu.co https://api.bigdatacloud.net https://api-bdc.io https://api.visme.tech",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // HSTS - Force HTTPS in production
          ...(process.env.NODE_ENV === "production"
            ? [
              {
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains",
              },
            ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
