import "@/styles/globals.scss"
export { metadata, viewport } from "@/styles/Seo"
import MobileTabBar from "@/app/components/MobileTabBar/MobileTabBar"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
        <MobileTabBar />
      </body>
    </html>
  )
}
