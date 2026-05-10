import { motion } from "framer-motion"
import styles from "../SharedReader.module.scss"
import type { SharedReaderProps } from "../lib/types"

export function RemoteCursorOverlay({ remoteCursor }: { remoteCursor: SharedReaderProps["remoteCursor"] }) {
  if (!remoteCursor) return null

  return (
    <motion.div
      key={remoteCursor.user}
      initial={{ opacity: 0, scale: 0.62, filter: "blur(6px)" }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        left: `${remoteCursor.x}%`,
        top: `${remoteCursor.y}%`,
      }}
      exit={{ opacity: 0, scale: 0.76, filter: "blur(4px)" }}
      transition={{
        left: { type: "spring", stiffness: 175, damping: 26, mass: 0.45 },
        top: { type: "spring", stiffness: 175, damping: 26, mass: 0.45 },
        opacity: { duration: 0.28 },
        scale: { type: "spring", stiffness: 220, damping: 20 },
      }}
      className={styles.cursorWrapper}
    >
      <motion.div
        className={styles.cursorTrail}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.18, 0.42, 0.18], scale: [0.86, 1.05, 0.86] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ opacity: [0.55, 0.92, 0.55], scale: [1, 1.14, 1] }}
        transition={{ repeat: Infinity, duration: 1.7, ease: "easeInOut" }}
        className={remoteCursor.isOwner ? styles.ownerPulse : styles.guestPulse}
      />
      <span className={styles.cursorLabel}>
        {remoteCursor.isOwner ? `Создатель: ${remoteCursor.user}` : remoteCursor.user}
      </span>
    </motion.div>
  )
}
