"use client"

import styles from "@/app/(auth)/login/login.module.scss"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const OAUTH_IN_FLIGHT_KEY = "neskai:oauth-in-flight"
const OAUTH_IN_FLIGHT_TTL_MS = 60_000

export default function LoginPage() {
  const [isStartingOAuth, setIsStartingOAuth] = useState(false)
  const loginInProgressRef = useRef(false)

  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        window.location.replace("/books")
      }
    }

    try {
      const inFlightRaw = window.sessionStorage.getItem(OAUTH_IN_FLIGHT_KEY)
      if (inFlightRaw) {
        const startedAt = Number(inFlightRaw)
        if (!Number.isFinite(startedAt) || Date.now() - startedAt > OAUTH_IN_FLIGHT_TTL_MS) {
          window.sessionStorage.removeItem(OAUTH_IN_FLIGHT_KEY)
        }
      }
    } catch {
      // Ignore storage access errors in restrictive browser modes.
    }

    void checkExistingSession()
  }, [])

  const handleLogin = async () => {
    if (loginInProgressRef.current || isStartingOAuth) return

    try {
      const inFlightRaw = window.sessionStorage.getItem(OAUTH_IN_FLIGHT_KEY)
      if (inFlightRaw) {
        const startedAt = Number(inFlightRaw)
        if (Number.isFinite(startedAt) && Date.now() - startedAt < OAUTH_IN_FLIGHT_TTL_MS) {
          return
        }
      }
    } catch {
      // Ignore storage access errors and continue guarded by in-memory flag.
    }

    loginInProgressRef.current = true
    setIsStartingOAuth(true)

    try {
      window.sessionStorage.setItem(OAUTH_IN_FLIGHT_KEY, String(Date.now()))
    } catch {
      // Ignore storage access errors.
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      loginInProgressRef.current = false
      setIsStartingOAuth(false)

      try {
        window.sessionStorage.removeItem(OAUTH_IN_FLIGHT_KEY)
      } catch {
        // Ignore storage access errors.
      }

      console.error("OAuth start failed:", error.message)
      window.location.assign(`/login?error=oauth-start-failed&reason=${encodeURIComponent(error.message)}`)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.ambientGlow}></div>

      <div className={styles.loginCard}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Neskai</h1>
          <p className={styles.subtitle}>Вход в систему</p>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Авторизуйтесь, чтобы получить доступ к своей библиотеке и функциям совместного чтения.
          </p>

          <button className={styles.googleBtn} onClick={() => void handleLogin()} disabled={isStartingOAuth}>
            <Image src="/icon-google.svg" className={styles.icon} width={20} height={20} alt="Google" />
            <span>{isStartingOAuth ? "Подключаем Google..." : "Продолжить с Google"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
