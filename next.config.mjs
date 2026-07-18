/** @type {import('next').NextConfig} */
const nextConfig = {
  // @resvg/resvg-js ships a native .node binary — don't let webpack try to
  // bundle/parse it, just require() it at runtime (used in src/app/api/og).
  experimental: {
    serverComponentsExternalPackages: ["@resvg/resvg-js"],
  },
};

export default nextConfig;
