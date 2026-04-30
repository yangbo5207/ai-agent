import type { OrderDetailRequest, OrderDetailResponse } from '@repo/contracts'
import { http } from '@/http'

export function postOrderDetail(payload: OrderDetailRequest) {
  return http.post<OrderDetailRequest, OrderDetailResponse>(
    '/rpc/order/detail',
    payload,
  )
}
