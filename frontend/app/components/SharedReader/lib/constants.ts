import type { MenuColorKey, ThemeKey } from "./types"

export const THEMES = {
  dark: { bg: "#0f0f0f", color: "#ffffff" },
  sepia: { bg: "#1a1814", color: "#f0e6d2" },
  gray: { bg: "#161618", color: "#eeeeee" },
} satisfies Record<ThemeKey, { bg: string; color: string }>

export const THEME_KEYS: ThemeKey[] = ["dark", "sepia", "gray"]

export const MENU_COLORS: MenuColorKey[] = ["mint", "blue", "rose", "gold"]

export const MENU_COLOR_VALUES: Record<MenuColorKey, string> = {
  mint: "#0b8659",
  blue: "#0675fd",
  rose: "#f1082b",
  gold: "#edc810",
}
