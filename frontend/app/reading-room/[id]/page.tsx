"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SharedReader from "@/app/components/SharedReader/SharedReader"
import { saveLastReadingSession } from "@/lib/readingSession"
import type { AnnotationReaction, ReactionType, ThreadMessage } from "@/app/components/SharedReader/lib/types"
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

type PersistedThread = {
  id: string
  annotation_id: number
  annotation_cfi: string
}

type PersistedThreadMessage = {
  id: string
  annotation_thread_id: string
  user_id: string
  content: string
  created_at: string
}

type PersistedReaction = {
  id: string
  annotation_id: number
  user_id: string
  type: ReactionType
  created_at: string
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
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [incomingCfi, setIncomingCfi] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<HighlightPayload[]>([])
  const [incomingHighlight, setIncomingHighlight] = useState<HighlightPayload | null>(null)
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [annotationReactions, setAnnotationReactions] = useState<AnnotationReaction[]>([])
  const [remoteCursor, setRemoteCursor] = useState<RemoteCursor | null>(null)
  const isOwner = Boolean(ownerId && currentUser?.id && ownerId === currentUser.id)
  const myHighlightColor = isOwner ? USER_COLORS.owner : USER_COLORS.guest

  const channelRef = useRef<any>(null)
  const threadIdByCfiRef = useRef<Map<string, string>>(new Map())
  const pendingAnnotationRef = useRef<Map<string, Promise<number | null>>>(new Map())
  const pendingThreadRef = useRef<Map<string, Promise<string | null>>>(new Map())

  const upsertAnnotationReactions = useCallback((incoming: AnnotationReaction[]) => {
    if (incoming.length === 0) return

    setAnnotationReactions((prev) => {
      const byId = new Map<string, AnnotationReaction>()

      for (const reaction of prev) {
        byId.set(reaction.id, reaction)
      }

      for (const reaction of incoming) {
        byId.set(reaction.id, reaction)
      }

      return Array.from(byId.values()).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    })
  }, [])

  const upsertThreadMessages = useCallback((incoming: ThreadMessage[]) => {
    setThreadMessages((prev) => {
      const byId = new Map<string, ThreadMessage>()

      for (const message of prev) {
        byId.set(message.id, message)
      }

      for (const message of incoming) {
        byId.set(message.id, message)
      }

      return Array.from(byId.values()).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    })
  }, [])

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

  const ensureThread = useCallback(
    async (annotationId: number, cfiRange: string) => {
      const cachedThread = threadIdByCfiRef.current.get(cfiRange)
      if (cachedThread) {
        return cachedThread
      }

      const inFlight = pendingThreadRef.current.get(cfiRange)
      if (inFlight) {
        return inFlight
      }

      const promise = (async () => {
        if (!numericBookId) return null

        const listResponse = await fetch(`/api/annotations/${annotationId}/threads`, {
          method: "GET",
        })

        if (listResponse.ok) {
          const listPayload = await listResponse.json()
          const existingThreads = (listPayload?.threads ?? []) as PersistedThread[]
          const existing = existingThreads.find((thread) => thread.annotation_cfi === cfiRange) ?? existingThreads[0]

          if (existing?.id) {
            threadIdByCfiRef.current.set(cfiRange, existing.id)
            return existing.id
          }
        }

        const createResponse = await fetch(`/api/annotations/${annotationId}/threads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cfiRange,
            bookId: numericBookId,
          }),
        })

        if (!createResponse.ok) {
          return null
        }

        const createPayload = await createResponse.json()
        const createdThread = createPayload?.thread as PersistedThread | undefined
        if (!createdThread?.id) {
          return null
        }

        threadIdByCfiRef.current.set(cfiRange, createdThread.id)
        return createdThread.id
      })()

      pendingThreadRef.current.set(cfiRange, promise)

      const result = await promise
      pendingThreadRef.current.delete(cfiRange)
      return result
    },
    [numericBookId],
  )

  const loadThreadMessages = useCallback(
    async (threadId: string, cfiRange: string) => {
      const response = await fetch(`/api/threads/${threadId}/messages?limit=80`, {
        method: "GET",
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json()
      const persisted = (payload?.messages ?? []) as PersistedThreadMessage[]

      const mapped = persisted.map((item) => ({
        id: item.id,
        annotationCfi: cfiRange,
        userName: item.user_id === currentUser?.id ? currentUser?.email || "Вы" : "Партнер",
        content: item.content,
        createdAt: item.created_at,
      }))

      upsertThreadMessages(mapped)
    },
    [currentUser?.email, currentUser?.id, upsertThreadMessages],
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

    fetchBook()
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

    fetchHighlights()
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
      .on("broadcast", { event: "thread-message" }, ({ payload }) => {
        const senderUserId = payload?.user_id as string | undefined
        if (senderUserId && senderUserId === currentUser.id) return

        const cfiRange = payload?.cfiRange as string | undefined
        const content = payload?.content as string | undefined

        if (!cfiRange || !content) return

        const nextMessage: ThreadMessage = {
          id: String(payload?.id ?? `${Date.now()}`),
          annotationCfi: cfiRange,
          userName: (payload?.user_name as string | undefined) || "Партнер",
          content,
          createdAt: (payload?.createdAt as string | undefined) || new Date().toISOString(),
        }

        upsertThreadMessages([nextMessage])
      })
      .on("broadcast", { event: "thread-reaction" }, ({ payload }) => {
        const senderUserId = payload?.user_id as string | undefined
        if (senderUserId && senderUserId === currentUser.id) return

        const reactionId = payload?.id as string | undefined
        const cfiRange = payload?.cfiRange as string | undefined
        const annotationIdRaw = payload?.annotationId
        const annotationId = typeof annotationIdRaw === "number" ? annotationIdRaw : Number(annotationIdRaw)
        const reaction = payload?.reaction as ReactionType | undefined
        const createdAt = (payload?.createdAt as string | undefined) || new Date().toISOString()

        if (!reactionId || !cfiRange || !Number.isFinite(annotationId) || !reaction) return

        upsertAnnotationReactions([
          {
            id: reactionId,
            annotationId,
            cfiRange,
            type: reaction,
            createdAt,
            userId: senderUserId,
          },
        ])
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
  }, [roomId, currentUser, upsertAnnotationReactions, upsertThreadMessages])

  useEffect(() => {
    const annotationMap = new Map<number, string>()

    for (const item of highlights) {
      if (item.id) {
        annotationMap.set(item.id, item.cfiRange)
      }
    }

    const annotationIds = Array.from(annotationMap.keys())
    if (annotationIds.length === 0) {
      setAnnotationReactions([])
      return
    }

    const fetchReactions = async () => {
      const { data, error } = await supabase
        .from("reactions")
        .select("id, annotation_id, user_id, type, created_at")
        .in("annotation_id", annotationIds)
        .is("message_id", null)

      if (error) {
        console.error("Ошибка загрузки реакций:", error)
        return
      }

      const mapped = ((data ?? []) as PersistedReaction[]).reduce<AnnotationReaction[]>((acc, item) => {
        const cfiRange = annotationMap.get(item.annotation_id)
        if (!cfiRange) return acc

        acc.push({
          id: item.id,
          annotationId: item.annotation_id,
          cfiRange,
          type: item.type,
          createdAt: item.created_at,
          userId: item.user_id,
        })

        return acc
      }, [])

      setAnnotationReactions(mapped)
    }

    fetchReactions()
  }, [highlights])

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

  const handleLocationChange = useCallback((cfi: string) => {
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
  }, [currentUser?.id])

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

  const handleThreadMessageCreate = useCallback(
    async ({ cfiRange, content }: { cfiRange: string; content: string }) => {
      if (!currentUser?.id) return
      if (!numericBookId) return

      const annotationId = await ensureAnnotation(cfiRange, myHighlightColor)
      if (!annotationId) {
        return
      }

      const threadId = await ensureThread(annotationId, cfiRange)
      if (!threadId) {
        return
      }

      const response = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json()
      const persisted = payload?.message as PersistedThreadMessage | undefined
      if (!persisted?.id) {
        return
      }

      const nextMessage: ThreadMessage = {
        id: persisted.id,
        annotationCfi: cfiRange,
        userName: currentUser.email || "Вы",
        content: persisted.content,
        createdAt: persisted.created_at,
      }

      upsertThreadMessages([nextMessage])

      channelRef.current?.send({
        type: "broadcast",
        event: "thread-message",
        payload: {
          ...nextMessage,
          cfiRange,
          threadId,
          user_id: currentUser.id,
          user_name: currentUser.email,
        },
      })
    },
    [currentUser, ensureAnnotation, ensureThread, myHighlightColor, numericBookId, upsertThreadMessages],
  )

  const handleQuickReaction = useCallback(
    async ({ cfiRange, reaction }: { cfiRange: string; reaction: ReactionType }) => {
      if (!currentUser?.id) return

      const annotationId = await ensureAnnotation(cfiRange, myHighlightColor)
      if (!annotationId) {
        return
      }

      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          annotationId,
          type: reaction,
        }),
      })

      if (!response.ok) {
        return
      }

      const payload = await response.json()
      const persisted = payload?.reaction as PersistedReaction | undefined

      if (!persisted?.id || !Number.isFinite(persisted.annotation_id)) {
        return
      }

      const nextReaction: AnnotationReaction = {
        id: persisted.id,
        annotationId: persisted.annotation_id,
        cfiRange,
        type: persisted.type,
        createdAt: persisted.created_at,
        userId: persisted.user_id,
      }

      upsertAnnotationReactions([nextReaction])

      channelRef.current?.send({
        type: "broadcast",
        event: "thread-reaction",
        payload: {
          id: nextReaction.id,
          annotationId: nextReaction.annotationId,
          cfiRange,
          reaction,
          user_id: currentUser.id,
          user_name: currentUser.email,
          createdAt: nextReaction.createdAt,
        },
      })
    },
    [currentUser, ensureAnnotation, myHighlightColor, upsertAnnotationReactions],
  )

  const handleThreadOpen = useCallback(
    async (cfiRange: string) => {
      if (!numericBookId) return

      const annotationId = await ensureAnnotation(cfiRange, myHighlightColor)
      if (!annotationId) return

      const threadId = await ensureThread(annotationId, cfiRange)
      if (!threadId) return

      await loadThreadMessages(threadId, cfiRange)
    },
    [ensureAnnotation, ensureThread, loadThreadMessages, myHighlightColor, numericBookId],
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

      <main className={styles.readerArea}>
        {book ? (
          <div className={styles.readerShell}>
            <SharedReader
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
              threadMessages={threadMessages}
              onThreadOpen={handleThreadOpen}
              onThreadMessageCreate={handleThreadMessageCreate}
              onQuickReaction={handleQuickReaction}
              annotationReactions={annotationReactions}
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
      </main>
    </div>
  )
}
