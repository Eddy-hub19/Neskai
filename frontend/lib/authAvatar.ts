interface IdentityData {
  avatar_url?: string
  picture?: string
  profile_image_url?: string
}

interface IdentityLike {
  provider?: string
  identity_data?: IdentityData | null
}

interface UserLike {
  user_metadata?: IdentityData | null
  identities?: IdentityLike[] | null
}

const pickIdentityAvatar = (identity?: IdentityLike) => {
  const identityData = identity?.identity_data
  return identityData?.avatar_url || identityData?.picture || identityData?.profile_image_url || null
}

export const getSupabaseGoogleAvatar = (user: UserLike | null | undefined) => {
  if (!user) return null

  const identities = user.identities ?? []
  const googleIdentity = identities.find((identity) => identity.provider === "google")
  const googleAvatar = pickIdentityAvatar(googleIdentity)

  if (googleAvatar) {
    return googleAvatar
  }

  const metadataAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || user.user_metadata?.profile_image_url
  if (metadataAvatar) {
    return metadataAvatar
  }

  const firstIdentityAvatar = identities.map((identity) => pickIdentityAvatar(identity)).find(Boolean)
  return firstIdentityAvatar ?? null
}
