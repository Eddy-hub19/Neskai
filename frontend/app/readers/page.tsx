"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { getSupabaseGoogleAvatar } from "@/lib/authAvatar"
import { clearReadingSession, readActiveReadingSessions, type LastReadingSession } from "@/lib/readingSession"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"
import styles from "@/app/readers/readers.module.scss"

interface Book {
  id: number
  title: string
}

interface PresenceUser {
  user_id: string
  user_name: string
  avatar_url?: string | null
  google_avatar_url?: string | null
  online_at?: string
}

type InvitePayload = {
  from?: string
  roomId?: string
  bookId?: string
}

type InviteOpenAckPayload = {
  ownerId?: string
  roomId?: string
  bookId?: string
  inviteToken?: string
}

const createShortInviteToken = () => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  return Math.random().toString(36).slice(2, 14)
}

const toPresenceUser = (value: unknown): PresenceUser | null => {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const userId = typeof source.user_id === "string" ? source.user_id : null
  const userName = typeof source.user_name === "string" ? source.user_name : null

  if (!userId || !userName) {
    return null
  }

  return {
    user_id: userId,
    user_name: userName,
    avatar_url: typeof source.avatar_url === "string" ? source.avatar_url : null,
    google_avatar_url: typeof source.google_avatar_url === "string" ? source.google_avatar_url : null,
    online_at: typeof source.online_at === "string" ? source.online_at : undefined,
  }
}

const useOnlineUsers = (roomName = "global-library") => {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
    })
  }, [])

  useEffect(() => {
    if (!currentUser) return

    const channel = supabase.channel(roomName)

    channel
      .on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState()
        const users = Object.values(newState)
          .flatMap((entries) => entries ?? [])
          .map((entry) => toPresenceUser(entry))
          .filter((entry): entry is PresenceUser => Boolean(entry))
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const googleAvatar = getSupabaseGoogleAvatar(currentUser)

          await channel.track({
            user_id: currentUser.id,
            user_name: currentUser.email,
            avatar_url: googleAvatar,
            google_avatar_url: googleAvatar,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [roomName, currentUser])

  return { onlineUsers, currentUser }
}

export default function ReadersPage() {
  const router = useRouter()
  const { onlineUsers, currentUser } = useOnlineUsers()
  const [activeSessions, setActiveSessions] = useState<LastReadingSession[]>(() => readActiveReadingSessions())
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string>("")
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle")
  const [inviteToken, setInviteToken] = useState<string>("")
  const [isInviteOpenedByPartner, setIsInviteOpenedByPartner] = useState(false)

  const [incomingInvite, setIncomingInvite] = useState<{ from: string; roomId: string; bookId: string } | null>(null)

  useEffect(() => {
    if (!selectedBookId || !currentUser?.id) {
      setInviteToken("")
      setIsInviteOpenedByPartner(false)
      return
    }

    const nextToken = createShortInviteToken()

    setInviteToken(nextToken)
    setIsInviteOpenedByPartner(false)
  }, [selectedBookId, currentUser?.id])

  useEffect(() => {
    if (!currentUser) return

    const listenChannel = supabase.channel(`invite-${currentUser.id}`)

    listenChannel
      .on("broadcast", { event: "incoming_invite" }, ({ payload }) => {
        const invitePayload = (payload ?? {}) as InvitePayload
        if (!invitePayload.from || !invitePayload.roomId || !invitePayload.bookId) {
          return
        }

        setIncomingInvite({
          from: invitePayload.from,
          roomId: invitePayload.roomId,
          bookId: invitePayload.bookId,
        })
      })
      .subscribe()

    return () => {
      listenChannel.unsubscribe()
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return

    const ackChannel = supabase.channel(`invite-ack-${currentUser.id}`)

    ackChannel
      .on("broadcast", { event: "invite_link_opened" }, ({ payload }) => {
        const ackPayload = (payload ?? {}) as InviteOpenAckPayload
        const ackRoomId = ackPayload.roomId
        const ackBookId = ackPayload.bookId
        const ackToken = ackPayload.inviteToken
        const personalRoomId = `room-${currentUser.id}`

        const matchesCurrentRoom = ackRoomId === personalRoomId
        const matchesCurrentBook = ackBookId === selectedBookId
        const matchesToken = inviteToken ? ackToken === inviteToken : false

        if ((matchesCurrentRoom && matchesCurrentBook) || matchesToken) {
          setIsInviteOpenedByPartner(true)
        }
      })
      .subscribe()

    return () => {
      ackChannel.unsubscribe()
    }
  }, [currentUser, selectedBookId, inviteToken])

  useEffect(() => {
    const fetchBooks = async () => {
      const { data, error } = await supabase.from("books").select("id, title").order("id", { ascending: false })

      if (error) {
        console.error("Ошибка загрузки книг:", error)
        return
      }

      const loadedBooks = (data ?? []) as Book[]
      setBooks(loadedBooks)

      if (loadedBooks.length > 0) {
        setSelectedBookId(String(loadedBooks[0].id))
      }
    }

    fetchBooks()
  }, [])

  const handleInvite = (targetUser: PresenceUser) => {
    if (!selectedBookId) {
      return
    }

    const personalRoomId = `room-${currentUser?.id}`
    const inviteChannel = supabase.channel(`invite-${targetUser.user_id}`)

    inviteChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        inviteChannel
          .send({
            type: "broadcast",
            event: "incoming_invite",
            payload: {
              from: currentUser?.email,
              roomId: personalRoomId,
              bookId: selectedBookId,
              timestamp: new Date().toISOString(),
            },
          })
          .then(() => {
            setSentInvites((prev) => new Set(prev).add(targetUser.user_id))
            inviteChannel.unsubscribe()
            router.push(`/reading-room/${personalRoomId}?bookId=${selectedBookId}`)
          })
      }
    })
  }

  const buildInviteUrl = () => {
    if (!selectedBookId || !currentUser?.id || !inviteToken || typeof window === "undefined") {
      return null
    }

    const personalRoomId = `room-${currentUser.id}`
    const params = new URLSearchParams({
      r: personalRoomId,
      b: selectedBookId,
      i: inviteToken,
    })

    return `${window.location.origin}/invite?${params.toString()}`
  }

  const inviteUrl = buildInviteUrl()

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopyState("success")
      window.setTimeout(() => setCopyState("idle"), 1800)
    } catch {
      setCopyState("error")
      window.setTimeout(() => setCopyState("idle"), 2200)
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Читаем Вместе</h1>

      <div className={styles.readersList}>
        <h2 className={styles.subtitle}>Кто Онлайн</h2>

        {activeSessions.length > 0 && (
          <div className={styles.activeSessionsList}>
            {activeSessions.map((session) => {
              const partnersText = session.participants.length > 0 ? session.participants.join(", ") : "Без напарника"

              return (
                <div key={`${session.roomId}:${session.bookId}`} className={styles.activeReadingCard}>
                  <button
                    type="button"
                    className={styles.dismissSessionBtn}
                    aria-label="Скрыть активную сессию"
                    onClick={() => {
                      clearReadingSession({ roomId: session.roomId, bookId: session.bookId })
                      setActiveSessions((prev) =>
                        prev.filter((item) => !(item.roomId === session.roomId && item.bookId === session.bookId)),
                      )
                    }}
                  >
                    ✕
                  </button>

                  <p className={styles.activeReadingTitle}>Активная книга</p>
                  <p className={styles.activeReadingBook}>{session.bookTitle}</p>
                  <p className={styles.activeReadingMeta}>Читал(а) с: {partnersText}</p>
                  <button
                    className={styles.resumeBtn}
                    onClick={() => router.push(`/reading-room/${session.roomId}?bookId=${session.bookId}`)}
                  >
                    Вернуться к чтению
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div>
          <DesktopTopActions backHref="/books" className={styles.desktopActions} />
          <label htmlFor="book-select">Книга для приглашения: </label>
          <select
            id="book-select"
            value={selectedBookId}
            className={`${styles.customSelect}`}
            onChange={(e) => setSelectedBookId(e.target.value)}
            disabled={books.length === 0}
          >
            {books.length === 0 ? (
              <option value="">Нет доступных книг</option>
            ) : (
              books.map((book) => (
                <option key={book.id} value={String(book.id)}>
                  {book.title}
                </option>
              ))
            )}
          </select>

          <div className={styles.inviteLinkActions}>
            <button
              type="button"
              className={styles.copyLinkBtn}
              onClick={() => void handleCopyInviteLink()}
              disabled={!selectedBookId || !currentUser?.id || !inviteToken}
            >
              Скопировать ссылку для друга
            </button>
            {copyState === "success" && <p className={styles.copyStatus}>Ссылка скопирована</p>}
            {copyState === "error" && <p className={styles.copyStatus}>Не удалось скопировать ссылку</p>}
            {isInviteOpenedByPartner && inviteUrl && (
              <p className={styles.inviteMaskedLine}>
                Напарник открыл ссылку:{" "}
                <a className={styles.inviteMaskedLink} href={inviteUrl}>
                  invite
                </a>
              </p>
            )}
          </div>
        </div>

        {incomingInvite && (
          <div className={styles.inviteNotification}>
            <p>{incomingInvite.from} приглашает вас в комнату чтения</p>
            <button
              className={styles.acceptBtn}
              onClick={() => router.push(`/reading-room/${incomingInvite.roomId}?bookId=${incomingInvite.bookId}`)}
            >
              Принять и войти
            </button>
          </div>
        )}

        {onlineUsers.length > 0 ? (
          <ul className={styles.list}>
            {onlineUsers.map((user, index) => (
              <li key={index} className={styles.userItem}>
                <div className={styles.userInfo}>
                  <span className={styles.statusDot} />
                  <span className={styles.userName}>{user.user_name}</span>
                </div>

                {user.user_id !== currentUser?.id && (
                  <button
                    onClick={() => handleInvite(user)}
                    className={styles.inviteBtn}
                    disabled={sentInvites.has(user.user_id) || !selectedBookId}
                  >
                    {sentInvites.has(user.user_id) ? "Приглашение отправлено" : "Пригласить читать"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Сейчас никто не онлайн</p>
        )}
      </div>
    </div>
  )
}
