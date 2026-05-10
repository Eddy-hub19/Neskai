"use client"

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react"
import { AnimatePresence } from "framer-motion"
import { AnnotationPopover } from "./ui/AnnotationPopover"
import { SelectionMenu } from "./ui/SelectionMenu"
import { ThreadDrawer } from "./ui/ThreadDrawer"
import { ReactionBurst } from "./ui/ReactionBurst"
import { MENU_COLORS, MENU_COLOR_VALUES } from "./lib/constants"
import styles from "./SharedReader.module.scss"
import type {
  HighlightWeight,
  MenuColorKey,
  ReactionType,
  SelectionMenuPosition,
  ThreadMessage,
} from "./lib/types"

type ReaderAnnotationsProps = {
  menuPosition: SelectionMenuPosition | null
  selectionMenuRef: RefObject<HTMLDivElement | null>
  currentSelectionCfi: string | null
  selectedColor: string
  selectionWeight: HighlightWeight
  getMenuColorClass: (key: MenuColorKey) => string
  onColorSelect: (color: string) => void
  onToggleWeight: () => void
  onDismissSelection: () => void
  onSaveHighlight: () => void
  onQuickReaction?: (payload: { cfiRange: string; reaction: ReactionType }) => void
  onThreadOpen?: (cfiRange: string) => void
  onThreadMessageCreate?: (payload: { cfiRange: string; content: string }) => void
  threadMessages?: ThreadMessage[]
}

type Burst = {
  id: string
  x: number
  y: number
  type: ReactionType
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function ReaderAnnotations({
  menuPosition,
  selectionMenuRef,
  currentSelectionCfi,
  selectedColor,
  selectionWeight,
  getMenuColorClass,
  onColorSelect,
  onToggleWeight,
  onDismissSelection,
  onSaveHighlight,
  onQuickReaction,
  onThreadOpen,
  onThreadMessageCreate,
  threadMessages = [],
}: ReaderAnnotationsProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [threadOpen, setThreadOpen] = useState(false)
  const [threadCfi, setThreadCfi] = useState<string | null>(null)
  const [threadAnchor, setThreadAnchor] = useState<SelectionMenuPosition | null>(null)
  const [bursts, setBursts] = useState<Burst[]>([])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const applyMatch = () => setIsMobile(mediaQuery.matches)

    applyMatch()
    mediaQuery.addEventListener("change", applyMatch)

    return () => {
      mediaQuery.removeEventListener("change", applyMatch)
    }
  }, [])

  const visibleMessages = useMemo(() => {
    if (!threadCfi) return []
    return threadMessages.filter((item) => item.annotationCfi === threadCfi)
  }, [threadCfi, threadMessages])

  const pushBurst = useCallback((reaction: ReactionType, position: SelectionMenuPosition | null) => {
    const burst: Burst = {
      id: makeId(),
      type: reaction,
      x: position?.x ?? window.innerWidth * 0.5,
      y: position?.y ?? window.innerHeight - 96,
    }

    setBursts((prev) => [...prev, burst])
  }, [])

  const handleOpenThread = useCallback(() => {
    if (!currentSelectionCfi) return

    onSaveHighlight()
    onThreadOpen?.(currentSelectionCfi)
    setThreadCfi(currentSelectionCfi)
    setThreadAnchor(menuPosition)
    setThreadOpen(true)
  }, [currentSelectionCfi, menuPosition, onSaveHighlight, onThreadOpen])

  const handleQuickReaction = useCallback(
    (reaction: ReactionType) => {
      if (!currentSelectionCfi) return

      onQuickReaction?.({ cfiRange: currentSelectionCfi, reaction })
      pushBurst(reaction, menuPosition)
    },
    [currentSelectionCfi, menuPosition, onQuickReaction, pushBurst],
  )

  const handleSubmitMessage = useCallback(
    (content: string) => {
      if (!threadCfi) return
      onThreadMessageCreate?.({ cfiRange: threadCfi, content })
    },
    [onThreadMessageCreate, threadCfi],
  )

  return (
    <>
      <AnimatePresence>
        {menuPosition && !isMobile && (
          <SelectionMenu
            menuPosition={menuPosition}
            selectedColor={selectedColor}
            selectionWeight={selectionWeight}
            onColorSelect={onColorSelect}
            onToggleWeight={onToggleWeight}
            onSave={onSaveHighlight}
            onAddThought={handleOpenThread}
            onQuickReaction={handleQuickReaction}
            getMenuColorClass={getMenuColorClass}
            selectionMenuRef={selectionMenuRef}
          />
        )}
      </AnimatePresence>

      {menuPosition && isMobile && (
        <div className={styles.mobileSelectionDock} ref={selectionMenuRef}>
          <button type="button" className={styles.mobileSelectionClose} onClick={onDismissSelection} aria-label="Закрыть меню">
            ✕
          </button>

          <div className={styles.colorRow}>
            {MENU_COLORS.map((key) => {
              const colorValue = MENU_COLOR_VALUES[key]
              return (
                <button
                  type="button"
                  key={key}
                  className={`${styles.colorCircle} ${getMenuColorClass(key)} ${selectedColor === colorValue ? styles.activeColor : ""}`}
                  onClick={() => onColorSelect(colorValue)}
                />
              )
            })}
          </div>

          <div className={styles.reactionRow}>
            <button type="button" className={styles.reactionBtn} onClick={() => handleQuickReaction("sparkles")}>
              ✦
            </button>
            <button type="button" className={styles.reactionBtn} onClick={() => handleQuickReaction("feather")}>
              〰
            </button>
            <button type="button" className={styles.reactionBtn} onClick={() => handleQuickReaction("heart")}>
              ♡
            </button>
          </div>

          <div className={styles.divider} />

          <div className={styles.mobileSelectionActions}>
            <button
              type="button"
              className={`${styles.textBtn} ${selectionWeight === "bold" ? styles.activeTextBtn : ""}`}
              onClick={onToggleWeight}
            >
              B
            </button>
            <button type="button" className={`${styles.textBtn} ${styles.saveBtn}`} onClick={onSaveHighlight}>
              Выделить
            </button>
            <button type="button" className={`${styles.textBtn} ${styles.thoughtBtn}`} onClick={handleOpenThread}>
              Мысль
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        <ThreadDrawer
          open={threadOpen}
          cfiRange={threadCfi}
          messages={visibleMessages}
          onOpenChange={setThreadOpen}
          onSubmit={handleSubmitMessage}
        />
      ) : (
        <AnnotationPopover
          open={threadOpen}
          anchor={threadAnchor}
          cfiRange={threadCfi}
          messages={visibleMessages}
          onClose={() => setThreadOpen(false)}
          onSubmit={handleSubmitMessage}
        />
      )}

      <ReactionBurst bursts={bursts} onAnimationEnd={(id) => setBursts((prev) => prev.filter((item) => item.id !== id))} />
    </>
  )
}
