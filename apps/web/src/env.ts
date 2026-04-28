import { z } from 'zod'

const webEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']),
  API_BASE_URL: z.string().url(),
})

export type WebEnv = z.infer<typeof webEnvSchema>

export function getWebEnv(): WebEnv {
  return webEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    API_BASE_URL: process.env.API_BASE_URL,
  })
}
