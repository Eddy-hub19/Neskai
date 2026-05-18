"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

type InvitePayload = {
  roomId: string
  bookId: string
  inviteToken: string
  ownerId: string
  targetPath: string
}

const isStandaloneDisplayMode = () => {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true
}

const buildProtocolInviteUrl = (payload: Pick<InvitePayload, "roomId" | "bookId" | "inviteToken">) => {
  const params = new URLSearchParams({
    r: payload.roomId,
    b: payload.bookId,
    i: payload.inviteToken,
  })

  return `web+neskai://invite?${params.toString()}`
}

const tryOpenInstalledPwa = async (payload: Pick<InvitePayload, "roomId" | "bookId" | "inviteToken">) => {
  if (isStandaloneDisplayMode()) return false

  const protocolUrl = buildProtocolInviteUrl(payload)

  return await new Promise<boolean>((resolve) => {
    let settled = false

    const finish = (opened: boolean) => {
      if (settled) return
      settled = true

      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onPageHide)
      window.clearTimeout(timeoutId)
      resolve(opened)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        finish(true)
      }
    }

    const onPageHide = () => {
      finish(true)
    }

    const timeoutId = window.setTimeout(() => {
      finish(false)
    }, 900)

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onPageHide)

    window.location.href = protocolUrl
  })
}

const parseInvitePayload = (searchParams: URLSearchParams): InvitePayload | null => {
  const roomIdShort = searchParams.get("r")
  const bookIdShort = searchParams.get("b")
  const inviteTokenShort = searchParams.get("i")

  if (roomIdShort && bookIdShort && inviteTokenShort) {
    const ownerIdFromRoom = roomIdShort.replace(/^room-/, "")
    return {
      roomId: roomIdShort,
      bookId: bookIdShort,
      inviteToken: inviteTokenShort,
      ownerId: ownerIdFromRoom,
      targetPath: `/reading-room/${roomIdShort}?bookId=${encodeURIComponent(bookIdShort)}&ownerId=${encodeURIComponent(ownerIdFromRoom)}&inviteToken=${encodeURIComponent(inviteTokenShort)}`,
    }
  }

  const protocolHandlerUrl = searchParams.get("ph")
  if (protocolHandlerUrl) {
    try {
      const parsed = new URL(protocolHandlerUrl)
      const roomId = parsed.searchParams.get("r")
      const bookId = parsed.searchParams.get("b")
      const inviteToken = parsed.searchParams.get("i")

      if (roomId && bookId && inviteToken) {
        const ownerIdFromRoom = roomId.replace(/^room-/, "")
        return {
          roomId,
          bookId,
          inviteToken,
          ownerId: ownerIdFromRoom,
          targetPath: `/reading-room/${roomId}?bookId=${encodeURIComponent(bookId)}&ownerId=${encodeURIComponent(ownerIdFromRoom)}&inviteToken=${encodeURIComponent(inviteToken)}`,
        }
      }
    } catch {
    }
  }

  const encodedTarget = searchParams.get("t")
  if (!encodedTarget) return null

  try {
    const decodedPath = window.atob(encodedTarget)

    if (!decodedPath.startsWith("/reading-room/")) return null

    const parsed = new URL(decodedPath, window.location.origin)
    const ownerId = parsed.searchParams.get("ownerId")
    const bookId = parsed.searchParams.get("bookId")
    const inviteToken = parsed.searchParams.get("inviteToken")
    const roomId = parsed.pathname.split("/").filter(Boolean).at(-1)

    if (!ownerId || !bookId || !inviteToken || !roomId) return null

    return {
      roomId,
      bookId,
      inviteToken,
      ownerId,
      targetPath: decodedPath,
    }
  } catch {
    return null
  }
}

const notifyInviteOpened = async ({
  ownerId,
  roomId,
  bookId,
  inviteToken,
}: {
  ownerId: string
  roomId: string
  bookId: string
  inviteToken: string
}) => {
  const channel = supabase.channel(`invite-ack-${ownerId}`)

  await new Promise<void>((resolve) => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      resolve()
    }

    const timeoutId = window.setTimeout(() => {
      channel.unsubscribe()
      finish()
    }, 1200)

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return

      channel
        .send({
          type: "broadcast",
          event: "invite_link_opened",
          payload: {
            ownerId,
            roomId,
            bookId,
            inviteToken,
            openedAt: new Date().toISOString(),
          },
        })
        .finally(() => {
          window.clearTimeout(timeoutId)
          channel.unsubscribe()
          finish()
        })
    })
  })
}

function InviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    void (async () => {
      const payload = parseInvitePayload(searchParams)
      if (!payload) {
        router.replace("/readers")
        return
      }

      const openedStandaloneApp = await tryOpenInstalledPwa(payload)
      if (openedStandaloneApp) {
        return
      }

      await notifyInviteOpened({
        ownerId: payload.ownerId,
        roomId: payload.roomId,
        bookId: payload.bookId,
        inviteToken: payload.inviteToken,
      })

      router.replace(payload.targetPath)
    })()
  }, [router, searchParams])

  return <div>Переходим по приглашению...</div>
}

export default function InvitePage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#fff" }}>
      <Suspense fallback={<div>Загружаем...</div>}>
        <InviteContent />
      </Suspense>
    </div>
  )
}
