import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getRequestOrigin } from "@/lib/requestOrigin"

export async function GET(request: Request) {
  const origin = await getRequestOrigin(request)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.json({ error: "Supabase env vars are not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      flowType: "pkce",
    },
  })

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data?.url) {
    console.error("OAuth start failed:", error?.message)
    return NextResponse.redirect(`${origin}/login?error=oauth-start-failed`)
  }

  return NextResponse.redirect(data.url)
}