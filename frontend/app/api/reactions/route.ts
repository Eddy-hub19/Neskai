import { NextResponse } from "next/server"
import { getRouteSupabaseClient } from "@/lib/supabaseRouteAuth"

const isReactionType = (value: string): value is "sparkles" | "feather" | "heart" => {
  return value === "sparkles" || value === "feather" || value === "heart"
}

export async function POST(request: Request) {
  const { supabase, user, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized || !user) return unauthorized

  const body = await request.json().catch(() => null)
  const annotationId = body?.annotationId == null ? null : Number(body.annotationId)
  const messageId = typeof body?.messageId === "string" ? body.messageId : null
  const type = typeof body?.type === "string" ? body.type : ""

  if (!isReactionType(type)) {
    return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 })
  }

  const hasAnnotationTarget = Number.isInteger(annotationId) && Number(annotationId) > 0
  const hasMessageTarget = Boolean(messageId)

  if ((hasAnnotationTarget && hasMessageTarget) || (!hasAnnotationTarget && !hasMessageTarget)) {
    return NextResponse.json({ error: "Exactly one reaction target is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("reactions")
    .insert({
      annotation_id: hasAnnotationTarget ? annotationId : null,
      message_id: hasMessageTarget ? messageId : null,
      user_id: user.id,
      type,
    })
    .select("id, annotation_id, message_id, user_id, type, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reaction: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const { supabase, user, unauthorized } = await getRouteSupabaseClient()
  if (unauthorized || !user) return unauthorized

  const body = await request.json().catch(() => null)
  const reactionId = typeof body?.reactionId === "string" ? body.reactionId : ""

  if (!reactionId) {
    return NextResponse.json({ error: "reactionId is required" }, { status: 400 })
  }

  const { error } = await supabase.from("reactions").delete().eq("id", reactionId).eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
