"use client"

import { FormEvent, useMemo, useState } from "react"
import { Drawer } from "vaul"
import styles from "./ThreadDrawer.module.scss"
import type { ThreadMessage } from "../lib/types"

type ThreadDrawerProps = {
  open: boolean
  cfiRange: string | null
  messages: ThreadMessage[]
  onOpenChange: (value: boolean) => void
  onSubmit: (content: string) => void
}

export function ThreadDrawer({ open, cfiRange, messages, onOpenChange, onSubmit }: ThreadDrawerProps) {
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
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className={styles.overlay} />
        <Drawer.Content className={styles.content}>
          <div className={styles.handle} />
          <div className={styles.header}>
            <p>Thread</p>
          </div>

          <div className={styles.messageList}>
            {visibleMessages.length > 0 ? (
              visibleMessages.map((message) => (
                <article key={message.id} className={styles.messageItem}>
                  <p className={styles.messageMeta}>{message.userName}</p>
                  <p className={styles.messageContent}>{message.content}</p>
                </article>
              ))
            ) : (
              <p className={styles.empty}>Добавьте первую мысль</p>
            )}
          </div>

          <form className={styles.composer} onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ваша мысль..."
              rows={3}
            />
            <button type="submit">Отправить</button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
