"use client"

import { useCallback, useEffect, useState, type PointerEvent, type RefObject } from "react"
import { AnimatePresence } from "framer-motion"
import { SelectionMenu } from "./ui/SelectionMenu"
import { MENU_COLORS, MENU_COLOR_VALUES } from "./lib/constants"
import styles from "./SharedReader.module.scss"
import type { HighlightWeight, MenuColorKey, SelectionMenuPosition } from "./lib/types"

type ReaderAnnotationsProps = {
  menuPosition: SelectionMenuPosition | null
  selectionMenuRef: RefObject<HTMLDivElement | null>
  selectedColor: string
  selectionWeight: HighlightWeight
  getMenuColorClass: (key: MenuColorKey) => string
  onColorSelect: (color: string) => void
  onToggleWeight: () => void
  onDismissSelection: () => void
  onSaveHighlight: () => void
}

export default function ReaderAnnotations({
  menuPosition,
  selectionMenuRef,
  selectedColor,
  selectionWeight,
  getMenuColorClass,
  onColorSelect,
  onToggleWeight,
  onDismissSelection,
  onSaveHighlight,
}: ReaderAnnotationsProps) {
  const [isMobile, setIsMobile] = useState(false)

  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const applyMatch = () => setIsMobile(mediaQuery.matches)

    applyMatch()
    mediaQuery.addEventListener("change", applyMatch)

    return () => {
      mediaQuery.removeEventListener("change", applyMatch)
    }
  }, [])

  return (
    <>
      <AnimatePresence>
        {menuPosition && !isMobile && (
          <SelectionMenu
            menuPosition={menuPosition}
            selectedColor={selectedColor}
            selectionWeight={selectionWeight}
            onColorSelect={onColorSelect}
            onToggleWeight={onToggleWeight}
            onSave={onSaveHighlight}
            getMenuColorClass={getMenuColorClass}
            selectionMenuRef={selectionMenuRef}
          />
        )}
      </AnimatePresence>

      {menuPosition && isMobile && (
        <div className={styles.mobileSelectionDock} ref={selectionMenuRef}>
          <button
            type="button"
            className={styles.mobileSelectionClose}
            onPointerDown={(event) => {
              handlePointerDown(event)
            }}
            onPointerUp={(event) => {
              handlePointerDown(event)
              onDismissSelection()
            }}
            aria-label="Закрыть меню"
          >
            ✕
          </button>

          <div className={styles.colorRow}>
            {MENU_COLORS.map((key) => {
              const colorValue = MENU_COLOR_VALUES[key]
              return (
                <button
                  type="button"
                  key={key}
                  className={`${styles.colorCircle} ${getMenuColorClass(key)} ${selectedColor === colorValue ? styles.activeColor : ""}`}
                  onPointerDown={(event) => {
                    handlePointerDown(event)
                  }}
                  onPointerUp={(event) => {
                    handlePointerDown(event)
                    onColorSelect(colorValue)
                  }}
                />
              )
            })}
          </div>

          <div className={styles.divider} />

          <div className={styles.mobileSelectionActions}>
            <button
              type="button"
              className={`${styles.textBtn} ${selectionWeight === "bold" ? styles.activeTextBtn : ""}`}
              onPointerDown={(event) => {
                handlePointerDown(event)
              }}
              onPointerUp={(event) => {
                handlePointerDown(event)
                onToggleWeight()
              }}
            >
              B
            </button>
            <button
              type="button"
              className={`${styles.textBtn} ${styles.saveBtn}`}
              onPointerDown={(event) => {
                handlePointerDown(event)
              }}
              onPointerUp={(event) => {
                handlePointerDown(event)
                onSaveHighlight()
              }}
            >
              Выделить
            </button>
          </div>
        </div>
      )}
    </>
  )
}
