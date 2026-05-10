import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseServerClientForRequest } from "@/lib/supabaseServer"
import { getRequestOrigin } from "@/lib/requestOrigin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = await getRequestOrigin(request)
  const code = searchParams.get("code")
  const providerError = searchParams.get("error")
  const providerErrorDescription = searchParams.get("error_description")

  if (providerError) {
    const reason = providerErrorDescription ?? providerError
    return NextResponse.redirect(`${origin}/login?error=oauth-provider-error&reason=${encodeURIComponent(reason)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const response = NextResponse.redirect(`${origin}`)

    const supabase = createSupabaseServerClientForRequest(cookieStore, response)

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error("ОШИБКА SUPABASE:", error.message)
      return NextResponse.redirect(`${origin}/login?error=auth-failed&reason=${encodeURIComponent(error.message)}`)
    }

    return response
  }

  return NextResponse.redirect(`${origin}/login?error=no-code`)
}
