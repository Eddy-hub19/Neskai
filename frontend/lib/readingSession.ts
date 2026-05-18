export type LastReadingSession = {
  roomId: string
  bookId: string
  bookTitle: string
  participants: string[]
  lastSeenAt: string
}

const LAST_READING_SESSION_KEY = "neskai:last-reading-session"

const isValidSession = (value: unknown): value is LastReadingSession => {
  if (!value || typeof value !== "object") {
    return false
  }

  const source = value as Record<string, unknown>

  return (
    typeof source.roomId === "string" &&
    source.roomId.length > 0 &&
    typeof source.bookId === "string" &&
    source.bookId.length > 0 &&
    typeof source.bookTitle === "string" &&
    source.bookTitle.length > 0 &&
    Array.isArray(source.participants) &&
    typeof source.lastSeenAt === "string" &&
    source.lastSeenAt.length > 0
  )
}

const sortByRecent = (sessions: LastReadingSession[]) =>
  [...sessions].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))

const readRawSessions = (): LastReadingSession[] => {
  if (typeof window === "undefined") {
    return []
  }

  const raw = window.localStorage.getItem(LAST_READING_SESSION_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown

    if (Array.isArray(parsed)) {
      return sortByRecent(parsed.filter((item) => isValidSession(item)))
    }

    if (isValidSession(parsed)) {
      return [parsed]
    }

    return []
  } catch {
    return []
  }
}

const writeSessions = (sessions: LastReadingSession[]) => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(LAST_READING_SESSION_KEY, JSON.stringify(sortByRecent(sessions)))
}

export const readActiveReadingSessions = (): LastReadingSession[] => readRawSessions()

export const readLastReadingSession = (): LastReadingSession | null => {
  return readRawSessions()[0] ?? null
}

export const saveLastReadingSession = (session: LastReadingSession) => {
  const existing = readRawSessions()
  const withoutCurrent = existing.filter((item) => !(item.roomId === session.roomId && item.bookId === session.bookId))
  writeSessions([session, ...withoutCurrent])
}

export const clearReadingSession = ({ roomId, bookId }: { roomId: string; bookId: string }) => {
  const existing = readRawSessions()
  const next = existing.filter((item) => !(item.roomId === roomId && item.bookId === bookId))
  writeSessions(next)
}

export const clearLastReadingSession = () => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(LAST_READING_SESSION_KEY)
}
