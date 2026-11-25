import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "unpdf", "pdfjs-dist"],
  poweredByHeader: false,
};

export default nextConfig;
