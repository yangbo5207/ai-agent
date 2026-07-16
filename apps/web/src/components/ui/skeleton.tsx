import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("skeleton-scan relative overflow-hidden bg-slate-100", className)}
      data-slot="skeleton"
      {...props}
    />
  )
}

export { Skeleton }
