import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Separator } from "@repo/ui/separator";
import { TailwindDemo } from "@repo/ui/tailwind-demo";

const links = [
  {
    href: "https://tailwindcss.com/docs/installation/framework-guides/nextjs",
    label: "Tailwind v4 docs",
  },
  {
    href: "https://nextjs.org/docs/app",
    label: "Next.js App Router",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-16 md:px-10 lg:px-12">
      <section className="space-y-6">
        <span className="inline-flex items-center rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-brand-100 uppercase">
          web frontend
        </span>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Shared Tailwind styling across apps and packages.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            This page compiles Tailwind locally and also picks up utility classes from the shared UI package.
          </p>
        </div>
      </section>

      <TailwindDemo appName="web" />

      <Card>
        <CardHeader>
          <CardTitle>Primitive validation in web</CardTitle>
          <CardDescription>
            This section imports shared Button, Input, Label, Card, and Separator components directly from <code className="rounded bg-white/10 px-2 py-1 text-slate-100">@repo/ui</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" placeholder="AI Agent workspace" />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-3">
            <Button>Save draft</Button>
            <Button variant="secondary">Preview</Button>
            <Button variant="outline">Open docs</Button>
            <Button asChild variant="ghost">
              <a href="https://ui.shadcn.com" target="_blank" rel="noopener noreferrer">
                shadcn/ui
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-brand-500/40 hover:bg-white/10"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-medium text-white">{link.label}</h2>
              <span className="text-sm text-brand-100 transition group-hover:translate-x-1">→</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Open the reference used by this workspace setup and compare the rendered result in the shared package demo.
            </p>
          </a>
        ))}
      </section>
    </main>
  );
}
