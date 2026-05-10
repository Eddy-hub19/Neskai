import { NextResponse } from "next/server"
import { getRouteSupabaseClient } from "@/lib/supabaseRouteAuth"

export async function GET(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { supabase, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized) return unauthorized

  const params = await context.params
  const threadId = params.threadId
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 30), 1), 100)

  if (!threadId) {
    return NextResponse.json({ error: "Invalid thread id" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("thread_messages")
    .select("id, annotation_thread_id, user_id, content, created_at")
    .eq("annotation_thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const { supabase, user, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized || !user) return unauthorized

  const params = await context.params
  const threadId = params.threadId
  const body = await request.json().catch(() => null)

  const content = typeof body?.content === "string" ? body.content.trim() : ""

  if (!threadId || !content) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("thread_messages")
    .insert({
      annotation_thread_id: threadId,
      user_id: user.id,
      content,
    })
    .select("id, annotation_thread_id, user_id, content, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data }, { status: 201 })
}
