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

const checks = [
  "Tailwind utilities compile in this app",
  "Classes from @repo/ui are included",
  "Shared theme tokens apply consistently",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12 md:px-10 lg:px-12">
      <section className="space-y-5">
        <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-muted px-3.5 py-1 text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          admin frontend
        </span>
        <div className="space-y-3">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            One shared UI package, two frontends, one Tailwind pipeline per app.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            The admin app scans the shared package source so Tailwind classes used
            there render correctly here too.
          </p>
        </div>
      </section>

      <TailwindDemo appName="admin" />

      <Card>
        <CardHeader>
          <CardTitle>Admin primitive validation</CardTitle>
          <CardDescription>
            This block checks the same shared primitives in a second app with a
            slightly different layout and button sizing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:max-w-md">
            <Label htmlFor="tenant-id">Tenant identifier</Label>
            <Input id="tenant-id" placeholder="team-enterprise-01" />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-3">
            <Button size="sm">Queue sync</Button>
            <Button variant="secondary">Inspect</Button>
            <Button size="lg" variant="outline">
              Publish changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="rounded-[var(--radius-card)] border border-border bg-muted p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-foreground">
          Verification checklist
        </h2>
        <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          {checks.map((check) => (
            <li
              key={check}
              className="rounded-[var(--radius-surface)] border border-border bg-background px-4 py-3 shadow-soft"
            >
              {check}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
