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
    ],
  },
}

export default withPWA(nextConfig)
