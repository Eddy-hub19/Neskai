export type ThemeKey = "dark" | "sepia" | "gray"
export type ViewMode = "scrolled" | "paginated"
export type HighlightWeight = "normal" | "bold"

export type Highlight = {
  cfiRange: string
  color: string
  fontWeight?: HighlightWeight
}

export type SelectionMenuPosition = {
  x: number
  y: number
}

export type MenuColorKey = "mint" | "blue" | "rose" | "gold"

export type SharedReaderProps = {
  bookUrl: string
  bookTitle?: string
  onBack?: () => void
  closeHref?: string
  showHeader?: boolean
  showInlineThemePicker?: boolean
  myHighlightColor?: string
  incomingCfi?: string | null
  onLocationChange?: (cfi: string) => void
  highlights?: Highlight[]
  incomingHighlight?: Highlight | null
  onHighlightCreate?: (payload: Highlight) => void
  remoteCursor?: { x: number; y: number; user: string; isOwner: boolean } | null
  onCursorMove?: (payload: { cfi: string | null; x: number; y: number }) => void
  onContentReady?: () => void
}
