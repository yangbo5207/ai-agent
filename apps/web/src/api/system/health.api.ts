import type { HealthResponse } from '@repo/contracts'
import { http } from '@/http'

export function getHealth() {
  return http.get<HealthResponse>('/health')
}
