"use client"

import { useEffect } from "react"
import Lottie from "lottie-react"
import { AnimatePresence, motion } from "framer-motion"
import styles from "./ReactionBurst.module.scss"
import type { ReactionType } from "../lib/types"

type Burst = {
  id: string
  x: number
  y: number
  type: ReactionType
}

type ReactionBurstProps = {
  bursts: Burst[]
  onAnimationEnd: (id: string) => void
}

const reactionIconMap: Record<ReactionType, string> = {
  sparkles: "✦",
  feather: "〰",
  heart: "♡",
}

const reactionLabelMap: Record<ReactionType, string> = {
  sparkles: "Sparkles",
  feather: "Feather",
  heart: "Heart",
}

const LUXURY_REACTION_ANIMATIONS: Partial<Record<ReactionType, object>> = {}

export function ReactionBurst({ bursts, onAnimationEnd }: ReactionBurstProps) {
  useEffect(() => {
    if (bursts.length === 0) return

    const timers = bursts.map((burst) =>
      window.setTimeout(() => {
        onAnimationEnd(burst.id)
      }, 900),
    )

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [bursts, onAnimationEnd])

  return (
    <AnimatePresence>
      {bursts.map((burst) => {
        const animationData = LUXURY_REACTION_ANIMATIONS[burst.type]

        return (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, y: 12, scale: 0.88 }}
            animate={{ opacity: 1, y: -4, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 1.04 }}
            transition={{ duration: 0.28 }}
            className={styles.burst}
            style={{ left: burst.x, top: burst.y }}
            aria-label={reactionLabelMap[burst.type]}
          >
            {animationData ? (
              <Lottie animationData={animationData} loop={false} autoplay className={styles.lottie} />
            ) : (
              <span className={styles.fallback}>{reactionIconMap[burst.type]}</span>
            )}
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}
