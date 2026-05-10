import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSupabaseServerClientForRequest } from "@/lib/supabaseServer"

export async function getRouteSupabaseClient() {
  const cookieStore = await cookies()
  const response = NextResponse.next()
  const supabase = createSupabaseServerClientForRequest(cookieStore, response)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      supabase,
      user: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { supabase, user, unauthorized: null }
}
