import type { RefObject } from "react"
import { motion } from "framer-motion"
import styles from "../SharedReader.module.scss"
import { MENU_COLORS, MENU_COLOR_VALUES } from "../lib/constants"
import type { HighlightWeight, MenuColorKey, ReactionType, SelectionMenuPosition } from "../lib/types"

type SelectionMenuProps = {
  menuPosition: SelectionMenuPosition
  selectedColor: string
  selectionWeight: HighlightWeight
  onColorSelect: (color: string) => void
  onToggleWeight: () => void
  onSave: () => void
  onAddThought: () => void
  onQuickReaction: (reaction: ReactionType) => void
  getMenuColorClass: (key: MenuColorKey) => string
  selectionMenuRef: RefObject<HTMLDivElement | null>
}

export function SelectionMenu({
  menuPosition,
  selectedColor,
  selectionWeight,
  onColorSelect,
  onToggleWeight,
  onSave,
  onAddThought,
  onQuickReaction,
  getMenuColorClass,
  selectionMenuRef,
}: SelectionMenuProps) {
  return (
    <motion.div
      ref={selectionMenuRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className={styles.selectionMenu}
      style={{ left: menuPosition.x, top: menuPosition.y }}
    >
      <div className={styles.colorRow}>
        {MENU_COLORS.map((key) => {
          const colorValue = MENU_COLOR_VALUES[key]
          return (
            <button
              key={key}
              className={`${styles.colorCircle} ${getMenuColorClass(key)} ${selectedColor === colorValue ? styles.activeColor : ""}`}
              onClick={() => onColorSelect(colorValue)}
            />
          )
        })}
      </div>

      <div className={styles.divider} />

      <button className={`${styles.textBtn} ${selectionWeight === "bold" ? styles.activeTextBtn : ""}`} onClick={onToggleWeight}>
        B
      </button>

      <div className={styles.divider} />

      <button className={`${styles.textBtn} ${styles.saveBtn}`} onClick={onSave}>
        Выделить
      </button>

      <button className={`${styles.textBtn} ${styles.thoughtBtn}`} onClick={onAddThought}>
        Добавить мысль
      </button>

      <div className={styles.reactionRow}>
        <button className={styles.reactionBtn} onClick={() => onQuickReaction("sparkles")}>
          ✦
        </button>
        <button className={styles.reactionBtn} onClick={() => onQuickReaction("feather")}>
          〰
        </button>
        <button className={styles.reactionBtn} onClick={() => onQuickReaction("heart")}>
          ♡
        </button>
      </div>
    </motion.div>
  )
}
