import { NextResponse } from "next/server"
import { getRouteSupabaseClient } from "@/lib/supabaseRouteAuth"

export async function GET(_request: Request, context: { params: Promise<{ annotationId: string }> }) {
  const { supabase, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized) return unauthorized

  const params = await context.params
  const annotationId = Number(params.annotationId)

  if (!Number.isInteger(annotationId) || annotationId <= 0) {
    return NextResponse.json({ error: "Invalid annotation id" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("annotation_threads")
    .select("id, annotation_id, annotation_cfi, book_id, creator_id, created_at")
    .eq("annotation_id", annotationId)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ threads: data ?? [] })
}

export async function POST(request: Request, context: { params: Promise<{ annotationId: string }> }) {
  const { supabase, user, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized || !user) return unauthorized

  const params = await context.params
  const annotationId = Number(params.annotationId)
  const body = await request.json().catch(() => null)

  const annotationCfi = typeof body?.cfiRange === "string" ? body.cfiRange.trim() : ""
  const bookId = Number(body?.bookId)

  if (!Number.isInteger(annotationId) || annotationId <= 0 || !annotationCfi || !Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("annotation_threads")
    .insert({
      annotation_id: annotationId,
      annotation_cfi: annotationCfi,
      book_id: bookId,
      creator_id: user.id,
    })
    .select("id, annotation_id, annotation_cfi, book_id, creator_id, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ thread: data }, { status: 201 })
}
