import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // libSQL ships native bindings for Node and must not be bundled by the server
  // compiler; the Workers build never imports it (D1 is used there).
  serverExternalPackages: ["@libsql/client", "libsql"],
  allowedDevOrigins: process.env.PREVIEW_HOST ? [process.env.PREVIEW_HOST] : [],
  images: {
    deviceSizes: [360, 420, 640, 828, 1080, 1280, 1600, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
