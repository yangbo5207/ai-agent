import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'api' })
})

export default app