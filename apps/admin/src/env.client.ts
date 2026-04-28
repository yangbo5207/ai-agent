import { z } from 'zod'

const adminClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'test', 'production']),
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
})

export type AdminClientEnv = z.infer<typeof adminClientEnvSchema>

export function getAdminClientEnv(): AdminClientEnv {
  return adminClientEnvSchema.parse({
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  })
}
