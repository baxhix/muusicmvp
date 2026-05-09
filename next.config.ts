import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces .next/standalone for the production Docker image.
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
        port: '',
        pathname: '/image/**',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com',
      },
    ],
  },
};

export default nextConfig;
