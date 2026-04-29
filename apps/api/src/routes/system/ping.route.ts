import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
  BizCode,
  PingRequestSchema,
  buildFailure,
  buildSuccess,
  type PingResponse,
} from '@repo/contracts'
import { getApiEnv } from '../../env'

type Bindings = {
  APP_ENV: 'development' | 'test' | 'production'
}

const pingRoute = new Hono<{ Bindings: Bindings }>()

pingRoute.post(
  '/',
  zValidator('json', PingRequestSchema, (result, c) => {
    if (result.success) {
      return
    }

    const res = {
      code: BizCode.COMMON_INVALID_REQUEST,
      message: 'Invalid request payload',
      details: result.error.issues,
    }

    return c.json(
      buildFailure(res, {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }),
      400,
    )
  }),
  (c) => {
    const payload = c.req.valid('json')
    const env = getApiEnv(c.env)
    const res: PingResponse = {
      service: 'api',
      message: `pong, ${payload.name}`,
      env: env.APP_ENV,
    }

    return c.json(
      buildSuccess(res, {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }),
    )
  },
)

export default pingRoute
