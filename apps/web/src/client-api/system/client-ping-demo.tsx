"use client";

import { useMemo, useState } from 'react'
import { postClientPing } from '@/client-api/system/ping.api'
import { getWebClientEnv } from '@/env.client'

export function ClientPingDemo() {
  const env = useMemo(() => getWebClientEnv(), [])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)

  async function handlePing() {
    setLoading(true)
    const response = await postClientPing({ name: 'client-web' })
    setResult(response)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Client component direct API access
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          This button calls the deployed Hono API directly from the browser through NEXT_PUBLIC_API_BASE_URL.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border px-3 py-1">
          client {env.NEXT_PUBLIC_APP_ENV}
        </span>
        <span className="rounded-full border border-border px-3 py-1">
          {env.NEXT_PUBLIC_API_BASE_URL}
        </span>
      </div>

      <button
        type="button"
        onClick={handlePing}
        disabled={loading}
        className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Requesting…' : 'Request /rpc/system/ping'}
      </button>

      <pre className="rounded-[var(--radius-card)] border border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}
