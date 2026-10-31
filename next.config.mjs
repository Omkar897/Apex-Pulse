/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "mongodb-memory-server"],
  },
};

export default nextConfig;
