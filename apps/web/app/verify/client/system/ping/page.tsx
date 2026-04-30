import { ClientPingDemo } from '@/client-api/system/client-ping-demo'

export default function ClientPingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Client / system / ping
      </h1>
      <ClientPingDemo />
    </main>
  )
}
