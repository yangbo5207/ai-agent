import type { BizCode } from './biz-code'

// meta 放请求级别的信息，data/error 放业务结果本身。
export type ApiMeta = {
  requestId: string
  timestamp: string
}

export type ApiSuccess<T> = {
  ok: true
  data: T
  meta: ApiMeta
}

export type ApiError = {
  code: BizCode
  message: string
  details?: unknown
}

export type ApiFailure = {
  ok: false
  error: ApiError
  meta: ApiMeta
}

// 所有接口最终都落在 success 或 failure 这两个分支里。
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

// 这两个 helper 只是统一拼装响应结构，调用方不用每次手写 ok/data/meta。
export function buildSuccess<T>(data: T, meta: ApiMeta): ApiSuccess<T> {
  return {
    ok: true,
    data,
    meta,
  }
}

export function buildFailure(
  error: ApiError,
  meta: ApiMeta,
): ApiFailure {
  return {
    ok: false,
    error,
    meta,
  }
}
