import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { Separator } from "./separator";

type TailwindDemoProps = {
  appName: string;
};

const features = [
  "Shared Tailwind utilities",
  "Shadcn-style primitives",
  "Rendered from @repo/ui",
];

export function TailwindDemo({ appName }: TailwindDemoProps) {
  return (
    <Card className="w-full max-w-5xl overflow-hidden">
      <CardHeader className="gap-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <span className="inline-flex w-fit items-center rounded-[var(--radius-control)] border border-border bg-muted px-3 py-1 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            shared ui package
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl md:text-3xl">
              Tailwind and shadcn primitives are active in {appName}
            </CardTitle>
            <CardDescription className="max-w-2xl">
              This section is rendered from{" "}
              <code className="rounded-[var(--radius-control)] border border-border bg-background px-2 py-1 text-foreground">
                packages/ui
              </code>{" "}
              and uses reusable Button, Card, Input, Label, and Separator
              components.
            </CardDescription>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-[var(--radius-surface)] border border-border bg-background px-4 py-3 text-sm font-medium text-muted-foreground shadow-soft"
            >
              {feature}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4 rounded-[var(--radius-surface)] border border-border bg-background p-4 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor={`${appName}-workspace`}>Workspace label</Label>
            <Input
              id={`${appName}-workspace`}
              defaultValue={`${appName}.workspace.local`}
            />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-3">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary action</Button>
            <Button variant="outline">Outline action</Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-surface)] border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground shadow-soft">
          <p>
            The same primitives can be imported from the shared package and reused
            in both sub-apps without adding separate component copies.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex-wrap gap-3 border-t border-border pt-5">
        <Button asChild variant="ghost">
          <a
            href="https://ui.shadcn.com/docs/components/button"
            target="_blank"
            rel="noopener noreferrer"
          >
            View shadcn button reference
          </a>
        </Button>
        <Button asChild variant="outline">
          <a
            href="https://ui.shadcn.com/docs/components/card"
            target="_blank"
            rel="noopener noreferrer"
          >
            View card reference
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
