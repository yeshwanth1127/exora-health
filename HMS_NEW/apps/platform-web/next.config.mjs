/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  ...(process.env.NODE_ENV === "development" ? { async rewrites() { return [{ source: "/control/:path*", destination: "http://127.0.0.1:3040/control/:path*" }]; } } : {}),
  webpack: (config) => { if (process.env.CAPTURE_DISABLE_BUILD_CACHE === "1") config.cache = false; return config; },
  images: { unoptimized: true },
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  // The dev-tools badge would leak into reviewer/validator screenshots.
  devIndicators: false,
};
export default nextConfig;
