"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { MyAgentInboxItem } from "@repo/contracts"
import {
  Bot,
  CheckCircle2,
  CirclePlus,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"
import { getMyAgentInbox } from "@/auth/api"
import { AgentAvatar } from "@/components/agent-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CompanionFilter = "all" | "published" | "draft"

const tileClassNames = [
  "bg-[#d9d9d9]",
  "bg-[#c9cdd2]",
  "bg-[#e1e1e1]",
  "bg-[#bfc3c8]",
  "bg-[#d3d7dc]",
  "bg-[#ececec]",
]

function getTileClassName(index: number) {
  return tileClassNames[index % tileClassNames.length]!
}

function getStatusTone(agent: MyAgentInboxItem) {
  if (agent.agentStatus === "published") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (agent.agentStatus === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }

  return "border-slate-200 bg-slate-50 text-slate-500"
}

function getConversationPreview(agent: MyAgentInboxItem) {
  return agent.lastAssistantMessage || agent.profileNote
}

function matchesFilter(agent: MyAgentInboxItem, filter: CompanionFilter) {
  if (filter === "published") {
    return agent.agentStatus === "published"
  }

  if (filter === "draft") {
    return agent.agentStatus === "draft"
  }

  return true
}

function matchesSearch(agent: MyAgentInboxItem, searchTerm: string) {
  const normalized = searchTerm.trim().toLowerCase()

  if (!normalized) {
    return true
  }

  return [
    agent.name,
    agent.headline,
    agent.status,
    agent.relationship,
    agent.topic,
    getConversationPreview(agent),
  ].some((value) => value.toLowerCase().includes(normalized))
}

function EmptyCompanions() {
  return (
    <section className="flex min-h-[26rem] items-center justify-center border-y border-slate-200 bg-white px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Bot className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-950">还没有自己的 Agent</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          创建一个 Agent 伴侣后，它会出现在这里，并可以进入详情页维护头像、人设和默认提示词。
        </p>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/create-agent-companion">
            <CirclePlus className="size-4" />
            创建 Agent 伴侣
          </Link>
        </Button>
      </div>
    </section>
  )
}

function CompanionsLoading() {
  return (
    <section className="overflow-hidden rounded-2xl">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            className="aspect-[2/3] w-full animate-pulse bg-slate-200"
            key={item}
          />
        ))}
      </div>
    </section>
  )
}

function CompanionsError() {
  return (
    <section className="flex min-h-[26rem] items-center justify-center border-y border-slate-200 bg-white px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Sparkles className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-950">伴侣列表加载失败</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          请确认 API 已部署并完成最新 D1 迁移后再刷新页面。
        </p>
      </div>
    </section>
  )
}

function FilteredCompanionsEmpty() {
  return (
    <section className="flex min-h-[26rem] items-center justify-center border-y border-slate-200 bg-white px-5 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Search className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-950">没有匹配的 Agent</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          换一个关键词或筛选条件，再回来找你的伴侣角色。
        </p>
      </div>
    </section>
  )
}

export default function CompanionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<CompanionFilter>("all")
  const agentInboxQuery = useQuery({
    queryKey: ["dashboard", "my-agent-inbox", "companions"],
    queryFn: getMyAgentInbox,
  })
  const companions = agentInboxQuery.data?.items ?? []
  const filteredCompanions = useMemo(
    () => companions.filter((agent) => matchesFilter(agent, activeFilter) && matchesSearch(agent, searchTerm)),
    [activeFilter, companions, searchTerm],
  )
  const stats = {
    total: agentInboxQuery.data?.total ?? companions.length,
    published: agentInboxQuery.data?.published ?? companions.filter((item) => item.agentStatus === "published").length,
    draft: agentInboxQuery.data?.draft ?? companions.filter((item) => item.agentStatus === "draft").length,
  }
  const filters: Array<{ key: CompanionFilter; label: string; meta: string }> = [
    { key: "all", label: "全部", meta: `${stats.total} 个角色` },
    { key: "published", label: "可聊天", meta: `${stats.published} 个角色` },
    { key: "draft", label: "草稿", meta: `${stats.draft} 个草稿` },
  ]
  const companionStats = [
    { label: "全部伴侣", value: String(stats.total), icon: Users },
    { label: "可聊天", value: String(stats.published), icon: Heart },
    { label: "草稿", value: String(stats.draft), icon: Bot },
  ]
  return (
    <DashboardShell title="我的伴侣">
      <main className="min-h-full bg-[#fffefa]">
        <section className="bg-white px-5 pt-5 lg:px-8">
          <div className="border-b border-slate-200 pb-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-end">
              <div className="flex min-w-0 gap-4">
                <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 sm:flex">
                  <Heart className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                    <span>我的伴侣</span>
                    <span className="h-px w-8 bg-slate-200" />
                    <span>Companions</span>
                  </div>
                  <p className="mt-2 max-w-xl text-[15px] font-normal leading-7 text-slate-600">
                    管理你创建的 AI Agent 伴侣，快速查看资料、头像、人设提示词和最近聊天状态。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                      <Bot className="size-3.5" />
                      我的创作
                    </span>
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                      <ShieldCheck className="size-3.5" />
                      人设维护
                    </span>
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-[11px] font-medium text-slate-500">
                      <MessageCircle className="size-3.5" />
                      继续聊天
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 border-t border-slate-200 pt-3 lg:border-t-0 lg:pt-0">
                {companionStats.map((item, index) => {
                  const Icon = item.icon

                  return (
                    <div
                      className={index === 0 ? "pr-4" : "border-l border-slate-200 px-4 last:pr-0"}
                      key={item.label}
                    >
                      <div className="mb-2 flex size-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Icon className="size-3.5" />
                      </div>
                      <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                      <p className="mt-1 text-sm font-medium leading-none text-slate-600">{item.value}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-1.5 lg:h-10 lg:flex-row lg:items-center">
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-xl bg-slate-50/80 px-2.5 ring-1 ring-inset ring-slate-200/70 transition-colors focus-within:bg-white lg:w-80">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-500">
                <Search className="size-3.5" />
              </span>
              <input
                aria-label="搜索我的伴侣"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400"
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                placeholder="搜索名字、状态或设定"
                value={searchTerm}
              />
            </label>

            <div className="hidden h-5 w-px shrink-0 bg-slate-200 lg:block" />

            <div className="flex h-9 min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              {filters.map((filter) => (
                <button
                  className={cn(
                    "relative flex h-8 shrink-0 items-center rounded-lg px-3 text-xs transition-colors",
                    activeFilter === filter.key
                      ? "bg-slate-100 font-semibold text-slate-950 after:absolute after:inset-x-3 after:bottom-1 after:h-px after:bg-slate-400"
                      : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  )}
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  title={filter.meta}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <Button asChild className="h-9 rounded-full" variant="outline">
              <Link href="/create-agent-companion">
                <CirclePlus className="size-4" />
                创建伴侣
              </Link>
            </Button>
          </div>

          <div className="mt-5">
            {agentInboxQuery.isLoading ? (
              <CompanionsLoading />
            ) : agentInboxQuery.isError ? (
              <CompanionsError />
            ) : companions.length === 0 ? (
              <EmptyCompanions />
            ) : filteredCompanions.length === 0 ? (
              <FilteredCompanionsEmpty />
            ) : (
              <section className="overflow-hidden rounded-2xl">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredCompanions.map((companion, index) => (
                    <Link
                      className={cn(
                        getTileClassName(index),
                        "group relative flex aspect-[2/3] w-full min-w-0 flex-col overflow-hidden p-4 text-slate-950",
                      )}
                      href={`/agents/detail?agentId=${encodeURIComponent(companion.id)}`}
                      key={companion.id}
                    >
                      <AgentAvatar
                        className="absolute inset-0 size-full rounded-none border-0 bg-transparent"
                        fallbackClassName={cn(getTileClassName(index), "text-4xl text-slate-500")}
                        imageKey={companion.imageKey}
                        name={companion.name}
                      />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.62),transparent_12rem),linear-gradient(180deg,transparent_42%,rgba(255,255,255,0.58)_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />

                      <div className="relative flex translate-y-2 items-start justify-between gap-3 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="max-w-full truncate rounded-full border border-white/70 bg-white/55 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            我创建的
                          </span>
                          {companion.agentStatus === "published" ? (
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/55 text-slate-700">
                              <CheckCircle2 className="size-4" />
                            </span>
                          ) : null}
                        </div>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/55 text-slate-700 hover:bg-white/75">
                          <MoreHorizontal className="size-4" />
                        </span>
                      </div>

                      <div className="relative mt-auto translate-y-2 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                        <div className="mb-3 flex items-center gap-2">
                          <span className={cn("rounded-full border px-2 py-1 text-[11px] font-medium", getStatusTone(companion))}>
                            {companion.status}
                          </span>
                          {companion.pinned ? (
                            <span className="flex size-7 items-center justify-center rounded-full border border-white/70 bg-white/45 text-amber-500">
                              <Star className="size-3.5 fill-amber-400" />
                            </span>
                          ) : null}
                        </div>

                        <h2 className="truncate text-lg font-semibold tracking-tight text-slate-950">{companion.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{companion.headline}</p>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap gap-1.5">
                            {[companion.relationship, companion.topic].map((tag) => (
                              <span className="max-w-32 truncate rounded-full border border-white/70 bg-white/45 px-2 py-1 text-[11px] font-medium text-slate-700" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="shrink-0 rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                            {companion.lastActive}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
