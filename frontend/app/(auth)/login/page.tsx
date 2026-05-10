"use client"

import styles from "@/app/(auth)/login/login.module.scss"
import { supabase } from "@/lib/supabase"
import Image from "next/image"

export default function LoginPage() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error("OAuth start failed:", error.message)
      window.location.assign(`/login?error=oauth-start-failed&reason=${encodeURIComponent(error.message)}`)
    }
  }

  return (
    <main className={styles.container}>
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

          <button className={styles.googleBtn} onClick={() => void handleLogin()}>
            <Image src="/icon-google.svg" className={styles.icon} width={20} height={20} alt="Google" />
            <span>Продолжить с Google</span>
          </button>
        </div>

        <footer className={styles.footer}>Безопасная авторизация через Supabase</footer>
      </div>
    </main>
  )
}
