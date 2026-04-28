import {
  BizCode,
  PingRequestSchema,
  buildFailure,
  buildSuccess,
  type ApiMeta,
} from '@repo/contracts'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'

type AppErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500 | 504

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

const app = new Hono()

function createMeta(): ApiMeta {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
}

app.onError((error, c) => {
  const meta = createMeta()

  if (error instanceof AppError) {
    const errorMsg = { code: error.code, message: error.message, details: error.details }
    const res = buildFailure(errorMsg, meta);
    return c.json(res, error.status);
  }

  if (error instanceof HTTPException) {
    const errorMsg = { code: BizCode.COMMON_INVALID_REQUEST, message: error.message }
    const res = buildFailure(errorMsg, meta);
    return c.json(res, error.status);
  }

  console.error(error)

  const errorMsg = { code: BizCode.SYSTEM_INTERNAL_ERROR, message: 'Internal server error' }
  const res = buildFailure(errorMsg, meta);
  return c.json(res, 500);
})

app.notFound((c) => {
  const errorMsg = { code: BizCode.COMMON_NOT_FOUND, message: 'Not found' }
  const res = buildFailure(errorMsg, createMeta());
  return c.json(res, 404);
})

const routes = app
  .get('/health', (c) => {
    const res = buildSuccess({ service: 'api' }, createMeta());
    return c.json(res);
  })
  .post('/rpc/system/ping', validator('json', (value, c) => {
      const parsed = PingRequestSchema.safeParse(value)

      if (!parsed.success) {
        const errorMsg = {
          code: BizCode.COMMON_INVALID_REQUEST,
          message: 'Invalid request payload',
          details: parsed.error.flatten(),
        }
        return c.json(buildFailure(errorMsg, createMeta()), 400);
      }

      return parsed.data
    }),
    (c) => {
      const payload = c.req.valid('json')
      const successMsg = { service: 'api', message: `pong, ${payload.name}` } 
      const res = buildSuccess(successMsg, createMeta());
    return c.json(res);
  });

export type AppType = typeof routes;

export default app;
