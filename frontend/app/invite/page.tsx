"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function InviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const encodedTarget = searchParams.get("t")

    if (!encodedTarget) {
      router.replace("/readers")
      return
    }

    try {
      const decodedPath = window.atob(encodedTarget)

      if (!decodedPath.startsWith("/reading-room/")) {
        router.replace("/readers")
        return
      }

      router.replace(decodedPath)
    } catch {
      router.replace("/readers")
    }
  }, [router, searchParams])

  return <div>Переходим по приглашению...</div>
}

export default function InvitePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#fff" }}>
      <Suspense fallback={<div>Загружаем...</div>}>
        <InviteContent />
      </Suspense>
    </main>
  )
}
