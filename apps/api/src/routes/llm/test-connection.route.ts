import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  BizCode,
  LlmTestConnectionRequestSchema,
  LlmTestConnectionResponseSchema,
  buildSuccess,
  type LlmTestConnectionRequest,
} from '@repo/contracts'
import { authUnauthorizedError } from '@/auth/errors'
import { buildValidationErrorHandler } from '@/auth/http'
import { verifyAccessToken } from '@/auth/jwt'
import type { ApiBindings } from '@/bindings'
import { getApiEnv } from '@/env'
import { createApiMeta } from '@/lib/api-meta'
import { AppError } from '@/lib/app-error'

const llmTestConnectionRoute = new Hono<{ Bindings: ApiBindings }>()

async function requireWebAccessToken(c: Context<{ Bindings: ApiBindings }>) {
  const authorization = c.req.header('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw authUnauthorizedError('Access token is required')
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token) {
    throw authUnauthorizedError('Access token is required')
  }

  try {
    return await verifyAccessToken({
      token,
      secret: getApiEnv(c.env).JWT_ACCESS_SECRET,
      expectedApp: 'web',
    })
  } catch {
    throw authUnauthorizedError('Access token is invalid')
  }
}

function buildEndpoint(config: LlmTestConnectionRequest['config']) {
  const url = new URL(config.baseURL)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'LLM Base URL is invalid', 400)
  }

  const baseURL = config.baseURL.replace(/\/$/, '')
  const suffix = config.wireApi === 'responses' ? '/responses' : '/chat/completions'

  return baseURL.endsWith(suffix) ? baseURL : `${baseURL}${suffix}`
}

function buildRequestBody(config: LlmTestConnectionRequest['config']) {
  const prompt = 'Reply with exactly: ok'

  if (config.wireApi === 'responses') {
    return {
      model: config.model,
      input: prompt,
      max_output_tokens: 16,
      ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
    }
  }

  return {
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 16,
    temperature: 0,
  }
}

async function getUpstreamErrorMessage(response: Response) {
  const text = await response.text().catch(() => '')

  if (!text) {
    return null
  }

  try {
    const body = JSON.parse(text) as { error?: { message?: string }; message?: string }
    return body.error?.message ?? body.message ?? null
  } catch {
    return text.slice(0, 240)
  }
}

llmTestConnectionRoute.post(
  '/',
  zValidator('json', LlmTestConnectionRequestSchema, buildValidationErrorHandler('Invalid LLM connection payload')),
  async (c) => {
    await requireWebAccessToken(c)

    const payload = c.req.valid('json')
    const startedAt = Date.now()
    const response = await fetch(buildEndpoint(payload.config), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${payload.config.apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(payload.config)),
    }).catch((error) => {
      throw new AppError(
        BizCode.SYSTEM_UPSTREAM_TIMEOUT,
        error instanceof Error ? error.message : 'LLM upstream request failed',
        504,
      )
    })

    if (!response.ok) {
      const upstreamMessage = await getUpstreamErrorMessage(response)

      throw new AppError(
        BizCode.SYSTEM_UPSTREAM_TIMEOUT,
        upstreamMessage ?? `LLM upstream failed, HTTP ${response.status}`,
        504,
      )
    }

    const res = LlmTestConnectionResponseSchema.parse({
      protocol: payload.config.wireApi,
      latencyMs: Date.now() - startedAt,
      upstreamStatus: response.status,
    })

    return c.json(buildSuccess(res, createApiMeta()))
  },
)

export default llmTestConnectionRoute
