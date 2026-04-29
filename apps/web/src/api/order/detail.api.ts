import type {
  ApiResponse,
  OrderDetailRequest,
  OrderDetailResponse,
} from '@repo/contracts'
import { BizCode } from '@repo/contracts'
import { createJsonRequestInit, serverURL } from '@/api/client'

export async function postOrderDetail(
  payload: OrderDetailRequest,
): Promise<ApiResponse<OrderDetailResponse>> {
  try {
    const response = await fetch(
      serverURL('/rpc/order/detail'),
      createJsonRequestInit(payload),
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
