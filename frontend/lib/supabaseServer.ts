import { createServerClient, type CookieOptions } from "@supabase/ssr"
import type { NextResponse } from "next/server"

type CookieStore = {
  get(name: string): { value?: string } | undefined
  set(cookie: { name: string; value: string } & CookieOptions): void
  delete(cookie: { name: string } & Partial<CookieOptions>): void
}

export function createSupabaseServerClientForRequest(cookieStore: CookieStore, response?: NextResponse) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        // In Next.js, cookie writes are only allowed in Route Handlers/Server Actions.
        // We only persist mutations when a mutable NextResponse is provided.
        response?.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: CookieOptions) {
        response?.cookies.delete({ name, ...options })
      },
    },
  })
}