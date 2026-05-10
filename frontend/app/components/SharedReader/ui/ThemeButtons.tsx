import styles from "../SharedReader.module.scss"
import { THEME_KEYS } from "../lib/constants"
import type { ThemeKey } from "../lib/types"

type ThemeButtonsProps = {
  theme: ThemeKey
  onSelect: (theme: ThemeKey) => void
  getThemeDotClass: (key: ThemeKey) => string
}

export function ThemeButtons({ theme, onSelect, getThemeDotClass }: ThemeButtonsProps) {
  return THEME_KEYS.map((key) => (
    <button
      key={key}
      className={`${styles.themeDot} ${getThemeDotClass(key)} ${theme === key ? styles.activeDot : ""}`}
      onClick={() => onSelect(key)}
    />
  ))
}
