import { Hono } from 'hono'
import {
  CatalogListResponseSchema,
  buildSuccess,
} from '@repo/contracts'

type Bindings = {
  APP_ENV: 'development' | 'test' | 'production'
}

const catalogRoute = new Hono<{ Bindings: Bindings }>()

catalogRoute.get('/list', (c) => {
  const res = CatalogListResponseSchema.parse({
    items: [
      { id: 'catalog-1', name: 'Minimal Button', category: 'component' },
      { id: 'catalog-2', name: 'Hero Template', category: 'landing-page' },
      { id: 'catalog-3', name: 'Profile Card', category: 'card' },
    ],
  })

  return c.json(
    buildSuccess(res, {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }),
  )
})

export default catalogRoute
