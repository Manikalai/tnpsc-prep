/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // keep pages you just visited in memory for a short while, so going back and forth is instant
    staleTimes: { dynamic: 120, static: 300 },
  },
};
export default nextConfig;
