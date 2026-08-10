/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We can add remote patterns for image optimization if needed later
  experimental: {
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
