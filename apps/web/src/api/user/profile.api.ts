import type { UserProfileResponse } from '@repo/contracts'
import { http } from '@/http'

export function getUserProfile() {
  return http.get<UserProfileResponse>('/rpc/user/profile')
}
