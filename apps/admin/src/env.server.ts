import { z } from 'zod'

const adminServerEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']),
  API_BASE_URL: z.string().url(),
})

export type AdminServerEnv = z.infer<typeof adminServerEnvSchema>

export function getAdminServerEnv(): AdminServerEnv {
  return adminServerEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    API_BASE_URL: process.env.API_BASE_URL,
  })
}
