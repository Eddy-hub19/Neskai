export type LastReadingSession = {
  roomId: string
  bookId: string
  bookTitle: string
  participants: string[]
  lastSeenAt: string
}

const LAST_READING_SESSION_KEY = "neskai:last-reading-session"

export const readLastReadingSession = (): LastReadingSession | null => {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(LAST_READING_SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as LastReadingSession

    if (!parsed.roomId || !parsed.bookId || !parsed.bookTitle) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const saveLastReadingSession = (session: LastReadingSession) => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(LAST_READING_SESSION_KEY, JSON.stringify(session))
}

export const clearLastReadingSession = () => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(LAST_READING_SESSION_KEY)
}
