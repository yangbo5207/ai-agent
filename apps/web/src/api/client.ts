import { getWebServerEnv } from '@/env.server'

const env = getWebServerEnv()

export function serverURL(path: string) {
  return new URL(path, env.API_BASE_URL).toString()
}

export function createJsonRequestInit(body?: unknown): RequestInit {
  if (body === undefined) {
    return {
      method: 'GET',
    }
  }

  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}
