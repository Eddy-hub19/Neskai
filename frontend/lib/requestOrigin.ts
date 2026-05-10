import { headers } from "next/headers"

export async function getRequestOrigin(request: Request) {
  const configuredSiteUrl =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/$/, "")
  }

  const requestHeaders = await headers()
  const forwardedHost = requestHeaders.get("x-forwarded-host")
  const forwardedProto = requestHeaders.get("x-forwarded-proto")

  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`
  }

  return new URL(request.url).origin
}