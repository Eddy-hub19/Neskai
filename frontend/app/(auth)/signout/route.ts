import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseServerClientForRequest } from "@/lib/supabaseServer"
import { getRequestOrigin } from "@/lib/requestOrigin"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const origin = await getRequestOrigin(request)
  const response = NextResponse.redirect(new URL("/", origin), {
    status: 302,
  })

  const supabase = createSupabaseServerClientForRequest(cookieStore, response)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.auth.signOut()
  }

  return response
}
