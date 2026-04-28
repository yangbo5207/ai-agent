import { z } from 'zod'

const adminEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']),
  API_BASE_URL: z.string().url(),
})

export type AdminEnv = z.infer<typeof adminEnvSchema>

export function getAdminEnv(): AdminEnv {
  return adminEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    API_BASE_URL: process.env.API_BASE_URL,
  })
}
