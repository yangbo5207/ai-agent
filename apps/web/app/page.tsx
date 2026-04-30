import Link from 'next/link'

const demos = [
  {
    href: '/verify/system/health',
    title: 'System health',
    description: 'Validate grouped GET health route and shared response envelope.',
  },
  {
    href: '/verify/system/ping',
    title: 'System ping',
    description: 'Validate grouped POST ping route and payload schema.',
  },
  {
    href: '/verify/catalog/list',
    title: 'Catalog list',
    description: 'Validate catalog domain route organization and list response.',
  },
  {
    href: '/verify/user/profile',
    title: 'User profile',
    description: 'Validate user domain route organization and profile response.',
  },
  {
    href: '/verify/order/detail',
    title: 'Order detail',
    description: 'Validate order domain route organization and POST detail lookup.',
  },
  {
    href: '/verify/client/system/ping',
    title: 'Client ping demo',
    description: 'Validate direct browser-to-API access from a client component with NEXT_PUBLIC_API_BASE_URL.',
  },
]

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-12 md:px-10">
      <section className="space-y-4">
        <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          API demo index
        </span>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            Route grouping simulation for the API app.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            Each page below validates one grouped API route, and each request is managed in its own api.ts file.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {demos.map((demo) => (
          <Link
            key={demo.href}
            href={demo.href}
            className="rounded-[var(--radius-card)] border border-border bg-background p-6 shadow-soft transition hover:border-foreground/20"
          >
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">{demo.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{demo.description}</p>
              <span className="inline-flex text-sm font-medium text-foreground">Open page →</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
