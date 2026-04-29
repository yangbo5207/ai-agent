import { postPing } from '@/api/system/ping.api'

export default async function PingPage() {
  const payload = { name: 'web' }
  const result = await postPing(payload)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">System / ping</h1>
      <pre className="rounded-[var(--radius-card)] border border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
        {JSON.stringify({ payload, result }, null, 2)}
      </pre>
    </main>
  )
}
