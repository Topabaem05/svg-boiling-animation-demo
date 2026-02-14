/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'
const nextConfig = {
  // Use separate distDirs for dev and prod to avoid artifact conflicts
  distDir: process.env.NEXT_DIST_DIR || (isProd ? '.next' : '.next-dev'),
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
