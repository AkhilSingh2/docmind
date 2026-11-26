import type { NextConfig } from "next";

// STATIC_DEMO=true builds a browser-only demo for GitHub Pages (see lib/demo).
const staticDemo = process.env.STATIC_DEMO === "true";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "unpdf", "pdfjs-dist"],
  poweredByHeader: false,
  ...(staticDemo
    ? {
        output: "export",
        basePath: "/docmind",
        trailingSlash: true,
        images: { unoptimized: true },
        env: { NEXT_PUBLIC_STATIC_DEMO: "true" },
      }
    : {}),
};

export default nextConfig;
