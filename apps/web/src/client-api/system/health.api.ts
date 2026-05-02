import type { ApiResponse, HealthResponse } from '@repo/contracts'
import { http } from '@/http'

export function getClientHealth() {
  return http.get<HealthResponse>('/health') as Promise<ApiResponse<HealthResponse>>
}
