/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/contracts", "@repo/api"],
};

export default nextConfig;
