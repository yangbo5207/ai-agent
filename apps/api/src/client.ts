import { hc } from 'hono/client'
import type { AppType } from './app'

export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl)
}
