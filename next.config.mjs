/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
 
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/budget", destination: "/money?tab=budget", permanent: false },
      { source: "/income", destination: "/money?tab=income", permanent: false },
      { source: "/investments", destination: "/money?tab=investments", permanent: false },
      { source: "/wishlist", destination: "/money?tab=wishlist", permanent: false },
      { source: "/life-areas", destination: "/domains", permanent: false },
      { source: "/life-areas/:id", destination: "/domains/:id", permanent: false },
    ]
  },
}

export default nextConfig
