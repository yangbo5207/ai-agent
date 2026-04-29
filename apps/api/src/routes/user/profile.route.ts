import { Hono } from 'hono'
import {
  UserProfileResponseSchema,
  buildSuccess,
} from '@repo/contracts'

type Bindings = {
  APP_ENV: 'development' | 'test' | 'production'
}

const userRoute = new Hono<{ Bindings: Bindings }>()

userRoute.get('/profile', (c) => {
  const res = UserProfileResponseSchema.parse({
    id: 'user-demo',
    name: 'Demo User',
    role: 'designer',
  })

  return c.json(
    buildSuccess(res, {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }),
  )
})

export default userRoute
