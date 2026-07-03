/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['technical.vfr.net.vn', 'vfr5.vfr.net.vn']
}

export default nextConfig
