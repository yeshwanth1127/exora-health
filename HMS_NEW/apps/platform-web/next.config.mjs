/** @type {import('next').NextConfig} */
const staticExport = process.env.CAPTURE_STATIC_EXPORT === "1";
function serviceOrigin(value, name) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error(`Invalid ${name}`);
  return url.origin;
}
const nextConfig = {
  output: staticExport ? "export" : "standalone",
  htmlLimitedBots: /.*/,
  ...(staticExport ? {} : {
    async rewrites() {
      const control = serviceOrigin(process.env.CAPTURE_CONTROL_ORIGIN || 'http://127.0.0.1:3040', 'CAPTURE_CONTROL_ORIGIN');
      const lookup = serviceOrigin(process.env.CAPTURE_LOOKUP_ORIGIN || 'http://127.0.0.1:4500', 'CAPTURE_LOOKUP_ORIGIN');
      return [{source:'/control/:path*',destination:`${control}/control/:path*`},{source:'/business-lookup',destination:`${lookup}/business-lookup`}];
    },
  }),
  webpack: (config) => { if (process.env.CAPTURE_DISABLE_BUILD_CACHE === "1") config.cache = false; return config; },
  images: { unoptimized: true },
  ...(staticExport ? {} : { async headers() { return [{source:"/assets/optimized/:path*",headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]}]; } }),
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  devIndicators: false,
};
export default nextConfig;
