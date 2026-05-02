"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getWebClientEnv } from '@/env.client'
import { getClientHealth } from '@/client-api/system/health.api'
import { postClientPing } from '@/client-api/system/ping.api'

// health 用 query，因为它属于页面进入后自动读取、可缓存、可 refetch 的数据。
const HEALTH_QUERY_KEY = ['system-health']

export function ClientPingDemo() {
  const env = useMemo(() => getWebClientEnv(), [])
  const queryClient = useQueryClient()

  const healthQuery = useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: getClientHealth,
  })

  // ping 用 mutation，因为它是按钮触发的写操作，请求完成后再主动使 health 失效重拉。
  const pingMutation = useMutation({
    mutationFn: () => postClientPing({ name: 'client-web' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY })
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Client component direct API access
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          This demo calls the Hono API directly from the browser through NEXT_PUBLIC_API_BASE_URL.
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

      <section className="space-y-3 rounded-[var(--radius-card)] border border-border bg-muted/40 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">useQuery · /health</h3>
            <p className="text-sm text-muted-foreground">
              Demonstrates loading, success, error, cache, and manual refetch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void healthQuery.refetch()}
            className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Refetch health
          </button>
        </div>

        <pre className="rounded-[var(--radius-card)] border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          {JSON.stringify(
            {
              isPending: healthQuery.isPending,
              isError: healthQuery.isError,
              isSuccess: healthQuery.isSuccess,
              data: healthQuery.data,
              error: healthQuery.error,
            },
            null,
            2,
          )}
        </pre>
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-border bg-muted/40 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">useMutation · /rpc/system/ping</h3>
            <p className="text-sm text-muted-foreground">
              Demonstrates pending, success, error, and query invalidation after mutation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => pingMutation.mutate()}
            disabled={pingMutation.isPending}
            className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pingMutation.isPending ? 'Requesting…' : 'Request /rpc/system/ping'}
          </button>
        </div>

        <pre className="rounded-[var(--radius-card)] border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
          {JSON.stringify(
            {
              isPending: pingMutation.isPending,
              isError: pingMutation.isError,
              isSuccess: pingMutation.isSuccess,
              data: pingMutation.data,
              error: pingMutation.error,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </div>
  )
}
