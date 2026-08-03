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
    ];
  },
};

export default nextConfig;

