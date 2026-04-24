import * as React from "react";
import { cn } from "./lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-slate-50 outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-brand-500/60 focus-visible:ring-2 focus-visible:ring-brand-500/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
