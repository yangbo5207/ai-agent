"use client"

import * as React from "react"
import Link from "next/link"

import { AppSidebar } from "./app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/breadcrumb"
import { Separator } from "@repo/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/sidebar"

type DashboardShellProps = {
  children: React.ReactNode
  headerRight?: React.ReactNode
  title: string
  hideHeader?: boolean
}

export function DashboardShell({ children, headerRight, title, hideHeader = false }: DashboardShellProps) {
  React.useEffect(() => {
    document.title = `${title} · 电子伴侣`
  }, [title])

  const headerClassName = headerRight
    ? "flex min-h-12 flex-wrap items-center gap-2 border-b border-[#e3e6e4] bg-[#fffefa] px-4 py-2"
    : "flex h-12 shrink-0 items-center gap-2 border-b border-[#e3e6e4] bg-[#fffefa] px-4"

  return (
    <SidebarProvider
      className="!bg-[#eef0f1]"
      style={
        {
          "--sidebar-width": "14rem",
          height: "100svh",
          minHeight: 0,
          overflow: "hidden",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset
        className="h-full min-h-0 overflow-hidden bg-white md:h-[calc(100svh-1rem)] md:m-2 md:mb-2 md:ml-0 md:rounded-xl md:border md:border-[#dfe3e1] md:!shadow-none"
      >
        {hideHeader ? (
          <header className="flex h-12 shrink-0 items-center bg-[#eef0f1] px-3 lg:hidden">
            <SidebarTrigger className="-ml-1 text-[#53615e]" />
          </header>
        ) : (
          <header className={headerClassName}>
            <SidebarTrigger className="-ml-1 size-8 text-[#687572] hover:bg-[#f0f2f1] hover:text-[#27353a]" />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-4 data-[orientation=vertical]:bg-[#dfe3e1]"
            />
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5">
                <BreadcrumbItem className="hidden text-[11px] md:block">
                  <BreadcrumbLink asChild className="text-[#9a8d7e] hover:text-[#53615e]">
                    <Link href="/">Companion</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden text-[#c7ceca] md:block" />
                <BreadcrumbItem className="text-[12px]">
                  <BreadcrumbPage className="font-semibold text-[#27353a]">{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {headerRight ? <div className="ml-auto flex min-w-0 items-center justify-end gap-2">{headerRight}</div> : null}
          </header>
        )}
        <main className={hideHeader ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#fffefa]"}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
