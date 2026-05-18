import { memo, type PointerEvent, type RefObject } from "react"
import { motion } from "framer-motion"
import styles from "../SharedReader.module.scss"
import { MENU_COLORS, MENU_COLOR_VALUES } from "../lib/constants"
import type { HighlightWeight, MenuColorKey, SelectionMenuPosition } from "../lib/types"

type SelectionMenuProps = {
  menuPosition: SelectionMenuPosition
  selectedColor: string
  selectionWeight: HighlightWeight
  onColorSelect: (color: string) => void
  onToggleWeight: () => void
  onSave: () => void
  getMenuColorClass: (key: MenuColorKey) => string
  selectionMenuRef: RefObject<HTMLDivElement | null>
}

export const SelectionMenu = memo(function SelectionMenu({
  menuPosition,
  selectedColor,
  selectionWeight,
  onColorSelect,
  onToggleWeight,
  onSave,
  getMenuColorClass,
  selectionMenuRef,
}: SelectionMenuProps) {
  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <motion.div
      ref={selectionMenuRef}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className={styles.selectionMenu}
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onPointerDown={handlePointerDown}
    >
      <div className={styles.colorRow}>
        {MENU_COLORS.map((key) => {
          const colorValue = MENU_COLOR_VALUES[key]
          return (
            <button
              type="button"
              key={key}
              className={`${styles.colorCircle} ${getMenuColorClass(key)} ${selectedColor === colorValue ? styles.activeColor : ""}`}
              onPointerDown={(e) => {
                handlePointerDown(e)
              }}
              onPointerUp={(e) => {
                handlePointerDown(e)
                onColorSelect(colorValue)
              }}
            />
          )
        })}
      </div>

      <div className={styles.divider} />

      <button
        type="button"
        className={`${styles.textBtn} ${selectionWeight === "bold" ? styles.activeTextBtn : ""}`}
        onPointerDown={(e) => {
          handlePointerDown(e)
        }}
        onPointerUp={(e) => {
          handlePointerDown(e)
          onToggleWeight()
        }}
      >
        B
      </button>

      <div className={styles.divider} />

      <button
        type="button"
        className={`${styles.textBtn} ${styles.saveBtn}`}
        onPointerDown={(e) => {
          handlePointerDown(e)
        }}
        onPointerUp={(e) => {
          handlePointerDown(e)
          onSave()
        }}
      >
        Выделить
      </button>
    </motion.div>
  )
})
