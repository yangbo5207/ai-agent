import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
} from "@repo/ui/card";
import { TailwindDemo } from "@repo/ui/tailwind-demo";
import { hc, type InferResponseType } from "hono/client";
import type { AppType } from "@repo/api";
import {
  BizCode,
  type ApiResponse,
  type PingRequest,
  type PingResponse,
} from "@repo/contracts";
import { getWebServerEnv } from "../src/env.server";
import { WebEnvBadge } from "../src/web-env-badge";

const rpcPath = "/rpc/system/ping";
const rpcPayload: PingRequest = { name: "web" };

type PingRpcResponse = InferResponseType<
  ReturnType<typeof hc<AppType>>["rpc"]["system"]["ping"]["$post"]
>;

async function getPingResponse(apiBaseUrl: string): Promise<PingRpcResponse> {
  const client = hc<AppType>(apiBaseUrl);

  try {
    const response = await client.rpc.system.ping.$post({
      json: rpcPayload,
    });

    return await response.json();
  } catch (error) {
    return {
      ok: false,
      error: {
        code: BizCode.SYSTEM_UPSTREAM_TIMEOUT,
        message: error instanceof Error ? error.message : "API request failed",
      },
      meta: {
        requestId: "unavailable",
        timestamp: new Date().toISOString(),
      },
    } satisfies ApiResponse<PingResponse>;
  }
}

const categories = [
  { label: "All", icon: null },
  { label: "Style", icon: "✦" },
  { label: "Animation", icon: "✦" },
  { label: "UI Component", icon: "✦", active: true },
  { label: "Landing Page", icon: "✦" },
];

const subTags = [
  "Button",
  "Card",
  "Switch",
  "Testimonial",
  "Above-the-fold",
  "Account Setup",
  "Accuracy",
  "Acid Green Accent",
];

export default async function Home() {
  const env = getWebServerEnv();
  const pingResult = await getPingResponse(env.API_BASE_URL);
  const requestBody = JSON.stringify(rpcPayload, null, 2);
  const responseBody = JSON.stringify(pingResult, null, 2);

  return (
    <main className="flex min-h-screen w-full flex-col">
      {/* Navigation */}
      <nav className="flex h-14 items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-2">
          <svg width="20" height="22" viewBox="0 0 26 30" fill="none">
            <path
              d="M11.8 0.6c-.6-.45-1.4-.8-2.2-.45a2.2 2.2 0 0 0-1.2 1.9c-.1.75.1 1.6.3 2.45.4 1.7 1.2 3.6 1.8 4.8.2.4.7.55 1.1.34.4-.2.5-.7.3-1.1-.6-1.15-1.4-2.9-1.8-4.45-.2-.78-.3-1.43-.2-1.9.05-.46.2-.55.27-.57.1-.04.3-.06.7.25.4.3.84.82 1.3 1.5.9 1.34 1.7 3.1 2.2 4.3.15.4.6.61 1 .45.4-.16.6-.62.45-1.02-.5-1.27-1.35-3.15-2.34-4.62-.5-.73-1.05-1.42-1.65-1.88Z"
              fill="currentColor"
            />
            <path
              d="M21.35 23.02c-.16-.42-.62-.62-1.02-.46-.4.17-.6.64-.43 1.05l1.05 2.69-3.47-3.56a.75.75 0 1 0-1.08 1.04l5.1 5.23c.85.87 2.25-.08 1.8-1.22l-1.9-4.88Z"
              fill="currentColor"
            />
            <path
              d="M10.76 6.85c-.2-.4-.68-.57-1.09-.38-8.69 3.97-10.06 11.25-9.6 14.52.06.44.47.74.92.68.45-.06.76-.46.7-.9-.38-2.69.73-9.23 8.67-12.86.4-.19.58-.66.4-1.06Z"
              fill="currentColor"
            />
            <path
              d="M18.37 6.4c-.74-.02-1.55.06-2.4.22-1.68.3-3.53.9-5.1 1.69-1.55.76-2.98 1.77-3.64 2.96-.2.36-.43.94-.12 1.48.3.54.9.63 1.23.64.73.02 1.72-.3 2.62-.72.94-.44 1.92-1.07 2.65-1.81.58-.6 1.12-1.4 1.13-2.3.52-.14 1.04-.26 1.53-.35.77-.14 1.48-.2 2.09-.2.62.0 1.07.09 1.36.22.26.12.3.24.32.32.02.13.0.45-.34 1.03-.43.73-.92 1.34-1.45 1.84-.57.1-1.15.13-1.73.1-1.66-.08-3.34.51-4.6 1.87-.65.7-.2 1.87.8 1.9 1.46.04 3.87-.4 5.99-2.1.6-.48 1.12-.97 1.57-1.48 1.1-.43 1.97-1.1 2.4-1.76.3-.46.33-.8.25-1.02-.07-.2-.32-.54-1.12-.8-2.78-.91-6.41-1.29-7.89-1.6-.43-.1-.85.18-.94.62-.09.43.19.87.6.96 1.58.34 5.54.77 8.71-.26 1.06-.35 1.83-.94 2.13-1.8.3-.86.03-1.73-.46-2.44-.52-.79-1.38-1.51-2.42-2.04.3-.4.51-.83.6-1.3.29-1.45-.62-2.72-2.04-3.52-.57-.32-1.27-.42-1.99-.44v.02Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-sm font-semibold tracking-tight">Superdesign</span>
        </div>

        <div className="hidden items-center gap-1 rounded-full border border-border bg-background p-1 shadow-sm md:flex">
          <button className="flex items-center gap-1.5 rounded-full bg-background px-4 py-1.5 text-sm font-medium text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </button>
          <button className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
            Prompt Library
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block">Login</button>
          <Button size="sm" className="rounded-full px-3 md:px-4">Sign up</Button>
        </div>
      </nav>

      {/* Centered Content */}
      <div className="mx-auto w-full max-w-3xl px-6 md:px-10">
        {/* Hero */}
        <section className="flex flex-col items-center pt-16 pb-10 text-center">
        <h1 className="max-w-3xl text-[clamp(2.5rem,6vw,4rem)] font-semibold leading-[1.1] tracking-tight text-foreground">
          Imagine it. Iterate it.
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
          Explore freely, iterate fast. Your design, AI-powered.
        </p>
      </section>

      {/* Mode Tabs */}
      <div className="flex justify-center pb-6">
        <div className="flex items-center rounded-full border border-border bg-background p-1 shadow-sm">
          <button className="rounded-full bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm md:px-5">
            Design on web
          </button>
          <button className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground md:px-5">
            Integrate with
            <span className="flex shrink-0 gap-0.5">
              <span className="inline-block size-3 rounded-full bg-neutral-800 md:size-3.5" />
              <span className="inline-block size-3 rounded-full bg-rose-500 md:size-3.5" />
              <span className="inline-block size-3 rounded-full bg-sky-500 md:size-3.5" />
            </span>
          </button>
        </div>
      </div>

      {/* Main Input */}
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-border bg-background p-4 md:p-5 shadow-card">
          <textarea
            placeholder="Describe what you want to create..."
            className="min-h-[80px] w-full resize-none bg-transparent text-base md:text-lg leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 md:gap-3">
              <button className="text-muted-foreground/60 transition hover:text-foreground">
                <svg className="size-4 md:size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              </button>
              <button className="text-muted-foreground/60 transition hover:text-foreground">
                <svg className="size-4 md:size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button className="text-muted-foreground/60 transition hover:text-foreground">
                <svg className="size-4 md:size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              </button>
              <button className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 md:px-2.5 md:py-1 text-xs text-muted-foreground transition hover:text-foreground">
                <span className="inline-block size-2.5 md:size-3 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-orange-500" />
                <span className="hidden sm:inline">Gemini 3 Flash</span>
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <button className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 md:px-2.5 md:py-1 text-xs text-muted-foreground transition hover:text-foreground">
                <svg className="size-3 md:size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span className="hidden sm:inline">Use Design System</span>
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button className="flex size-8 md:size-9 items-center justify-center rounded-full bg-foreground text-background transition hover:bg-foreground/90">
                <svg className="size-4 md:size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-5 flex flex-wrap justify-center gap-3 md:gap-5">
        <button className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          Recreate Screenshot
        </button>
        <button className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Import from Site
        </button>
        <button className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
          Explore Effects
        </button>
      </div>

      <section className="py-10">
        <Card className="overflow-hidden border border-border bg-background shadow-soft">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                RPC validation
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Shared request and response contract
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Hono RPC calls {rpcPath} with a shared zod schema and business error codes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1">
                server {env.APP_ENV}
              </span>
              <span className="rounded-full border border-border px-3 py-1">
                POST {rpcPath}
              </span>
              <span
                className={`rounded-full px-3 py-1 ${
                  pingResult.ok
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-rose-500/10 text-rose-700"
                }`}
              >
                {pingResult.ok ? "ok=true" : `code=${pingResult.error.code}`}
              </span>
              <span className="rounded-full border border-border px-3 py-1">
                {env.API_BASE_URL}
              </span>
            </div>
            <WebEnvBadge />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">Request</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                  {requestBody}
                </pre>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-medium text-foreground">Response</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-muted-foreground">
                  {responseBody}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

        {/* Demo Section */}
        <section className="py-16">
          <TailwindDemo appName="web" />
        </section>
      </div>

      {/* Prompt Library */}
      <section className="px-6 py-8 md:px-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
            Discover design prompts
          </h2>
          <div className="relative w-full sm:w-auto">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              placeholder="Search templates..."
              className="h-9 w-full sm:w-64 rounded-full border border-border bg-background pl-9 pr-4 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.label}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition ${
                cat.active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sub Tags */}
        <div className="mb-8 flex flex-wrap gap-2">
          {subTags.map((tag) => (
            <button
              key={tag}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Template Cards Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="overflow-hidden border-0 shadow-soft">
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="space-y-3">
                  <div className="h-3 w-20 rounded-full bg-sky-500" />
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded-full bg-foreground/10" />
                    <div className="h-2 w-4/5 rounded-full bg-foreground/10" />
                    <div className="h-2 w-3/5 rounded-full bg-foreground/10" />
                  </div>
                  <div className="h-8 w-full rounded-lg bg-sky-500/80" />
                  <div className="space-y-1.5 pt-2">
                    <div className="h-2 w-full rounded-full bg-foreground/10" />
                    <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">Refined Order Form UI</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-soft">
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-neutral-50 to-neutral-100 p-6">
                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 rounded-full bg-foreground/15" />
                  <div className="size-4 rounded-full border-2 border-foreground/30" />
                </div>
                <div className="mt-8 text-center">
                  <div className="inline-block rounded-lg bg-foreground/5 px-3 py-1 text-xs uppercase tracking-widest text-foreground/30">
                    Stepped Control
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-center gap-2">
                  <div className="h-1 w-24 rounded-full bg-foreground/10" />
                  <div className="size-3 rounded-full bg-foreground" />
                  <div className="h-1 w-16 rounded-full bg-foreground/10" />
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">Elastic Slider</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-soft">
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-stone-50 to-stone-100 p-6">
                <div className="flex gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="size-10 rounded-lg bg-foreground/10"
                      style={{ transform: `rotate(${i * 8}deg) translateY(${i * 2}px)` }}
                    />
                  ))}
                </div>
                <div className="mt-8 text-center text-xs uppercase tracking-widest text-foreground/30">
                  Interactive Motion
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">Image Trail</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-soft">
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 p-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="size-3 rounded-full bg-foreground/20" />
                  <div className="size-3 rounded-full bg-foreground/20" />
                  <div className="size-3 rounded-full bg-foreground/20" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full rounded-full bg-foreground/10" />
                  <div className="h-2 w-5/6 rounded-full bg-foreground/10" />
                  <div className="h-2 w-4/6 rounded-full bg-foreground/10" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-6 flex-1 rounded-md bg-foreground/10" />
                  <div className="h-6 flex-1 rounded-md bg-foreground" />
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">Modal Dialog</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-soft">
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-zinc-50 to-zinc-100 p-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-foreground/10" />
                  <div className="space-y-1.5">
                    <div className="h-2 w-20 rounded-full bg-foreground/15" />
                    <div className="h-2 w-14 rounded-full bg-foreground/10" />
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <div className="h-2 w-full rounded-full bg-foreground/10" />
                  <div className="h-2 w-full rounded-full bg-foreground/10" />
                  <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
                </div>
                <div className="mt-3 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < 4 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="text-foreground/30">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">Testimonial Card</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-soft">
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 p-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-16 rounded-full bg-foreground/15" />
                    <div className="h-5 w-10 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="h-px w-full bg-foreground/10" />
                  <div className="flex items-center justify-between py-1">
                    <div className="h-2 w-24 rounded-full bg-foreground/10" />
                    <div className="h-5 w-12 rounded-full border border-foreground/20" />
                  </div>
                  <div className="h-px w-full bg-foreground/10" />
                  <div className="flex items-center justify-between py-1">
                    <div className="h-2 w-20 rounded-full bg-foreground/10" />
                    <div className="h-5 w-12 rounded-full bg-foreground" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground">Pricing Toggle</h3>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-8 md:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="18" viewBox="0 0 26 30" fill="none">
              <path
                d="M11.8 0.6c-.6-.45-1.4-.8-2.2-.45a2.2 2.2 0 0 0-1.2 1.9c-.1.75.1 1.6.3 2.45.4 1.7 1.2 3.6 1.8 4.8.2.4.7.55 1.1.34.4-.2.5-.7.3-1.1-.6-1.15-1.4-2.9-1.8-4.45-.2-.78-.3-1.43-.2-1.9.05-.46.2-.55.27-.57.1-.04.3-.06.7.25.4.3.84.82 1.3 1.5.9 1.34 1.7 3.1 2.2 4.3.15.4.6.61 1 .45.4-.16.6-.62.45-1.02-.5-1.27-1.35-3.15-2.34-4.62-.5-.73-1.05-1.42-1.65-1.88Z"
                fill="currentColor"
              />
              <path
                d="M21.35 23.02c-.16-.42-.62-.62-1.02-.46-.4.17-.6.64-.43 1.05l1.05 2.69-3.47-3.56a.75.75 0 1 0-1.08 1.04l5.1 5.23c.85.87 2.25-.08 1.8-1.22l-1.9-4.88Z"
                fill="currentColor"
              />
            </svg>
            <span className="text-sm text-muted-foreground">Superdesign</span>
          </div>
          <div className="flex gap-6 text-xs text-muted-foreground/60">
            <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">shadcn/ui</a>
            <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">Tailwind</a>
            <a href="https://www.radix-ui.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-foreground">Radix</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
