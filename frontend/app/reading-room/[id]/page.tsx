"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel, User } from "@supabase/supabase-js"
import SharedReader from "@/app/components/SharedReader/SharedReader"
import { saveLastReadingSession } from "@/lib/readingSession"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"
import styles from "./readingRoom.module.scss"

interface Participant {
  user_id?: string
  user_name?: string
  presence_ref?: string
}

interface RoomBook {
  title: string
  file_url: string
}

interface HighlightPayload {
  id?: number
  cfiRange: string
  color: string
  fontWeight?: "normal" | "bold"
}

interface RemoteCursor {
  x: number
  y: number
  user: string
  isOwner: boolean
}

const USER_COLORS = {
  owner: "rgb(15, 227, 68)",
  guest: "rgb(6, 86, 183)",
}

const resolveBookUrl = (fileUrl: string) => {
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl
  }

  const normalizedPath = fileUrl.replace(/^book-files\//, "")
  const {
    data: { publicUrl },
  } = supabase.storage.from("book-files").getPublicUrl(normalizedPath)

  return publicUrl
}

export default function ReadingRoom() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const roomId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id])
  const bookId = searchParams.get("bookId")
  const numericBookId = useMemo(() => {
    const parsed = Number(bookId)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [bookId])
  const stableBookId = useMemo(() => {
    if (numericBookId) {
      return String(numericBookId)
    }

    return bookId
  }, [bookId, numericBookId])
  const ownerId = useMemo(() => roomId?.toString().replace(/^room-/, ""), [roomId])

  const [book, setBook] = useState<RoomBook | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [incomingCfi, setIncomingCfi] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<HighlightPayload[]>([])
  const [incomingHighlight, setIncomingHighlight] = useState<HighlightPayload | null>(null)
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursor | null>(null)
  const isOwner = Boolean(ownerId && currentUser?.id && ownerId === currentUser.id)
  const myHighlightColor = isOwner ? USER_COLORS.owner : USER_COLORS.guest

  const channelRef = useRef<RealtimeChannel | null>(null)
  const pendingAnnotationRef = useRef<Map<string, Promise<number | null>>>(new Map())

  const findHighlightByCfi = useCallback(
    (cfiRange: string) => highlights.find((item) => item.cfiRange === cfiRange) ?? null,
    [highlights],
  )

  const fetchAnnotationsFromApi = useCallback(
    async (cfiRange: string) => {
      if (!numericBookId) return [] as Array<{ id: number; cfi_range: string; color: string }>

      const params = new URLSearchParams({
        bookId: String(numericBookId),
        cfiRange,
      })

      const response = await fetch(`/api/annotations?${params.toString()}`, {
        method: "GET",
      })

      if (!response.ok) {
        return []
      }

      const payload = await response.json()
      return (payload?.annotations ?? []) as Array<{ id: number; cfi_range: string; color: string }>
    },
    [numericBookId],
  )

  const ensureAnnotation = useCallback(
    async (cfiRange: string, color: string) => {
      const existing = findHighlightByCfi(cfiRange)
      if (existing?.id) return existing.id

      const inFlight = pendingAnnotationRef.current.get(cfiRange)
      if (inFlight) {
        return inFlight
      }

      const promise = (async () => {
        if (!numericBookId) return null

        const found = await fetchAnnotationsFromApi(cfiRange)
        const foundAnnotation = found[0]

        if (foundAnnotation?.id) {
          setHighlights((prev) =>
            prev.map((item) =>
              item.cfiRange === cfiRange ? { ...item, id: foundAnnotation.id, color: item.color || foundAnnotation.color } : item,
            ),
          )

          return foundAnnotation.id
        }

        const response = await fetch("/api/annotations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookId: numericBookId,
            cfiRange,
            color,
          }),
        })

        if (!response.ok) {
          return null
        }

        const payload = await response.json()
        const annotation = payload?.annotation as { id?: number } | undefined

        if (!annotation?.id) {
          return null
        }

        setHighlights((prev) =>
          prev.map((item) => (item.cfiRange === cfiRange ? { ...item, id: annotation.id, color: item.color || color } : item)),
        )

        return annotation.id
      })()

      pendingAnnotationRef.current.set(cfiRange, promise)

      const result = await promise
      pendingAnnotationRef.current.delete(cfiRange)
      return result
    },
    [fetchAnnotationsFromApi, findHighlightByCfi, numericBookId],
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user))
  }, [])

  useEffect(() => {
    if (!numericBookId) return

    const fetchBook = async () => {
      const { data } = await supabase.from("books").select("title, file_url").eq("id", numericBookId).single()

      if (data?.file_url) {
        setBook(data)
      }
    }

    void fetchBook()
  }, [numericBookId])

  useEffect(() => {
    if (!numericBookId) return

    const fetchHighlights = async () => {
      const { data, error } = await supabase
        .from("annotations")
        .select("id, cfi_range, color")
        .eq("book_id", numericBookId)

      if (error) {
        console.error("Ошибка загрузки выделений:", error)
        return
      }

      const loadedHighlights = (data ?? []).map((item) => ({
        id: item.id,
        cfiRange: item.cfi_range,
        color: item.color || USER_COLORS.owner,
      })) as HighlightPayload[]

      setHighlights(loadedHighlights)
    }

    void fetchHighlights()
  }, [numericBookId])

  useEffect(() => {
    if (!currentUser || !roomId) return

    const channel = supabase.channel(roomId)
    channelRef.current = channel

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const flatParticipants = Object.values(state).flat() as unknown as Participant[]
        setParticipants(flatParticipants)
      })
      .on("broadcast", { event: "page-change" }, ({ payload }) => {
        const senderUserId = payload?.user_id as string | undefined
        const cfi = payload?.cfi as string | undefined

        if (!cfi) return
        if (senderUserId && senderUserId === currentUser.id) return

        setIncomingCfi(cfi)
      })
      .on("broadcast", { event: "new-highlight" }, ({ payload }) => {
        const senderUserId = payload?.user_id as string | undefined
        const cfiRange = payload?.cfiRange as string | undefined
        const color = (payload?.color as string | undefined) || USER_COLORS.owner
        const fontWeight = (payload?.fontWeight as "normal" | "bold" | undefined) || "normal"

        if (!cfiRange) return
        if (senderUserId && senderUserId === currentUser.id) return

        const nextHighlight = { cfiRange, color, fontWeight }
        setIncomingHighlight(nextHighlight)
        setHighlights((prev) => {
          if (prev.some((item) => item.cfiRange === cfiRange && item.color === color && item.fontWeight === fontWeight)) {
            return prev
          }
          return [...prev, nextHighlight]
        })
      })
      .on("broadcast", { event: "cursor-move" }, ({ payload }) => {
        const senderUserId = payload?.user_id as string | undefined
        if (senderUserId && senderUserId === currentUser.id) return

        const x = typeof payload?.x === "number" ? payload.x : 50
        const y = typeof payload?.y === "number" ? payload.y : 30
        const user = (payload?.user as string | undefined) || "Партнер"
        const ownerFlag = Boolean(payload?.isOwner)

        setRemoteCursor({ x, y, user, isOwner: ownerFlag })
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUser.id,
            user_name: currentUser.email,
          })
        }
      })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomId, currentUser])

  useEffect(() => {
    if (!book?.title || !roomId || !stableBookId) {
      return
    }

    const partners = Array.from(
      new Set(
        participants
          .map((participant) => participant.user_name)
          .filter((name): name is string => Boolean(name) && name !== currentUser?.email),
      ),
    )

    saveLastReadingSession({
      roomId,
      bookId: stableBookId,
      bookTitle: book.title,
      participants: partners,
      lastSeenAt: new Date().toISOString(),
    })
  }, [book?.title, roomId, stableBookId, participants, currentUser?.email])

  const handleLocationChange = useCallback(
    (cfi: string) => {
      const channel = channelRef.current
      if (!channel) return

      channel.send({
        type: "broadcast",
        event: "page-change",
        payload: {
          cfi,
          user_id: currentUser?.id,
        },
      })
    },
    [currentUser?.id],
  )

  const handleHighlightCreate = useCallback(
    async ({ cfiRange, color, fontWeight = "normal" }: HighlightPayload) => {
      if (!numericBookId || !currentUser?.id) return

      setHighlights((prev) => {
        const existing = prev.find((item) => item.cfiRange === cfiRange)
        if (existing && existing.color === color && existing.fontWeight === fontWeight) {
          return prev
        }

        if (existing) {
          return prev.map((item) => (item.cfiRange === cfiRange ? { ...item, color, fontWeight } : item))
        }

        return [...prev, { cfiRange, color, fontWeight }]
      })

      channelRef.current?.send({
        type: "broadcast",
        event: "new-highlight",
        payload: {
          cfiRange,
          color,
          fontWeight,
          user_id: currentUser.id,
        },
      })

      await ensureAnnotation(cfiRange, color)
    },
    [currentUser, ensureAnnotation, numericBookId],
  )

  const handleCursorMove = useCallback(
    ({ cfi, x, y }: { cfi: string | null; x: number; y: number }) => {
      const channel = channelRef.current
      if (!channel) return

      channel.send({
        type: "broadcast",
        event: "cursor-move",
        payload: {
          cfi,
          x,
          y,
          user: currentUser?.email || "Вы",
          isOwner,
          user_id: currentUser?.id,
        },
      })
    },
    [currentUser?.email, currentUser?.id, isOwner],
  )

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <DesktopTopActions backHref="/books" className={styles.navActions} />

        <Link href="/" className={styles.roomHomeLink}>
          <h1>Комната Neskai</h1>
        </Link>
        <span className={styles.ownerBadge}>{isOwner ? "Вы создатель" : "Гость"}</span>
        <div className={styles.users}>
          {participants.map((p, i) => (
            <div key={i} className={styles.userBadge}>
              {p.user_name || "Участник"}
            </div>
          ))}
        </div>
      </header>

      <div className={styles.readerArea}>
        {book ? (
          <div className={styles.readerShell}>
            <SharedReader
              key={book.file_url}
              bookUrl={resolveBookUrl(book.file_url)}
              bookTitle={book.title}
              showHeader={false}
              showInlineThemePicker
              myHighlightColor={myHighlightColor}
              incomingCfi={incomingCfi}
              onLocationChange={handleLocationChange}
              highlights={highlights}
              incomingHighlight={incomingHighlight}
              onHighlightCreate={handleHighlightCreate}
              remoteCursor={remoteCursor}
              onCursorMove={handleCursorMove}
            />
          </div>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.loadingPulse} />
            <div className={styles.loadingLine} />
            <div className={`${styles.loadingLine} ${styles.shortLine}`} />
          </div>
        )}
      </div>
    </div>
  )
}
