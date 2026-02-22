/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  // So static generation doesn't throw "Invalid URL" when NEXTAUTH_URL is unset (e.g. Vercel build)
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://placeholder.vercel.app',
  },
  // Reduce EMFILE (too many open files) in dev: use polling instead of native watchers
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ...config.watchOptions, poll: 1000 };
    }
    return config;
  },
};

module.exports = nextConfig;
