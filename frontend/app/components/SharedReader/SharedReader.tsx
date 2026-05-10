"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import ePub, { Rendition } from "epubjs"
import { AnimatePresence } from "framer-motion"
import styles from "./SharedReader.module.scss"
import { THEMES } from "./lib/constants"
import { clampPercent, emphasizeColor, getDefaultViewMode } from "./lib/utils"
import type {
  AnnotationReaction,
  HighlightWeight,
  MenuColorKey,
  SelectionMenuPosition,
  SharedReaderProps,
  ThemeKey,
  ViewMode,
} from "./lib/types"
import { ThemeButtons } from "./ui/ThemeButtons"
import { RemoteCursorOverlay } from "./ui/RemoteCursorOverlay"
import ReaderAnnotations from "./ReaderAnnotations"

export default function SharedReader({
  bookUrl,
  bookTitle,
  onBack,
  closeHref,
  showHeader = true,
  showInlineThemePicker = false,
  myHighlightColor = "rgb(8, 67, 28)",
  incomingCfi,
  onLocationChange,
  highlights,
  incomingHighlight,
  onHighlightCreate,
  onQuickReaction,
  annotationReactions = [],
  threadMessages,
  onThreadOpen,
  onThreadMessageCreate,
  remoteCursor,
  onCursorMove,
}: SharedReaderProps) {
  const [theme, setTheme] = useState<ThemeKey>("gray")
  const [viewMode, setViewMode] = useState<ViewMode>(getDefaultViewMode)
  const [fontSize, setFontSize] = useState(110)
  const [menuPosition, setMenuPosition] = useState<SelectionMenuPosition | null>(null)
  const [currentSelectionCfi, setCurrentSelectionCfi] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(myHighlightColor)
  const [selectionWeight, setSelectionWeight] = useState<HighlightWeight>("normal")
  const [reactionPinPositions, setReactionPinPositions] = useState<
    Array<{ cfiRange: string; x: number; y: number; summary: string }>
  >([])

  const viewerRef = useRef<HTMLDivElement>(null)
  const selectionMenuRef = useRef<HTMLDivElement>(null)
  const selectionWindowRef = useRef<Window | null>(null)
  const isSelectionMenuOpenRef = useRef(false)
  const renditionRef = useRef<Rendition | null>(null)
  const currentCfiRef = useRef<string | null>(null)
  const suppressNextRelocationRef = useRef(false)
  const bookInstanceRef = useRef<any>(null)
  const appliedHighlightsRef = useRef<Set<string>>(new Set())
  const highlightsRef = useRef(highlights ?? [])
  const lastTouchSyncAtRef = useRef(0)
  const queuedTouchPointRef = useRef<{ x: number; y: number } | null>(null)
  const touchRafRef = useRef<number | null>(null)

  const normalizedUrl = useMemo(() => bookUrl.trim(), [bookUrl])
  const lowerUrl = useMemo(() => normalizedUrl.toLowerCase().split("?")[0], [normalizedUrl])
  const isPDF = lowerUrl.endsWith(".pdf")
  const isEPUB = lowerUrl.endsWith(".epub")

  const containerThemeClass =
    theme === "dark" ? styles.themeDark : theme === "sepia" ? styles.themeSepia : styles.themeGray

  const getThemeDotClass = useCallback((key: ThemeKey) => {
    if (key === "dark") return styles.themeDotDark
    if (key === "sepia") return styles.themeDotSepia
    return styles.themeDotGray
  }, [])

  const getMenuColorClass = useCallback((key: MenuColorKey) => {
    if (key === "mint") return styles.colorMint
    if (key === "blue") return styles.colorBlue
    if (key === "rose") return styles.colorRose
    return styles.colorGold
  }, [])

  const closeSelectionMenu = useCallback((clearNativeSelection = true) => {
    setMenuPosition(null)
    setCurrentSelectionCfi(null)
    setSelectionWeight("normal")

    if (clearNativeSelection) {
      selectionWindowRef.current?.getSelection?.()?.removeAllRanges?.()
    }

    selectionWindowRef.current = null
  }, [])

  const applyHighlightIfNeeded = useCallback((cfiRange: string, color: string, fontWeight: HighlightWeight = "normal") => {
    const rendition = renditionRef.current
    if (!rendition) return false

    const effectiveColor = emphasizeColor(color, fontWeight)
    const key = `${cfiRange}|${effectiveColor}|${fontWeight}`
    if (appliedHighlightsRef.current.has(key)) return false

    rendition.annotations.add("highlight", cfiRange, {}, undefined, "hl-style", { fill: effectiveColor })
    appliedHighlightsRef.current.add(key)
    return true
  }, [])

  const reactionIconMap = useMemo(
    () => ({
      sparkles: "✦",
      feather: "〰",
      heart: "♡",
    }) as const,
    [],
  )

  const updateReactionPins = useCallback(() => {
    const rendition = renditionRef.current
    const viewport = viewerRef.current?.getBoundingClientRect()
    if (!rendition || !viewport || viewport.width <= 0 || viewport.height <= 0 || annotationReactions.length === 0) {
      setReactionPinPositions([])
      return
    }

    const grouped = annotationReactions.reduce<Map<string, AnnotationReaction[]>>((map, reaction) => {
      const existing = map.get(reaction.cfiRange) ?? []
      existing.push(reaction)
      map.set(reaction.cfiRange, existing)
      return map
    }, new Map())

    const pins: Array<{ cfiRange: string; x: number; y: number; summary: string }> = []

    for (const [cfiRange, reactions] of grouped.entries()) {
      try {
        const range = rendition.getRange(cfiRange)
        if (!range) continue

        const rect = range.getBoundingClientRect()
        if (!rect || rect.width <= 0 || rect.height <= 0) continue

        const x = clampPercent(((rect.right - viewport.left) / viewport.width) * 100)
        const y = clampPercent(((rect.top - viewport.top) / viewport.height) * 100)

        const counts = reactions.reduce<Record<string, number>>((acc, item) => {
          acc[item.type] = (acc[item.type] ?? 0) + 1
          return acc
        }, {})

        const summary = (["sparkles", "feather", "heart"] as const)
          .filter((type) => Boolean(counts[type]))
          .map((type) => `${reactionIconMap[type]}${counts[type] > 1 ? counts[type] : ""}`)
          .join(" ")

        if (!summary) continue

        pins.push({ cfiRange, x, y, summary })
      } catch {
        // Range can be unavailable when CFI is out of current rendered flow.
      }
    }

    setReactionPinPositions(pins)
  }, [annotationReactions, reactionIconMap])

  const reapplyHighlights = useCallback(() => {
    const availableHighlights = highlightsRef.current
    if (!availableHighlights?.length) return

    for (const item of availableHighlights) {
      applyHighlightIfNeeded(item.cfiRange, item.color, item.fontWeight || "normal")
    }
  }, [applyHighlightIfNeeded])

  const emitCursorFromViewportPoint = useCallback(
    (clientX: number, clientY: number) => {
      const viewport = viewerRef.current?.getBoundingClientRect()
      if (!viewport || viewport.width <= 0 || viewport.height <= 0) return

      const x = clampPercent(((clientX - viewport.left) / viewport.width) * 100)
      const y = clampPercent(((clientY - viewport.top) / viewport.height) * 100)

      onCursorMove?.({
        cfi: currentCfiRef.current,
        x,
        y,
      })
    },
    [onCursorMove],
  )

  const flushQueuedTouchCursor = useCallback(() => {
    touchRafRef.current = null
    const point = queuedTouchPointRef.current
    queuedTouchPointRef.current = null

    if (!point) return

    lastTouchSyncAtRef.current = Date.now()
    emitCursorFromViewportPoint(point.x, point.y)
  }, [emitCursorFromViewportPoint])

  const sendTouchCursor = useCallback(
    (point: { x: number; y: number }) => {
      const now = Date.now()
      if (now - lastTouchSyncAtRef.current >= 80) {
        lastTouchSyncAtRef.current = now
        emitCursorFromViewportPoint(point.x, point.y)
        return
      }

      queuedTouchPointRef.current = point
      if (touchRafRef.current === null && typeof window !== "undefined") {
        touchRafRef.current = window.requestAnimationFrame(flushQueuedTouchCursor)
      }
    },
    [emitCursorFromViewportPoint, flushQueuedTouchCursor],
  )

  const openSelectionMenu = useCallback((cfiRange: string, contents: any) => {
    const selection = contents?.window?.getSelection?.()
    if (!selection?.rangeCount) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    let menuX = rect.left + rect.width / 2
    let menuY = rect.top - 56

    try {
      const frameRect = contents?.window?.frameElement?.getBoundingClientRect?.()
      if (frameRect) {
        menuX += frameRect.left
        menuY += frameRect.top
      }
    } catch {
      // If frame access is restricted, keep viewport-relative coordinates.
    }

    selectionWindowRef.current = contents?.window ?? null
    setCurrentSelectionCfi(cfiRange)
    setMenuPosition({ x: menuX, y: menuY })
    setSelectedColor(myHighlightColor)
    setSelectionWeight("normal")
  }, [myHighlightColor])

  const handleFinalizeHighlight = useCallback(() => {
    if (!currentSelectionCfi) return

    applyHighlightIfNeeded(currentSelectionCfi, selectedColor, selectionWeight)
    onHighlightCreate?.({
      cfiRange: currentSelectionCfi,
      color: selectedColor,
      fontWeight: selectionWeight,
    })

    closeSelectionMenu(true)
  }, [applyHighlightIfNeeded, closeSelectionMenu, currentSelectionCfi, onHighlightCreate, selectedColor, selectionWeight])

  useEffect(() => {
    isSelectionMenuOpenRef.current = Boolean(menuPosition)
  }, [menuPosition])

  useEffect(() => {
    if (!isEPUB || !viewerRef.current) {
      return
    }

    viewerRef.current.innerHTML = ""
    appliedHighlightsRef.current.clear()

    bookInstanceRef.current?.destroy?.()
    bookInstanceRef.current = ePub(normalizedUrl)

    const rendition = bookInstanceRef.current.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      manager: viewMode === "scrolled" ? "continuous" : "default",
      flow: viewMode === "scrolled" ? "scrolled" : "paginated",
    })

    renditionRef.current = rendition

    rendition.on("relocated", (loc: any) => {
      const newCfi = loc?.start?.cfi
      if (!newCfi) return

      if (suppressNextRelocationRef.current) {
        suppressNextRelocationRef.current = false
        currentCfiRef.current = newCfi
        return
      }

      if (currentCfiRef.current !== newCfi) {
        currentCfiRef.current = newCfi
        onLocationChange?.(newCfi)
      }

      // Re-apply known highlights after page relocation to keep mobile rendering stable.
      reapplyHighlights()
      updateReactionPins()
    })

    rendition.on("selected", (cfiRange: string, contents: any) => {
      openSelectionMenu(cfiRange, contents)
    })

    rendition.on("click", (event: any) => {
      const viewport = viewerRef.current?.getBoundingClientRect()
      if (!viewport) return

      const clientX = typeof event?.clientX === "number" ? event.clientX : viewport.left + viewport.width / 2
      const clientY = typeof event?.clientY === "number" ? event.clientY : viewport.top + viewport.height / 2

      const x = clampPercent(((clientX - viewport.left) / viewport.width) * 100)
      const y = clampPercent(((clientY - viewport.top) / viewport.height) * 100)

      onCursorMove?.({
        cfi: currentCfiRef.current,
        x,
        y,
      })

      if (isSelectionMenuOpenRef.current) {
        closeSelectionMenu(false)
      }
    })

    rendition.hooks.content.register((contents: any) => {
      const getViewportTouchPoint = (touch: Touch) => {
        let clientX = touch.clientX
        let clientY = touch.clientY

        try {
          const frameRect = contents?.window?.frameElement?.getBoundingClientRect?.()
          if (frameRect) {
            clientX += frameRect.left
            clientY += frameRect.top
          }
        } catch {
          // Keep iframe-relative coordinates if frame rect is unavailable.
        }

        return { x: clientX, y: clientY }
      }

      const handleTouchMove = (event: TouchEvent) => {
        const touch = event.touches?.[0] ?? event.changedTouches?.[0]
        if (!touch) return

        sendTouchCursor(getViewportTouchPoint(touch))
      }

      const handleTouchStart = (event: TouchEvent) => {
        const touch = event.touches?.[0] ?? event.changedTouches?.[0]
        if (!touch) return

        sendTouchCursor(getViewportTouchPoint(touch))
      }

      const maybeOpenSelectionFromNativeRange = () => {
        if (isSelectionMenuOpenRef.current) return

        const selection = contents?.window?.getSelection?.()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

        try {
          const range = selection.getRangeAt(0)
          const cfiRange = contents?.cfiFromRange?.(range)
          if (typeof cfiRange === "string" && cfiRange.length > 0) {
            openSelectionMenu(cfiRange, contents)
          }
        } catch {
          // Ignore invalid range conversions on unstable selections.
        }
      }

      const handleTouchEnd = () => {
        window.setTimeout(maybeOpenSelectionFromNativeRange, 120)
      }

      const doc = contents?.document
      doc?.addEventListener("touchstart", handleTouchStart, { passive: true })
      doc?.addEventListener("touchmove", handleTouchMove, { passive: true })
      doc?.addEventListener("touchend", handleTouchEnd, { passive: true })

      const cleanup = () => {
        doc?.removeEventListener("touchstart", handleTouchStart)
        doc?.removeEventListener("touchmove", handleTouchMove)
        doc?.removeEventListener("touchend", handleTouchEnd)
      }

      contents?.window?.addEventListener("pagehide", cleanup, { once: true })
    })

    rendition.display(currentCfiRef.current || undefined).then(() => {
      reapplyHighlights()
      updateReactionPins()
    })

    return () => {
      renditionRef.current = null
      bookInstanceRef.current?.destroy?.()
      bookInstanceRef.current = null
    }
  }, [closeSelectionMenu, isEPUB, normalizedUrl, onCursorMove, onLocationChange, openSelectionMenu, reapplyHighlights, sendTouchCursor, updateReactionPins, viewMode])

  useEffect(() => {
    setSelectedColor(myHighlightColor)
  }, [myHighlightColor])

  useEffect(() => {
    if (!menuPosition) return

    const onPointerDown = (event: PointerEvent) => {
      if (!selectionMenuRef.current) return
      const target = event.target as Node | null
      if (target && selectionMenuRef.current.contains(target)) return

      closeSelectionMenu(true)
    }

    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
    }
  }, [closeSelectionMenu, menuPosition])

  useEffect(() => {
    highlightsRef.current = highlights ?? []
    reapplyHighlights()
  }, [highlights, reapplyHighlights])

  useEffect(() => {
    if (!incomingHighlight) return
    applyHighlightIfNeeded(incomingHighlight.cfiRange, incomingHighlight.color, incomingHighlight.fontWeight || "normal")
  }, [applyHighlightIfNeeded, incomingHighlight])

  useEffect(() => {
    return () => {
      if (touchRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(touchRafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return

    const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
    const scrolledPadding = isMobileViewport ? "8px 14px 12px !important" : "8px 0 12px !important"

    rendition.themes.fontSize(`${fontSize}%`)
    rendition.themes.register("current", {
      body: {
        background: "transparent !important",
        color: `${THEMES[theme].fg} !important`,
        padding: viewMode === "scrolled" ? scrolledPadding : "0 !important",
      },
      "p, li, span, a, h1, h2, h3, h4, div": {
        color: `${THEMES[theme].fg} !important`,
      },
      "img, table, div": {
        "background-color": "transparent !important",
      },
      "div, p, h1, h2, h3, h4, h5, h6, section, article, blockquote, pre, table, tr, td, th, ul, ol, li": {
        background: "transparent !important",
        "background-color": "transparent !important",
        "background-image": "none !important",
        border: "none !important",
        "box-shadow": "none !important",
      },
      "[class*='calibre']": {
        background: "transparent !important",
        "background-color": "transparent !important",
        "background-image": "none !important",
        border: "none !important",
        "box-shadow": "none !important",
      },
    })
    rendition.themes.select("current")
  }, [fontSize, theme, viewMode])

  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || !incomingCfi) return
    if (incomingCfi === currentCfiRef.current) return

    suppressNextRelocationRef.current = true
    currentCfiRef.current = incomingCfi
    rendition.display(incomingCfi)
  }, [incomingCfi])

  useEffect(() => {
    if (!isEPUB) {
      setReactionPinPositions([])
      return
    }

    updateReactionPins()
  }, [annotationReactions, isEPUB, updateReactionPins])

  useEffect(() => {
    const handleWindowResize = () => {
      updateReactionPins()
    }

    window.addEventListener("resize", handleWindowResize)
    return () => {
      window.removeEventListener("resize", handleWindowResize)
    }
  }, [updateReactionPins])

  const epubClassName = `${styles.epubBox} ${viewMode === "scrolled" ? styles.isScrolled : ""} ${viewMode === "paginated" ? styles.isPaginated : ""}`

  return (
    <main className={`${styles.container} ${containerThemeClass}`}>
      {showHeader && (
        <header className={styles.header}>
          <div className={styles.section}>
            <button onClick={onBack} className={styles.circleBtn}>
              ←
            </button>
            <span className={styles.bookTitle}>{bookTitle}</span>
          </div>

          <div className={styles.centerSection}>
            <div className={styles.themePicker}>
              <ThemeButtons theme={theme} onSelect={setTheme} getThemeDotClass={getThemeDotClass} />
            </div>
            <div className={styles.zoomGroup}>
              <button onClick={() => setFontSize((f) => Math.max(70, f - 10))}>A-</button>
              <span className={styles.zoomVal}>{fontSize}%</span>
              <button onClick={() => setFontSize((f) => Math.min(220, f + 10))}>A+</button>
            </div>
          </div>

          <div className={styles.section}>
            {closeHref && (
              <Link href={closeHref} className={styles.closeBtn} aria-label="Закрыть книгу">
                ✕
              </Link>
            )}

            {!isPDF && (
              <div className={styles.modeTabs}>
                <button className={viewMode === "scrolled" ? styles.active : ""} onClick={() => setViewMode("scrolled")}>
                  Лента
                </button>
                <button className={viewMode === "paginated" ? styles.active : ""} onClick={() => setViewMode("paginated")}>
                  Страницы
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      <section className={styles.viewContent}>
        {!showHeader && showInlineThemePicker && (
          <div className={styles.inlineReaderTools}>
            <div className={styles.inlineThemePicker}>
              <ThemeButtons theme={theme} onSelect={setTheme} getThemeDotClass={getThemeDotClass} />
            </div>

            <div className={styles.inlineZoomGroup}>
              <button onClick={() => setFontSize((f) => Math.max(70, f - 10))}>A-</button>
              <span className={styles.zoomVal}>{fontSize}%</span>
              <button onClick={() => setFontSize((f) => Math.min(220, f + 10))}>A+</button>
            </div>

            {!isPDF && (
              <div className={styles.inlineModeTabs}>
                <button className={viewMode === "scrolled" ? styles.active : ""} onClick={() => setViewMode("scrolled")}>
                  Лента
                </button>
                <button className={viewMode === "paginated" ? styles.active : ""} onClick={() => setViewMode("paginated")}>
                  Страницы
                </button>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          <RemoteCursorOverlay remoteCursor={remoteCursor} />
        </AnimatePresence>

        {reactionPinPositions.map((pin) => (
          <div key={pin.cfiRange} className={styles.reactionPin} style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
            {pin.summary}
          </div>
        ))}

        {isPDF && (
          <div className={styles.pdfScroll}>
            <div className={styles.pdfSizer} style={{ width: `${fontSize}%` }}>
              <iframe src={`${normalizedUrl}#toolbar=0&view=FitH`} className={styles.pdfFrame} />
            </div>
          </div>
        )}

        {isEPUB && (
          <div className={epubClassName}>
            <div className={styles.sideNav}>
              {viewMode === "paginated" && <button onClick={() => renditionRef.current?.prev()}>‹</button>}
            </div>
            <div ref={viewerRef} className={styles.readerCanvas} />
            <div className={styles.sideNav}>
              {viewMode === "paginated" && <button onClick={() => renditionRef.current?.next()}>›</button>}
            </div>
          </div>
        )}

        <ReaderAnnotations
          menuPosition={menuPosition}
          selectionMenuRef={selectionMenuRef}
          currentSelectionCfi={currentSelectionCfi}
          selectedColor={selectedColor}
          selectionWeight={selectionWeight}
          getMenuColorClass={getMenuColorClass}
          onColorSelect={setSelectedColor}
          onToggleWeight={() => setSelectionWeight((prev) => (prev === "bold" ? "normal" : "bold"))}
          onDismissSelection={() => closeSelectionMenu(true)}
          onSaveHighlight={handleFinalizeHighlight}
          onQuickReaction={onQuickReaction}
          onThreadOpen={onThreadOpen}
          onThreadMessageCreate={onThreadMessageCreate}
          threadMessages={threadMessages}
        />
      </section>
    </main>
  )
}
