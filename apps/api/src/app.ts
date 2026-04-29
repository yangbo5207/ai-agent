import {
  BizCode,
  PingRequestSchema,
  buildFailure,
  buildSuccess,
  type ApiMeta,
} from '@repo/contracts'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getApiEnv } from './env'

type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 504

type Bindings = {
  APP_ENV: 'development' | 'test' | 'production'
}

class AppError extends Error {
  constructor(
    readonly code: BizCode,
    message: string,
    readonly status: AppErrorStatus,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

const app = new Hono<{ Bindings: Bindings }>()

function createMeta(): ApiMeta {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

app.onError((error, c) => {
  const meta = createMeta()

  if (error instanceof AppError) {
    const res = {
      code: error.code,
      message: error.message,
      details: error.details,
    }

    return c.json(buildFailure(res, meta), error.status)
  }

  if (error instanceof HTTPException) {
    const res = {
      code: BizCode.COMMON_INVALID_REQUEST,
      message: error.message,
    }

    return c.json(buildFailure(res, meta), error.status)
  }

  console.error(error)

  const res = {
    code: BizCode.SYSTEM_INTERNAL_ERROR,
    message: 'Internal server error',
  }

  return c.json(buildFailure(res, meta), 500)
})

app.notFound((c) => {
  const res = {
    code: BizCode.COMMON_NOT_FOUND,
    message: 'Not found',
  }

  return c.json(buildFailure(res, createMeta()), 404)
})

const routes = app
  .get('/health', (c) => {
    const env = getApiEnv(c.env)
    const res = {
      service: 'api',
      env: env.APP_ENV,
    }

    return c.json(buildSuccess(res, createMeta()))
  })
  .post('/rpc/system/ping', zValidator('json', PingRequestSchema, (result, c) => {
      if (result.success) {
        return
      }

      const res = {
        code: BizCode.COMMON_INVALID_REQUEST,
        message: 'Invalid request payload',
        details: result.error.issues,
      }

      return c.json(buildFailure(res, createMeta()), 400)
    }),
    (c) => {
      const payload = c.req.valid('json')
      const env = getApiEnv(c.env)
      const res = {
        service: 'api',
        message: `pong, ${payload.name}`,
        env: env.APP_ENV,
      }

      return c.json(buildSuccess(res, createMeta()))
    },
  )

export type AppType = typeof routes

export default app
