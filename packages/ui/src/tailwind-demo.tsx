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
    <Card className="w-full max-w-5xl overflow-hidden bg-[linear-gradient(135deg,rgba(79,124,255,0.18),rgba(15,23,42,0.92))]">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <span className="inline-flex w-fit items-center rounded-full border border-brand-500/20 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-brand-700 uppercase">
            shared ui package
          </span>
          <div className="space-y-2">
            <CardTitle className="text-2xl text-white md:text-3xl">
              Tailwind and shadcn primitives are active in {appName}
            </CardTitle>
            <CardDescription className="max-w-2xl text-slate-200">
              This section is rendered from <code className="rounded bg-white/10 px-2 py-1 text-slate-100">packages/ui</code> and now uses reusable Button, Card, Input, Label, and Separator components.
            </CardDescription>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 shadow-sm shadow-black/10"
            >
              {feature}
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
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

        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200">
          <p>
            The same primitives can now be imported from the shared package and reused in both sub-apps without adding separate component copies.
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex-wrap gap-3 border-t border-white/10 pt-6">
        <Button asChild variant="ghost">
          <a href="https://ui.shadcn.com/docs/components/button" target="_blank" rel="noopener noreferrer">
            View shadcn button reference
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="https://ui.shadcn.com/docs/components/card" target="_blank" rel="noopener noreferrer">
            View card reference
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
