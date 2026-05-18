import type { HighlightWeight, ViewMode } from "./types"

export const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

const parseColorToRgb = (color: string): [number, number, number] | null => {
  const hexMatch = color.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i)
  if (hexMatch) {
    const value = hexMatch[1]

    if (value.length === 3) {
      const r = Number.parseInt(`${value[0]}${value[0]}`, 16)
      const g = Number.parseInt(`${value[1]}${value[1]}`, 16)
      const b = Number.parseInt(`${value[2]}${value[2]}`, 16)
      return [r, g, b]
    }

    const r = Number.parseInt(value.slice(0, 2), 16)
    const g = Number.parseInt(value.slice(2, 4), 16)
    const b = Number.parseInt(value.slice(4, 6), 16)
    return [r, g, b]
  }

  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i)
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
  }

  const rgbaMatch = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)$/i)
  if (rgbaMatch) {
    return [Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])]
  }

  return null
}

const boostContrast = (value: number) => (value >= 128 ? 255 : 0)

export const emphasizeColor = (color: string, fontWeight: HighlightWeight) => {
  const rgb = parseColorToRgb(color)
  if (!rgb) {
    return fontWeight === "bold" ? color : color
  }

  const [r, g, b] = rgb

  if (fontWeight !== "bold") {
    return `rgb(${r}, ${g}, ${b})`
  }

  return `rgb(${boostContrast(r)}, ${boostContrast(g)}, ${boostContrast(b)})`
}

export const getDefaultViewMode = (): ViewMode => {
  if (typeof window === "undefined") {
    return "paginated"
  }

  return window.matchMedia("(max-width: 1024px)").matches ? "scrolled" : "paginated"
}
