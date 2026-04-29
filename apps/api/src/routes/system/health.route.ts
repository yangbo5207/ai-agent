import { Hono } from 'hono'
import {
  buildSuccess,
  type HealthResponse,
} from '@repo/contracts'
import { getApiEnv } from '../../env'

type Bindings = {
  APP_ENV: 'development' | 'test' | 'production'
}

const healthRoute = new Hono<{ Bindings: Bindings }>()

healthRoute.get('/', (c) => {
  const env = getApiEnv(c.env)
  const res: HealthResponse = {
    service: 'api',
    env: env.APP_ENV,
  }

  return c.json(
    buildSuccess(res, {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }),
  )
})

export default healthRoute
