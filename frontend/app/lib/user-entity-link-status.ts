export type UserEntityLinkStatus = 'active' | 'expired' | 'revoked'

export interface UserEntityLinkStatusInput {
  revoked_at: string | null
  expires_at: string | null
}

export function getUserEntityLinkStatus(link: UserEntityLinkStatusInput, nowMs: number = Date.now()): UserEntityLinkStatus {
  if (link.revoked_at) return 'revoked'
  if (link.expires_at && new Date(link.expires_at).getTime() <= nowMs) return 'expired'
  return 'active'
}
