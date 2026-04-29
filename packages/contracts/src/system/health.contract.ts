import { z } from 'zod'

export const HealthResponseSchema = z.object({
  service: z.literal('api'),
  env: z.enum(['development', 'test', 'production']),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
