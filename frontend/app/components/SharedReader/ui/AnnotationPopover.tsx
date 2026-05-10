"use client"

import { FormEvent, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import styles from "./AnnotationPopover.module.scss"
import type { ThreadMessage } from "../lib/types"

type AnnotationPopoverProps = {
  open: boolean
  anchor: { x: number; y: number } | null
  cfiRange: string | null
  messages: ThreadMessage[]
  onClose: () => void
  onSubmit: (content: string) => void
}

export function AnnotationPopover({ open, anchor, cfiRange, messages, onClose, onSubmit }: AnnotationPopoverProps) {
  const [draft, setDraft] = useState("")

  const visibleMessages = useMemo(() => {
    if (!cfiRange) return []
    return messages.filter((message) => message.annotationCfi === cfiRange)
  }, [cfiRange, messages])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    onSubmit(content)
    setDraft("")
  }

  return (
    <AnimatePresence>
      {open && anchor && (
        <motion.aside
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className={styles.popover}
          style={{ left: anchor.x, top: anchor.y + 18 }}
        >
          <div className={styles.paperTexture} />

          <header className={styles.header}>
            <p>Thread</p>
            <button onClick={onClose} className={styles.closeBtn}>
              Close
            </button>
          </header>

          <div className={styles.messageList}>
            {visibleMessages.length > 0 ? (
              visibleMessages.map((message) => (
                <article key={message.id} className={styles.messageItem}>
                  <p className={styles.messageMeta}>
                    {message.userName} • {new Date(message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className={styles.messageContent}>{message.content}</p>
                </article>
              ))
            ) : (
              <p className={styles.empty}>Добавьте первую мысль к этому выделению</p>
            )}
          </div>

          <form className={styles.composer} onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Поделитесь мыслью..."
              rows={2}
            />
            <button type="submit">Отправить</button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
