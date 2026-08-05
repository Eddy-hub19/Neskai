import { cookies } from "next/headers"
import styles from "@/app/home.module.scss"
import Link from "next/link"
import { createSupabaseServerClientForRequest } from "@/lib/supabaseServer"
import HomePresence from "@/app/components/HomePresence/HomePresence"
import { t } from "@/lib/i18n"

export default async function Home() {
  const cookieStore = await cookies()

  const supabaseServer = createSupabaseServerClientForRequest(cookieStore)

  const {
    data: { user },
  } = await supabaseServer.auth.getUser()

  return (
    <div className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Neskai</h1>
        <p className={styles.tagline}>{t("Будущее совместного чтения")}</p>

        {user ? (
          <div className={styles.authContent}>
            <HomePresence />

            {/* <div className={styles.userBadge}>
              <span className={styles.email}>{user.email}</span>
            </div> */}

            <div className={styles.buttonGroup}>
              <Link href="/books" className={styles.primaryBtn}>
                {t("Библиотека")}
              </Link>

              <Link href="/readers" className={styles.primaryBtn}>
                {t("Читать вместе")}
              </Link>

              <Link href="/profile" className={styles.primaryBtn}>
                {t("Профиль")}
              </Link>

              <form action="/signout" method="post">
                <button className={styles.secondaryBtn}>{t("Выйти")}</button>
              </form>
            </div>
          </div>
        ) : (
          <div className={styles.unauthContent}>
            <p className={styles.description}>
              {t("Исследуйте миры книг вместе. Выделяйте важные моменты, делитесь мыслями и читайте в реальном времени на ультра-современной платформе.")}
            </p>
            <Link href="/login" className={styles.primaryBtn}>
              {t("Начать путешествие →")}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
