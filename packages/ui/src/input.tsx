import * as React from "react";
import { cn } from "./lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-[var(--radius-control)] border border-input bg-background px-3.5 text-sm text-foreground outline-none transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
