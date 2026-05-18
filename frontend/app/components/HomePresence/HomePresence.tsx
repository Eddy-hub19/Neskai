"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { getSupabaseGoogleAvatar } from "@/lib/authAvatar"
import styles from "./HomePresence.module.scss"

const APP_PRESENCE_CHANNEL = "global-library"
const MAX_VISIBLE_USERS = 6

interface PresencePayload {
  user_id?: string
  user_name?: string
  user_email?: string
  avatar_url?: string
  google_avatar_url?: string
  online_at?: string
  presence_ref?: string
}

interface PresenceUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  onlineAt: number
}

const toTimestamp = (value?: string) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const hashString = (value: string) => {
  let hash = 0

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }

  return Math.abs(hash)
}

const getRandomAvatarUrl = (seed: string) => {
  const variant = (hashString(seed) % 12) + 1
  return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundType=gradientLinear&backgroundRotation=${variant * 30}`
}

const resolveAvatarSrc = (participant: PresenceUser) => participant.avatarUrl || getRandomAvatarUrl(participant.id)

export default function HomePresence() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    let isMounted = true

    const loadCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted) return
      setCurrentUserId(user?.id ?? null)
    }

    void loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase.channel(APP_PRESENCE_CHANNEL)

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresencePayload[]>
        const flattened = Object.values(state).flatMap((items) => items ?? [])

        const deduped = new Map<string, PresenceUser>()

        for (const participant of flattened) {
          const id = participant.user_id ?? participant.presence_ref
          if (!id) continue

          const name = participant.user_name || participant.user_email || "Reader"
          const email = participant.user_email || participant.user_name || "Reader"
          const candidate: PresenceUser = {
            id,
            name,
            email,
            avatarUrl: participant.avatar_url || participant.google_avatar_url || null,
            onlineAt: toTimestamp(participant.online_at),
          }

          const existing = deduped.get(id)
          if (!existing || existing.onlineAt <= candidate.onlineAt) {
            deduped.set(id, candidate)
          }
        }

        const sortedUsers = Array.from(deduped.values()).sort((a, b) => b.onlineAt - a.onlineAt)
        setOnlineUsers(sortedUsers)
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const googleAvatar = getSupabaseGoogleAvatar(user)

        await channel.track({
          user_id: user.id,
          user_name: user.email,
          user_email: user.email,
          avatar_url: googleAvatar,
          google_avatar_url: googleAvatar,
          online_at: new Date().toISOString(),
        })
      })

    return () => {
      channel.unsubscribe()
    }
  }, [currentUserId])

  const visibleUsers = useMemo(() => onlineUsers.slice(0, MAX_VISIBLE_USERS), [onlineUsers])
  const hiddenCount = onlineUsers.length > MAX_VISIBLE_USERS ? onlineUsers.length - MAX_VISIBLE_USERS : 0

  return (
    <section className={styles.presenceContainer}>
      <div className={styles.presenceHeader}>
        <span className={styles.pulseDot}></span>
        <p className={styles.presenceTitle}>Сейчас читают</p>
      </div>

      <div className={styles.avatarRow}>
        {visibleUsers.map((participant) => {
          const isCurrentUser = participant.id === currentUserId
          const shortName = participant.email.split("@")[0]

          return (
            <div key={participant.id} className={`${styles.avatarWrapper} ${isCurrentUser ? styles.isCurrent : ""}`}>
              <Image
                src={resolveAvatarSrc(participant)}
                alt={participant.name}
                className={styles.avatarImage}
                width={40}
                height={40}
                sizes="40px"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  if (event.currentTarget.dataset.fallbackApplied === "1") {
                    return
                  }
                  event.currentTarget.dataset.fallbackApplied = "1"
                  event.currentTarget.src = getRandomAvatarUrl(participant.id)
                }}
              />
              <div className={styles.tooltip}>
                <span className={styles.tooltipName}>{shortName}</span>
                <span className={styles.tooltipEmail}>{participant.email}</span>
              </div>
            </div>
          )
        })}

        {hiddenCount > 0 && (
          <div className={styles.moreBadge}>
            <span>+{hiddenCount}</span>
          </div>
        )}
      </div>
    </section>
  )
}
