import { z } from 'zod'

const webClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'test', 'production']),
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
})

export type WebClientEnv = z.infer<typeof webClientEnvSchema>

export function getWebClientEnv(): WebClientEnv {
  return webClientEnvSchema.parse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  })
}
