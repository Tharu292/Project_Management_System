import { apiRequest } from '../../../api/client'
import type { MyGroup } from './types'

/**
 * The signed-in user's own project groups. The backend takes the user from
 * the access token; there is no way to ask about anyone else.
 */
export function getMyGroups(): Promise<MyGroup[]> {
  return apiRequest<MyGroup[]>('/api/v1/c4/me/groups', { auth: true })
}
