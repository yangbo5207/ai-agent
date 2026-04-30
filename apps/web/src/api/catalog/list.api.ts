import type { CatalogListResponse } from '@repo/contracts'
import { http } from '@/http'

export function getCatalogList() {
  return http.get<CatalogListResponse>('/rpc/catalog/list')
}
