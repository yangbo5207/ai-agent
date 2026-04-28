import { z } from 'zod'

const webServerEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']),
  API_BASE_URL: z.string().url(),
})

export type WebServerEnv = z.infer<typeof webServerEnvSchema>

export function getWebServerEnv(): WebServerEnv {
  return webServerEnvSchema.parse({
    APP_ENV: process.env.APP_ENV,
    API_BASE_URL: process.env.API_BASE_URL,
  })
}
