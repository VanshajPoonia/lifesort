/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },

  eslint: {
    // Left on: 187 pre-existing findings (mostly React-Compiler-readiness
    // hook rules) aren't cleared yet -- see AI_TASK_LOG.md / AI_CHECKLIST.md.
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
