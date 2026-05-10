import { cookies } from "next/headers"
import styles from "@/app/home.module.scss"
import Link from "next/link"
import { createSupabaseServerClientForRequest } from "@/lib/supabaseServer"
import HomePresence from "@/app/components/HomePresence/HomePresence"

export default async function Home() {
  const cookieStore = await cookies()

  const supabaseServer = createSupabaseServerClientForRequest(cookieStore)

  const {
    data: { user },
  } = await supabaseServer.auth.getUser()

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Neskai</h1>
        <p className={styles.tagline}>Future of Collaborative Reading</p>

        {user ? (
          <div className={styles.authContent}>
            <HomePresence />

            <div className={styles.userBadge}>
              <span className={styles.email}>{user.email}</span>
            </div>

            <div className={styles.buttonGroup}>
              <Link href="/books" className={styles.primaryBtn}>
                Open Library
              </Link>

              <Link href="/readers" className={styles.primaryBtn}>
                Reading together
              </Link>

              <Link href="/profile" className={styles.primaryBtn}>
                Profile
              </Link>

              <form action="/signout" method="post">
                <button className={styles.secondaryBtn}>Sign Out</button>
              </form>
            </div>
          </div>
        ) : (
          <div className={styles.unauthContent}>
            <p className={styles.description}>
              Explore the worlds of books together. Highlight important points, share thoughts, and read in real-time on
              an ultra-futuristic platform.
            </p>
            <Link href="/login" className={styles.primaryBtn}>
              Start your journey →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
