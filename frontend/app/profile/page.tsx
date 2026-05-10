import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClientForRequest } from "@/lib/supabaseServer"
import DesktopTopActions from "@/app/components/DesktopTopActions/DesktopTopActions"
import styles from "./profile.module.scss"
import LastReadingSessionCard from "./LastReadingSessionCard"

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const supabaseServer = createSupabaseServerClientForRequest(cookieStore)

  const {
    data: { user },
  } = await supabaseServer.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <DesktopTopActions backHref="/books" className={styles.desktopActions} />
        <p className={styles.kicker}>Профиль</p>
        <h1 className={styles.title}>Ваш аккаунт</h1>
        <p className={styles.email}>{user.email}</p>

        <div className={styles.actions}>
          <Link href="/books" className={styles.linkBtn}>
            Открыть библиотеку
          </Link>
          <Link href="/readers" className={styles.linkBtn}>
            Читаем вместе
          </Link>
          <form action="/signout" method="post">
            <button className={styles.signoutBtn}>Выйти</button>
          </form>
        </div>

        <LastReadingSessionCard />
      </section>
    </main>
  )
}
