"use client";

import { getAdminClientEnv } from "./env.client";

export function AdminEnvBadge() {
  const env = getAdminClientEnv();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-[var(--radius-surface)] border border-border bg-background px-4 py-3 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          NEXT_PUBLIC_APP_ENV
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">{env.NEXT_PUBLIC_APP_ENV}</p>
      </div>
      <div className="rounded-[var(--radius-surface)] border border-border bg-background px-4 py-3 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          NEXT_PUBLIC_API_BASE_URL
        </p>
        <p className="mt-2 break-all text-sm font-medium text-foreground">{env.NEXT_PUBLIC_API_BASE_URL}</p>
      </div>
    </div>
  );
}
