"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import styles from "./DesktopTopActions.module.scss"

type DesktopTopActionsProps = {
  backHref?: string
  backLabel?: string
  className?: string
}

export default function DesktopTopActions({ backHref, backLabel = "Назад", className = "" }: DesktopTopActionsProps) {
  const router = useRouter()

  return (
    <div className={`${styles.wrap} ${className}`.trim()}>
      <button
        type="button"
        className={styles.backBtn}
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back()
            return
          }

          router.push(backHref || "/")
        }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{backLabel}</span>
      </button>
    </div>
  )
}
