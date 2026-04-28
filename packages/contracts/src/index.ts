import { z } from 'zod'

// 业务异常码给前后端共用，避免接口报错时双方各写一套字符串。
export const BizCode = {
  COMMON_INVALID_REQUEST: 'COMMON.INVALID_REQUEST',
  COMMON_NOT_FOUND: 'COMMON.NOT_FOUND',
  AUTH_UNAUTHORIZED: 'AUTH.UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH.FORBIDDEN',
  BIZ_CONFLICT: 'BIZ.CONFLICT',
  BIZ_RULE_VIOLATION: 'BIZ.RULE_VIOLATION',
  SYSTEM_INTERNAL_ERROR: 'SYSTEM.INTERNAL_ERROR',
  SYSTEM_UPSTREAM_TIMEOUT: 'SYSTEM.UPSTREAM_TIMEOUT',
} as const

export type BizCode = (typeof BizCode)[keyof typeof BizCode]

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

// zod schema 负责运行时校验，请求进来时真的会检查字段是否合法。
export const PingRequestSchema = z.object({
  name: z.string().trim().min(1),
})

// infer 会直接从 schema 推导 TS 类型，这样类型和校验规则始终是一份来源。
export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingResponseSchema = z.object({
  service: z.literal('api'),
  message: z.string(),
})

export type PingResponse = z.infer<typeof PingResponseSchema>

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
