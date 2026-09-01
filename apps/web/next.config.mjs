import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits .next/standalone — a self-contained server with only the
  // node_modules it actually traced. Keeps the ARM64 image small.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Prisma ships a native query engine and bcryptjs touches node builtins;
  // neither survives being bundled into the server build.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [
      {
        // The embed script is loaded cross-origin by customer sites.
        // nginx sets these too; this keeps `next start` usable without it.
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=600, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
