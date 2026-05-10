import { NextResponse } from "next/server"
import { getRouteSupabaseClient } from "@/lib/supabaseRouteAuth"

export async function GET(request: Request) {
  const { supabase, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const bookId = Number(searchParams.get("bookId"))
  const cfiRange = searchParams.get("cfiRange")?.trim()

  let query = supabase.from("annotations").select("id, book_id, cfi_range, color, user_id")

  if (Number.isInteger(bookId) && bookId > 0) {
    query = query.eq("book_id", bookId)
  }

  if (cfiRange) {
    query = query.eq("cfi_range", cfiRange)
  }

  const { data, error } = await query.order("id", { ascending: false }).limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ annotations: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized || !user) return unauthorized

  const body = await request.json().catch(() => null)
  const bookId = Number(body?.bookId)
  const cfiRange = typeof body?.cfiRange === "string" ? body.cfiRange.trim() : ""
  const color = typeof body?.color === "string" ? body.color : "rgba(240, 196, 21, 0.97)"

  if (!Number.isInteger(bookId) || bookId <= 0 || !cfiRange) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("annotations")
    .insert({
      book_id: bookId,
      cfi_range: cfiRange,
      color,
      user_id: user.id,
    })
    .select("id, book_id, cfi_range, color, user_id")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ annotation: data }, { status: 201 })
}
