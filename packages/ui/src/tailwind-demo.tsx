type TailwindDemoProps = {
  appName: string;
};

const features = [
  "Shared Tailwind utilities",
  "Shared theme tokens",
  "Rendered from @repo/ui",
];

export function TailwindDemo({ appName }: TailwindDemoProps) {
  return (
    <section className="w-full max-w-4xl rounded-card border border-white/10 bg-[linear-gradient(135deg,rgba(79,124,255,0.16),rgba(255,255,255,0.04))] p-6 shadow-card backdrop-blur md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <span className="inline-flex w-fit items-center rounded-full border border-brand-500/20 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-brand-700 uppercase">
            shared ui package
          </span>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Tailwind is active in {appName}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-200 md:text-base">
              This block is rendered from <code className="rounded bg-white/10 px-2 py-1 text-slate-100">packages/ui</code> and styled entirely with Tailwind utilities.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[360px]">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 shadow-sm shadow-black/10"
            >
              {feature}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
