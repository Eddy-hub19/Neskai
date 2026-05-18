"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { readLastReadingSession } from "@/lib/readingSession"
import styles from "@/app/profile/profile.module.scss"

export default function LastReadingSessionCard() {
  const [session] = useState(() => readLastReadingSession())

  const partnersText = useMemo(() => {
    if (!session?.participants?.length) {
      return "Читатели не зафиксированы"
    }

    return session.participants.join(", ")
  }, [session])

  if (!session) {
    return (
      <div className={styles.lastSessionCard}>
        <h2>Последняя сессия чтения</h2>
        <p>История совместного чтения появится после первой сессии в комнате.</p>
      </div>
    )
  }

  const formattedDate = new Date(session.lastSeenAt).toLocaleString("ru-RU")

  return (
    <div className={styles.lastSessionCard}>
      <h2>Последняя сессия чтения</h2>
      <p className={styles.sessionBook}>{session.bookTitle}</p>
      <p className={styles.sessionMeta}>Читал(а) с: {partnersText}</p>
      <p className={styles.sessionMeta}>Обновлено: {formattedDate}</p>
      <Link href={`/reading-room/${session.roomId}?bookId=${session.bookId}`} className={styles.returnBtn}>
        Вернуться к книге
      </Link>
    </div>
  )
}
