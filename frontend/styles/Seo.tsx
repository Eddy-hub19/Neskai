import type { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "Neskai",
  description: "Ultra-futuristic collaborative reading platform",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Neskai",
  },
  formatDetection: {
    telephone: false,
  },
}
