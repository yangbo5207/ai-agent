import type {
  ApiResponse,
  CatalogListResponse,
} from '@repo/contracts'
import { BizCode } from '@repo/contracts'
import { createJsonRequestInit, serverURL } from '@/api/client'

export async function getCatalogList(): Promise<ApiResponse<CatalogListResponse>> {
  try {
    const response = await fetch(
      serverURL('/rpc/catalog/list'),
      createJsonRequestInit(),
    )

    return await response.json()
  } catch (error) {
    return {
      ok: false,
      error: {
        code: BizCode.SYSTEM_UPSTREAM_TIMEOUT,
        message: error instanceof Error ? error.message : 'API request failed',
      },
      meta: {
        requestId: 'unavailable',
        timestamp: new Date().toISOString(),
      },
    }
  }
}
