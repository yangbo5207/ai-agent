import { z } from 'zod'

export const PingRequestSchema = z.object({
  name: z.string().trim().min(1),
})

export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingResponseSchema = z.object({
  service: z.literal('api'),
  message: z.string(),
  env: z.enum(['development', 'test', 'production']),
})

export type PingResponse = z.infer<typeof PingResponseSchema>
