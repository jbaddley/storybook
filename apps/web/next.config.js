/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  // Reduce EMFILE (too many open files) in dev: use polling instead of native watchers
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = { ...config.watchOptions, poll: 1000 };
    }
    return config;
  },
};

module.exports = nextConfig;
