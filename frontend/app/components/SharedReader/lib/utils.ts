import type { HighlightWeight, ViewMode } from "./types"

export const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

export const emphasizeColor = (color: string, fontWeight: HighlightWeight) => {
  if (fontWeight !== "bold") {
    return color
  }

  const rgbaMatch = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)$/i)
  if (!rgbaMatch) {
    return color
  }

  const [, r, g, b, a] = rgbaMatch
  const alpha = Math.min(0.85, Number(a) + 0.2)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const getDefaultViewMode = (): ViewMode => {
  if (typeof window === "undefined") {
    return "paginated"
  }

  return window.matchMedia("(max-width: 1024px)").matches ? "scrolled" : "paginated"
}
