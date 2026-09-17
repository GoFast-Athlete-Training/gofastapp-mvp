/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/athlete-home',
        permanent: true,
      },
      {
        source: '/join/race/:slug',
        destination: '/commitment/race/:slug',
        permanent: true,
      },
      {
        source: '/join/race/:slug/signup',
        destination: '/commitment/race/:slug/signup',
        permanent: true,
      },
      {
        source: '/join/race/:slug/confirm',
        destination: '/commitment/race/:slug/confirm',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

