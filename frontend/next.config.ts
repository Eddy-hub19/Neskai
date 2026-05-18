import withPWAInit from "@ducanh2912/next-pwa"
import type { NextConfig } from "next"

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
})

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },

      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "www.gutenberg.org",
        pathname: "/**",
      },
    ],
  },
}

export default withPWA(nextConfig)
