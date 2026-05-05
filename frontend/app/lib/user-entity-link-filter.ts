import { getUserEntityLinkStatus, type UserEntityLinkStatus, type UserEntityLinkStatusInput } from './user-entity-link-status'

export type UserEntityLinkRole = 'viewer' | 'trader' | 'entity_admin'

export interface UserEntityLinkFilterable extends UserEntityLinkStatusInput {
  entity_role: UserEntityLinkRole
}

export interface UserEntityLinkFilterOptions {
  showActiveOnly: boolean
  status: 'all' | UserEntityLinkStatus
  role: 'all' | UserEntityLinkRole
}

export function filterUserEntityLinks<T extends UserEntityLinkFilterable>(
  links: T[],
  options: UserEntityLinkFilterOptions,
): T[] {
  return links.filter((link) => {
    const status = getUserEntityLinkStatus(link)

    if (options.showActiveOnly && status !== 'active') {
      return false
    }

    if (options.status !== 'all' && status !== options.status) {
      return false
    }

    if (options.role !== 'all' && link.entity_role !== options.role) {
      return false
    }

    return true
  })
}
