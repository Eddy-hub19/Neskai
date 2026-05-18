import { useCallback, useEffect, useRef, useState } from "react"

type UseImmersiveModeOptions = {
  threshold?: number
  idleMs?: number
  autoRevealOnIdle?: boolean
}

export const useImmersiveMode = ({
  threshold = 50,
  idleMs = 1200,
  autoRevealOnIdle = true,
}: UseImmersiveModeOptions = {}) => {
  const [isHidden, setIsHidden] = useState(false)
  const lastScrollTopRef = useRef(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearIdleTimer = useCallback(() => {
    if (!idleTimerRef.current) return
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }, [])

  const revealUi = useCallback(() => {
    setIsHidden(false)
  }, [])

  const toggleUi = useCallback(() => {
    setIsHidden((prev) => !prev)
  }, [])

  const reset = useCallback(() => {
    clearIdleTimer()
    lastScrollTopRef.current = 0
    setIsHidden(false)
  }, [clearIdleTimer])

  const handleScrollTop = useCallback(
    (nextScrollTop: number) => {
      const scrollTop = Math.max(0, nextScrollTop)
      const prevScrollTop = lastScrollTopRef.current
      const isScrollingDown = scrollTop > prevScrollTop
      const isScrollingUp = scrollTop < prevScrollTop

      if (isScrollingDown && scrollTop > threshold) {
        setIsHidden(true)
      } else if (isScrollingUp) {
        setIsHidden(false)
      }

      lastScrollTopRef.current = scrollTop

      if (!autoRevealOnIdle) return

      clearIdleTimer()
      idleTimerRef.current = setTimeout(() => {
        setIsHidden(false)
      }, idleMs)
    },
    [autoRevealOnIdle, clearIdleTimer, idleMs, threshold],
  )

  useEffect(() => {
    return () => {
      clearIdleTimer()
    }
  }, [clearIdleTimer])

  return {
    isHidden,
    handleScrollTop,
    revealUi,
    toggleUi,
    reset,
  }
}
