"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import ePub, { Rendition } from "epubjs"
import { AnimatePresence } from "framer-motion"
import styles from "./SharedReader.module.scss"
import { THEMES } from "./lib/constants"
import { clampPercent, emphasizeColor, getDefaultViewMode } from "./lib/utils"
import type {
  HighlightWeight,
  MenuColorKey,
  SelectionMenuPosition,
  SharedReaderProps,
  ThemeKey,
  ViewMode,
} from "./lib/types"
import { ThemeButtons } from "./ui/ThemeButtons"
import { RemoteCursorOverlay } from "./ui/RemoteCursorOverlay"
import PdfReaderView from "./ui/PdfReaderView"
import EpubReaderView from "./ui/EpubReaderView"
import ReaderAnnotations from "./ReaderAnnotations"
import { useImmersiveMode } from "@/hooks/useImmersiveMode"

type EpubLocationLike = {
  start?: {
    cfi?: string
  }
}

type EpubContentsLike = {
  window?: (Window & { frameElement?: Element | null }) | null
  document?: Document | null
  cfiFromRange?: (range: Range) => string
}

type PointerLike = {
  clientX?: number
  clientY?: number
}

type TouchAnchorPoint = {
  x: number
  y: number
}

type RenditionWithLocation = Rendition & {
  currentLocation?: () => EpubLocationLike | EpubLocationLike[] | null
}

type EpubBookInstance = ReturnType<typeof ePub> & {
  opened?: Promise<unknown>
}

export default function SharedReader({
  bookUrl,
  bookTitle,
  onBack,
  closeHref,
  showHeader = true,
  showInlineThemePicker = false,
  myHighlightColor = "rgb(25, 225, 92)",
  incomingCfi,
  onLocationChange,
  highlights,
  incomingHighlight,
  onHighlightCreate,
  remoteCursor,
  onCursorMove,
  onContentReady,
}: SharedReaderProps) {
  const [theme, setTheme] = useState<ThemeKey>("gray")

  const [viewMode, setViewMode] = useState<ViewMode>(getDefaultViewMode)
  const [fontSize, setFontSize] = useState(100)
  const [menuPosition, setMenuPosition] = useState<SelectionMenuPosition | null>(null)
  const [currentSelectionCfi, setCurrentSelectionCfi] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(myHighlightColor)
  const [selectionWeight, setSelectionWeight] = useState<HighlightWeight>("normal")
  const [isCompactToolsOpen, setIsCompactToolsOpen] = useState(false)

  const { isHidden, handleScrollTop, revealUi, toggleUi } = useImmersiveMode({
    threshold: 50,
    idleMs: 1500,
    autoRevealOnIdle: true,
  })

  const scrollHostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const selectionMenuRef = useRef<HTMLDivElement>(null)
  const compactToolsRef = useRef<HTMLDivElement>(null)
  const selectionWindowRef = useRef<Window | null>(null)
  const isSelectionMenuOpenRef = useRef(false)
  const renditionRef = useRef<Rendition | null>(null)
  const currentCfiRef = useRef<string | null>(null)
  const suppressNextRelocationRef = useRef(false)
  const bookInstanceRef = useRef<ReturnType<typeof ePub> | null>(null)
  const appliedHighlightsRef = useRef<Set<string>>(new Set())
  const highlightsRef = useRef(highlights ?? [])
  const onLocationChangeRef = useRef(onLocationChange)
  const onCursorMoveRef = useRef(onCursorMove)
  const lastTouchSyncAtRef = useRef(0)
  const queuedTouchPointRef = useRef<{ x: number; y: number } | null>(null)
  const touchRafRef = useRef<number | null>(null)
  const autoLoadInFlightRef = useRef(false)
  const autoLoadLastAttemptRef = useRef(0)
  const didNotifyContentReadyRef = useRef(false)

  const markContentReady = useCallback(() => {
    if (didNotifyContentReadyRef.current) return
    didNotifyContentReadyRef.current = true
    onContentReady?.()
  }, [onContentReady])

  // const normalizedUrl = useMemo(() => bookUrl.trim(), [bookUrl])
  const normalizedUrl = useMemo(() => {
    // Если ссылки нет (null или undefined), возвращаем пустую строку
    if (!bookUrl) return ""
    return bookUrl.trim()
  }, [bookUrl])

  const lowerUrl = useMemo(() => normalizedUrl.toLowerCase().split("?")[0], [normalizedUrl])
  const isPDF = lowerUrl.endsWith(".pdf")
  const isEPUB = lowerUrl.endsWith(".epub")
  const isImmersiveScrollable = (isEPUB && viewMode === "scrolled") || isPDF
  const isUiHidden = isImmersiveScrollable && isHidden && !menuPosition
  const viewContentClass = `${styles.viewContent} ${showHeader && !isUiHidden ? styles.viewContentWithHeader : ""}`

  const containerThemeClass = () => {
    switch (theme) {
      case "dark":
        return styles.themeDark
      case "sepia":
        return styles.themeSepia
      case "gray":
        return styles.themeGray
    }
  }

  const getThemeDotClass = useCallback((key: ThemeKey) => {
    switch (key) {
      case "dark":
        return styles.themeDotDark
      case "sepia":
        return styles.themeDotSepia
      case "gray":
        return styles.themeDotGray
    }
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

  const applyHighlightIfNeeded = useCallback(
    (cfiRange: string, color: string, fontWeight: HighlightWeight = "normal") => {
      const rendition = renditionRef.current
      if (!rendition) return false

      const effectiveColor = emphasizeColor(color, fontWeight)
      const key = `${cfiRange}|${effectiveColor}|${fontWeight}`
      if (appliedHighlightsRef.current.has(key)) return false

      rendition.annotations.add("highlight", cfiRange, {}, undefined, "hl-style", { fill: effectiveColor })
      appliedHighlightsRef.current.add(key)
      return true
    },
    [],
  )

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])

  useEffect(() => {
    onCursorMoveRef.current = onCursorMove
  }, [onCursorMove])

  const reapplyHighlights = useCallback(() => {
    const availableHighlights = highlightsRef.current
    if (!availableHighlights?.length) return

    for (const item of availableHighlights) {
      applyHighlightIfNeeded(item.cfiRange, item.color, item.fontWeight || "normal")
    }
  }, [applyHighlightIfNeeded])

  const emitCursorFromViewportPoint = useCallback((clientX: number, clientY: number) => {
    const viewport = viewerRef.current?.getBoundingClientRect()
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) return

    const x = clampPercent(((clientX - viewport.left) / viewport.width) * 100)
    const y = clampPercent(((clientY - viewport.top) / viewport.height) * 100)

    onCursorMoveRef.current?.({
      cfi: currentCfiRef.current,
      x,
      y,
    })
  }, [])

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

  const triggerFastNextLoad = useCallback(() => {
    if (viewMode !== "scrolled") return

    const rendition = renditionRef.current
    if (!rendition) return
    const nextMethod = (rendition as Rendition & { next?: () => unknown }).next
    if (typeof nextMethod !== "function") return
    if (autoLoadInFlightRef.current) return

    const now = Date.now()
    if (now - autoLoadLastAttemptRef.current < 700) return

    autoLoadInFlightRef.current = true
    autoLoadLastAttemptRef.current = now

    Promise.resolve()
      .then(() => {
        // next() can throw synchronously while continuous manager is still initializing.
        return nextMethod.call(rendition)
      })
      .catch(() => {})
      .finally(() => {
        window.setTimeout(() => {
          autoLoadInFlightRef.current = false
        }, 180)
      })
  }, [viewMode])

  const triggerHapticFeedback = useCallback((duration = 10) => {
    if (typeof navigator === "undefined") return
    if (typeof navigator.vibrate !== "function") return

    navigator.vibrate(duration)
  }, [])

  const openSelectionMenu = useCallback(
    (cfiRange: string, contents: EpubContentsLike, anchorPoint?: TouchAnchorPoint) => {
      const selection = contents?.window?.getSelection?.()
      if (!selection?.rangeCount) return

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      let menuX = rect.left + rect.width / 2
      let menuY = rect.top - 56

      if (anchorPoint) {
        menuX = anchorPoint.x
        menuY = anchorPoint.y - 56
      }

      try {
        const frameRect = contents?.window?.frameElement?.getBoundingClientRect?.()
        if (frameRect) {
          menuX += frameRect.left
          menuY += frameRect.top
        }
      } catch {}

      const minTop = (window.visualViewport?.offsetTop ?? 0) + 20
      const viewportWidth = window.innerWidth
      const horizontalPadding = 20

      menuX = Math.min(Math.max(menuX, horizontalPadding), viewportWidth - horizontalPadding)
      menuY = Math.max(menuY, minTop)

      selectionWindowRef.current = contents?.window ?? null
      setCurrentSelectionCfi(cfiRange)
      setMenuPosition({ x: menuX, y: menuY })
      setSelectedColor(myHighlightColor)
      setSelectionWeight("normal")
    },
    [myHighlightColor],
  )

  const handleFinalizeHighlight = useCallback(() => {
    if (!currentSelectionCfi) return

    applyHighlightIfNeeded(currentSelectionCfi, selectedColor, selectionWeight)
    onHighlightCreate?.({
      cfiRange: currentSelectionCfi,
      color: selectedColor,
      fontWeight: selectionWeight,
    })

    triggerHapticFeedback(10)

    closeSelectionMenu(true)
  }, [
    applyHighlightIfNeeded,
    closeSelectionMenu,
    currentSelectionCfi,
    onHighlightCreate,
    selectedColor,
    selectionWeight,
    triggerHapticFeedback,
  ])

  const handleViewModeChange = useCallback(
    (nextMode: ViewMode) => {
      if (viewMode === nextMode) return

      const rendition = renditionRef.current as RenditionWithLocation | null
      const location = rendition?.currentLocation?.()
      const normalizedLocation = Array.isArray(location) ? location[0] : location
      const cfi = normalizedLocation?.start?.cfi

      if (typeof cfi === "string" && cfi.length > 0) {
        currentCfiRef.current = cfi
      }

      setViewMode(nextMode)
    },
    [viewMode],
  )

  const handleContentScroll = useCallback(
    (scrollTop: number) => {
      handleScrollTop(scrollTop)
    },
    [handleScrollTop],
  )

  const handleContentPointerDown = useCallback(() => {
    if (isUiHidden) {
      revealUi()
    }
  }, [isUiHidden, revealUi])

  const handleContentDoubleClick = useCallback(() => {
    toggleUi()
  }, [toggleUi])

  const handlePrevPage = useCallback(() => {
    renditionRef.current?.prev()
  }, [])

  const handleNextPage = useCallback(() => {
    renditionRef.current?.next()
  }, [])

  useEffect(() => {
    isSelectionMenuOpenRef.current = Boolean(menuPosition)
  }, [menuPosition])

  useEffect(() => {
    if (!isEPUB || !viewerRef.current) {
      return
    }

    viewerRef.current.innerHTML = ""
    appliedHighlightsRef.current.clear()

    const currentBook = ePub(normalizedUrl) as EpubBookInstance
    bookInstanceRef.current = currentBook

    const manager = viewMode === "scrolled" ? "continuous" : "default"
    const flow = viewMode === "scrolled" ? "scrolled" : "paginated"

    const rendition = currentBook.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      manager,
      flow,
    })

    renditionRef.current = rendition

    rendition.on("relocated", (loc: EpubLocationLike) => {
      const newCfi = loc?.start?.cfi
      if (!newCfi) return

      if (suppressNextRelocationRef.current) {
        suppressNextRelocationRef.current = false
        currentCfiRef.current = newCfi
        return
      }

      if (currentCfiRef.current !== newCfi) {
        currentCfiRef.current = newCfi
        onLocationChangeRef.current?.(newCfi)
      }

      reapplyHighlights()
    })

    rendition.on("selected", (cfiRange: string, contents: EpubContentsLike) => {
      openSelectionMenu(cfiRange, contents)
    })

    rendition.on("click", (event: unknown) => {
      const viewport = viewerRef.current?.getBoundingClientRect()
      if (!viewport) return

      const pointer = (event ?? {}) as PointerLike

      const clientX = typeof pointer.clientX === "number" ? pointer.clientX : viewport.left + viewport.width / 2
      const clientY = typeof pointer.clientY === "number" ? pointer.clientY : viewport.top + viewport.height / 2

      const x = clampPercent(((clientX - viewport.left) / viewport.width) * 100)
      const y = clampPercent(((clientY - viewport.top) / viewport.height) * 100)

      onCursorMoveRef.current?.({
        cfi: currentCfiRef.current,
        x,
        y,
      })

      if (isSelectionMenuOpenRef.current) {
        closeSelectionMenu(false)
      }
    })

    rendition.hooks.content.register((contents: EpubContentsLike) => {
      const doc = contents?.document
      const contentWindow = contents?.window
      let longPressTimer: number | null = null
      let longPressTriggered = false
      let longPressStartPoint: TouchAnchorPoint | null = null

      const getViewportTouchPoint = (touch: Touch) => {
        let clientX = touch.clientX
        let clientY = touch.clientY

        try {
          const frameRect = contents?.window?.frameElement?.getBoundingClientRect?.()
          if (frameRect) {
            clientX += frameRect.left
            clientY += frameRect.top
          }
        } catch {}

        return { x: clientX, y: clientY }
      }

      const handleTouchMove = (event: TouchEvent) => {
        const touch = event.touches?.[0] ?? event.changedTouches?.[0]
        if (!touch) return

        sendTouchCursor(getViewportTouchPoint(touch))
      }

      const clearLongPressTimer = () => {
        if (longPressTimer === null) return
        window.clearTimeout(longPressTimer)
        longPressTimer = null
      }

      const handleTouchStart = (event: TouchEvent) => {
        const touch = event.touches?.[0] ?? event.changedTouches?.[0]
        if (!touch) return

        const point = getViewportTouchPoint(touch)
        const menuRect = selectionMenuRef.current?.getBoundingClientRect()

        if (
          isSelectionMenuOpenRef.current &&
          menuRect &&
          point.x >= menuRect.left &&
          point.x <= menuRect.right &&
          point.y >= menuRect.top &&
          point.y <= menuRect.bottom
        ) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        sendTouchCursor(point)

        longPressTriggered = false
        longPressStartPoint = point
        clearLongPressTimer()

        longPressTimer = window.setTimeout(() => {
          longPressTriggered = true
          triggerHapticFeedback(10)
          maybeOpenSelectionFromNativeRange(point)
          clearLongPressTimer()
        }, 500)
      }

      const maybeOpenSelectionFromNativeRange = (anchorPoint?: TouchAnchorPoint) => {
        const selection = contentWindow?.getSelection?.()
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

        try {
          const range = selection.getRangeAt(0)
          const cfiRange = contents?.cfiFromRange?.(range)
          if (typeof cfiRange === "string" && cfiRange.length > 0) {
            openSelectionMenu(cfiRange, contents, anchorPoint)
          }
        } catch {}
      }

      const handleTouchEnd = (event: TouchEvent) => {
        const touch = event.changedTouches?.[0] ?? event.touches?.[0]
        const anchorPoint = touch ? getViewportTouchPoint(touch) : undefined

        clearLongPressTimer()
        longPressStartPoint = null

        if (longPressTriggered) {
          longPressTriggered = false
          return
        }

        window.setTimeout(() => {
          maybeOpenSelectionFromNativeRange(anchorPoint)
        }, 100)
      }

      const handleTouchCancel = () => {
        clearLongPressTimer()
        longPressTriggered = false
        longPressStartPoint = null
      }

      const handleLongPressTouchMove = (event: TouchEvent) => {
        const touch = event.touches?.[0] ?? event.changedTouches?.[0]
        if (!touch || !longPressStartPoint) return

        const point = getViewportTouchPoint(touch)
        const deltaX = Math.abs(point.x - longPressStartPoint.x)
        const deltaY = Math.abs(point.y - longPressStartPoint.y)

        if (deltaX > 12 || deltaY > 12) {
          clearLongPressTimer()
          longPressStartPoint = null
        }
      }

      const handleContextMenu = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        return false
      }

      doc?.addEventListener("touchstart", handleTouchStart, { passive: false })
      doc?.addEventListener("touchmove", handleTouchMove, { passive: true })
      doc?.addEventListener("touchmove", handleLongPressTouchMove, { passive: true })
      doc?.addEventListener("touchend", handleTouchEnd, { passive: true })
      doc?.addEventListener("touchcancel", handleTouchCancel, { passive: true })
      doc?.addEventListener("contextmenu", handleContextMenu, true)

      const cleanup = () => {
        clearLongPressTimer()
        doc?.removeEventListener("touchstart", handleTouchStart)
        doc?.removeEventListener("touchmove", handleTouchMove)
        doc?.removeEventListener("touchmove", handleLongPressTouchMove)
        doc?.removeEventListener("touchend", handleTouchEnd)
        doc?.removeEventListener("touchcancel", handleTouchCancel)
        doc?.removeEventListener("contextmenu", handleContextMenu, true)
      }

      contentWindow?.addEventListener("pagehide", cleanup, { once: true })
    })

    rendition.display(currentCfiRef.current || undefined).then(() => {
      reapplyHighlights()
      markContentReady()
    })

    return () => {
      renditionRef.current = null

      if (bookInstanceRef.current === currentBook) {
        bookInstanceRef.current = null
      }
    }
  }, [
    closeSelectionMenu,
    isEPUB,
    markContentReady,
    normalizedUrl,
    openSelectionMenu,
    reapplyHighlights,
    sendTouchCursor,
    triggerHapticFeedback,
    viewMode,
  ])

  useEffect(() => {
    if (isEPUB || isPDF) return
    markContentReady()
  }, [isEPUB, isPDF, markContentReady])

  useEffect(() => {
    if (isImmersiveScrollable) return
    revealUi()
  }, [isImmersiveScrollable, revealUi])

  useEffect(() => {
    if (!menuPosition) return
    revealUi()
  }, [menuPosition, revealUi])

  useEffect(() => {
    if (!isCompactToolsOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && compactToolsRef.current?.contains(target)) return
      setIsCompactToolsOpen(false)
    }

    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
    }
  }, [isCompactToolsOpen])

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
    if (!isEPUB || viewMode !== "scrolled") return

    const scrollHost = scrollHostRef.current
    if (!scrollHost) return

    const onScroll = () => {
      const scrollBottom = scrollHost.scrollHeight - scrollHost.scrollTop - scrollHost.clientHeight

      if (scrollBottom < 320) {
        triggerFastNextLoad()
      }
    }

    scrollHost.addEventListener("scroll", onScroll, { passive: true })
    onScroll()

    return () => {
      scrollHost.removeEventListener("scroll", onScroll)
    }
  }, [isEPUB, triggerFastNextLoad, viewMode])

  useEffect(() => {
    highlightsRef.current = highlights ?? []
    reapplyHighlights()
  }, [highlights, reapplyHighlights])

  useEffect(() => {
    if (!incomingHighlight) return
    applyHighlightIfNeeded(
      incomingHighlight.cfiRange,
      incomingHighlight.color,
      incomingHighlight.fontWeight || "normal",
    )
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

    const colorScheme = () => {
      switch (theme) {
        case "dark":
          return THEMES.dark.color
        case "sepia":
          return THEMES.sepia.color
        case "gray":
          return THEMES.gray.color
      }
    }
    rendition.themes.fontSize(`${fontSize}%`)
    rendition.themes.register("current", {
      body: {
        background: "transparent !important",
        color: `${colorScheme()} !important`,
        padding: viewMode === "scrolled" ? scrolledPadding : "0 !important",
        "color-scheme": `${colorScheme()} !important`,
        "touch-action": "pan-y !important",
        "-webkit-touch-callout": "none !important",
        "-webkit-user-select": "text !important",
        "user-select": "text !important",
      },
      html: {
        "color-scheme": `${colorScheme()} !important`,
        "-webkit-touch-callout": "none !important",
      },
      iframe: {
        "color-scheme": `${colorScheme()} !important`,
      },
      "*": {
        "-webkit-touch-callout": "none !important",
      },
      "::selection": {
        background: "rgba(147, 197, 126, 0.4) !important",
      },
      "p, li, span, a, h1, h2, h3, h4, div": {
        color: `${colorScheme()} !important`,
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
  }, [fontSize, theme, viewMode, markContentReady])

  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition || !incomingCfi) return
    if (incomingCfi === currentCfiRef.current) return

    suppressNextRelocationRef.current = true
    currentCfiRef.current = incomingCfi
    rendition.display(incomingCfi)
  }, [incomingCfi])

  const epubClassName = `${styles.epubBox} ${styles.epubContainer} epub-container ${viewMode === "scrolled" ? styles.isScrolled : ""} ${viewMode === "paginated" ? styles.isPaginated : ""}`

  return (
    <div className={`${styles.container} ${containerThemeClass}`}>
      {showHeader && (
        <header className={`${styles.header} ${isUiHidden ? styles.headerHidden : ""}`}>
          <div className={styles.section}>
            <button onClick={onBack} className={styles.circleBtn}>
              ←
            </button>
            <span className={styles.bookTitle}>{bookTitle}</span>
          </div>

          <div className={`${styles.section} ${styles.sectionRight}`}>
            {closeHref && (
              <Link href={closeHref} className={styles.closeBtn} aria-label="Закрыть книгу">
                ✕
              </Link>
            )}

            <div className={styles.headerControls} ref={compactToolsRef}>
              {!isPDF && (
                <div className={styles.modeTabs}>
                  <button
                    className={viewMode === "scrolled" ? styles.active : ""}
                    onClick={() => handleViewModeChange("scrolled")}
                  >
                    Лента
                  </button>
                  <button
                    className={viewMode === "paginated" ? styles.active : ""}
                    onClick={() => handleViewModeChange("paginated")}
                  >
                    Страницы
                  </button>
                </div>
              )}

              <button
                type="button"
                className={styles.compactToolsBtn}
                aria-label="Настройки чтения"
                onClick={() => {
                  setIsCompactToolsOpen((prev) => !prev)
                }}
              >
                Aa
              </button>

              <div className={`${styles.compactToolsPanel} ${isCompactToolsOpen ? styles.compactToolsPanelOpen : ""}`}>
                <div className={styles.themePickerCompact}>
                  <ThemeButtons theme={theme} onSelect={setTheme} getThemeDotClass={getThemeDotClass} />
                </div>
                <div className={styles.zoomGroupCompact}>
                  <button onClick={() => setFontSize((f) => Math.max(70, f - 10))}>A-</button>
                  <span className={styles.zoomVal}>{fontSize}%</span>
                  <button onClick={() => setFontSize((f) => Math.min(220, f + 10))}>A+</button>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      <section className={`${viewContentClass} ${styles.themeDark}`}>
        <div className={`${styles.immersiveTopHint} ${isUiHidden ? styles.visibleHint : ""}`} aria-hidden="true" />

        {!showHeader && showInlineThemePicker && (
          <div className={`${styles.inlineReaderTools} ${isUiHidden ? styles.inlineToolsHidden : ""}`}>
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
                <button
                  className={viewMode === "scrolled" ? styles.active : ""}
                  onClick={() => handleViewModeChange("scrolled")}
                >
                  Лента
                </button>
                <button
                  className={viewMode === "paginated" ? styles.active : ""}
                  onClick={() => handleViewModeChange("paginated")}
                >
                  Страницы
                </button>
              </div>
            )}
          </div>
        )}

        <AnimatePresence>
          <RemoteCursorOverlay remoteCursor={remoteCursor} />
        </AnimatePresence>

        {isPDF && (
          <PdfReaderView
            fontSize={fontSize}
            normalizedUrl={normalizedUrl}
            onContentScroll={handleContentScroll}
            onContentPointerDown={handleContentPointerDown}
            onContentDoubleClick={handleContentDoubleClick}
            onLoad={markContentReady}
          />
        )}

        {isEPUB && (
          <EpubReaderView
            scrollHostRef={scrollHostRef}
            viewerRef={viewerRef}
            epubClassName={epubClassName}
            viewMode={viewMode}
            onContentScroll={handleContentScroll}
            onContentPointerDown={handleContentPointerDown}
            onContentDoubleClick={handleContentDoubleClick}
            onPrevPage={handlePrevPage}
            onNextPage={handleNextPage}
          />
        )}

        <ReaderAnnotations
          menuPosition={menuPosition}
          selectionMenuRef={selectionMenuRef}
          selectedColor={selectedColor}
          selectionWeight={selectionWeight}
          getMenuColorClass={getMenuColorClass}
          onColorSelect={setSelectedColor}
          onToggleWeight={() => setSelectionWeight((prev) => (prev === "bold" ? "normal" : "bold"))}
          onDismissSelection={() => closeSelectionMenu(true)}
          onSaveHighlight={handleFinalizeHighlight}
        />
      </section>
    </div>
  )
}
