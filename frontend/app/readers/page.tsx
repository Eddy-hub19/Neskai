"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getSupabaseGoogleAvatar } from "@/lib/authAvatar"
import { clearLastReadingSession, readLastReadingSession, type LastReadingSession } from "@/lib/readingSession"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"
import styles from "./readers.module.scss"

interface Book {
  id: number
  title: string
}

const useOnlineUsers = (roomName = "global-library") => {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

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
        const users = Object.values(newState).flat()
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
  const [activeSession, setActiveSession] = useState<LastReadingSession | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string>("")
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle")

  const [incomingInvite, setIncomingInvite] = useState<{ from: string; roomId: string; bookId: string } | null>(null)

  useEffect(() => {
    setActiveSession(readLastReadingSession())
  }, [])

  useEffect(() => {
    if (!currentUser) return

    const listenChannel = supabase.channel(`invite-${currentUser.id}`)

    listenChannel
      .on("broadcast", { event: "incoming_invite" }, ({ payload }) => {
        setIncomingInvite({
          from: payload.from,
          roomId: payload.roomId,
          bookId: payload.bookId,
        })
      })
      .subscribe()

    return () => {
      listenChannel.unsubscribe()
    }
  }, [currentUser])

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

  const handleInvite = (targetUser: any) => {
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
    if (!selectedBookId || !currentUser?.id || typeof window === "undefined") {
      return null
    }

    const personalRoomId = `room-${currentUser.id}`
    const targetPath = `/reading-room/${personalRoomId}?bookId=${selectedBookId}`
    const encodedTarget = window.btoa(targetPath)

    return `${window.location.origin}/invite?t=${encodeURIComponent(encodedTarget)}`
  }

  const handleCopyInviteLink = async () => {
    const inviteUrl = buildInviteUrl()

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
    <main className={styles.container}>
      <DesktopTopActions backHref="/books" className={styles.desktopActions} />
      <h1 className={styles.title}>Читаем Вместе</h1>

      <div className={styles.readersList}>
        <h2 className={styles.subtitle}>Кто Онлайн</h2>

        {activeSession && (
          <div className={styles.activeReadingCard}>
            <button
              type="button"
              className={styles.dismissSessionBtn}
              aria-label="Скрыть активную сессию"
              onClick={() => {
                clearLastReadingSession()
                setActiveSession(null)
              }}
            >
              ✕
            </button>

            <p className={styles.activeReadingTitle}>Сейчас активна книга</p>
            <p className={styles.activeReadingBook}>{activeSession.bookTitle}</p>
            {activeSession.participants.length > 0 && (
              <p className={styles.activeReadingMeta}>Читаете с: {activeSession.participants.join(", ")}</p>
            )}
            <button
              className={styles.resumeBtn}
              onClick={() => router.push(`/reading-room/${activeSession.roomId}?bookId=${activeSession.bookId}`)}
            >
              Вернуться к чтению
            </button>
          </div>
        )}

        <div>
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
              disabled={!selectedBookId || !currentUser?.id}
            >
              Скопировать ссылку для друга
            </button>
            {copyState === "success" && <p className={styles.copyStatus}>Ссылка скопирована</p>}
            {copyState === "error" && <p className={styles.copyStatus}>Не удалось скопировать ссылку</p>}
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
    </main>
  )
}
