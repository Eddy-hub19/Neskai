import type { MenuColorKey, ThemeKey } from "./types"

export const THEMES = {
  dark: { bg: "#0f0f0f", fg: "#ffffff" },
  sepia: { bg: "#1a1814", fg: "#f0e6d2" },
  gray: { bg: "#161618", fg: "#eeeeee" },
} satisfies Record<ThemeKey, { bg: string; fg: string }>

export const THEME_KEYS: ThemeKey[] = ["dark", "sepia", "gray"]

export const MENU_COLORS: MenuColorKey[] = ["mint", "blue", "rose", "gold"]

export const MENU_COLOR_VALUES: Record<MenuColorKey, string> = {
  mint: "rgba(74, 222, 128, 0.93)",
  blue: "rgba(26, 117, 228, 0.9)",
  rose: "rgba(223, 59, 59, 0.94)",
  gold: "rgba(240, 196, 21, 0.97)",
}
