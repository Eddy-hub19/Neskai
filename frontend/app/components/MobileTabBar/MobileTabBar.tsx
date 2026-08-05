"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenText, CircleUserRound, UsersRound } from "lucide-react"
import styles from "@/app/components/MobileTabBar/MobileTabBar.module.scss"

import { t } from "@/lib/i18n"

const navItems = [
  {
    href: "/books",
    label: t("Библиотека"),
    icon: BookOpenText,
    match: (pathname: string) => pathname === "/books",
  },
  {
    href: "/readers",
    label: t("Читаем вместе"),
    icon: UsersRound,
    match: (pathname: string) => pathname === "/readers",
  },
  {
    href: "/profile",
    label: t("Профиль"),
    icon: CircleUserRound,
    match: (pathname: string) => pathname === "/profile",
  },
]

const visibleOnRoutes = new Set(["/books", "/readers", "/profile"])

export default function MobileTabBar() {
  const pathname = usePathname() || ""

  if (!visibleOnRoutes.has(pathname)) {
    return null
  }

  return (
    <nav className={styles.tabBar}>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = item.match(pathname)

        return (
          <Link key={item.href} href={item.href} className={`${styles.tabItem} ${isActive ? styles.active : ""}`}>
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
