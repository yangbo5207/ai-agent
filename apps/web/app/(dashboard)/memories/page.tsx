"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { UpdateAgentMemoryRequest } from "@repo/contracts"
import {
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Save,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"
import {
  deleteMyAgentMemory,
  getMyAgentInbox,
  getMyAgentMemories,
  updateMyAgentMemory,
} from "@/auth/api"
import { AgentAvatar } from "@/components/agent-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet"

function formatRelativeTime(updatedAtMs: number) {
  const diffMs = Math.max(0, Date.now() - updatedAtMs)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < minuteMs) {
    return "刚刚"
  }

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))} 分钟前`
  }

  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)} 小时前`
  }

  return `${Math.floor(diffMs / dayMs)} 天前`
}

function getImportanceLabel(value: number) {
  if (value >= 5) {
    return "高"
  }

  if (value >= 3) {
    return "中"
  }

  return "低"
}

export default function MemoriesPage() {
  const queryClient = useQueryClient()
  const agentInboxQuery = useQuery({
    queryKey: ["dashboard", "my-agent-inbox"],
    queryFn: getMyAgentInbox,
  })
  const agents = agentInboxQuery.data?.items ?? []
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null

  useEffect(() => {
    if (agents.length === 0) {
      if (selectedAgentId) {
        setSelectedAgentId("")
      }

      return
    }

    if (!selectedAgentId || !agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agents[0].id)
    }
  }, [agents, selectedAgentId])

  const memoriesQuery = useQuery({
    queryKey: ["agent-memories", selectedAgent?.id],
    queryFn: () => getMyAgentMemories(selectedAgent!.id),
    enabled: Boolean(selectedAgent),
  })
  const memories = memoriesQuery.data?.items ?? []
  const [selectedMemoryId, setSelectedMemoryId] = useState("")
  const [isMobileMemoryDetailOpen, setIsMobileMemoryDetailOpen] = useState(false)
  const selectedMemory = memories.find((memory) => memory.id === selectedMemoryId) ?? memories[0] ?? null
  const [editForm, setEditForm] = useState({
    type: "",
    content: "",
    importance: 3,
  })

  useEffect(() => {
    if (memories.length === 0) {
      if (selectedMemoryId) {
        setSelectedMemoryId("")
      }

      return
    }

    if (!selectedMemoryId || !memories.some((memory) => memory.id === selectedMemoryId)) {
      setSelectedMemoryId(memories[0].id)
    }
  }, [memories, selectedMemoryId])

  useEffect(() => {
    if (!selectedMemory) {
      setEditForm({ type: "", content: "", importance: 3 })
      return
    }

    setEditForm({
      type: selectedMemory.type,
      content: selectedMemory.content,
      importance: selectedMemory.importance,
    })
  }, [selectedMemory])

  const memoryStats = useMemo(() => {
    const active = memories.filter((memory) => memory.status === "active").length
    const disabled = memories.filter((memory) => memory.status === "disabled").length

    return [
      { label: "全部记忆", value: String(memories.length), icon: Brain },
      { label: "已启用", value: String(active), icon: CheckCircle2 },
      { label: "已停用", value: String(disabled), icon: Clock3 },
    ]
  }, [memories])

  const categories = useMemo(() => {
    const countByType = new Map<string, number>()

    for (const memory of memories) {
      countByType.set(memory.type, (countByType.get(memory.type) ?? 0) + 1)
    }

    return Array.from(countByType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [memories])

  const invalidateMemories = async () => {
    if (!selectedAgent) {
      return
    }

    await queryClient.invalidateQueries({ queryKey: ["agent-memories", selectedAgent.id] })
  }

  const updateMemoryMutation = useMutation({
    mutationFn: (input: { memoryId: string; patch: UpdateAgentMemoryRequest }) =>
      updateMyAgentMemory(selectedAgent!.id, input.memoryId, input.patch),
    onSuccess: invalidateMemories,
  })
  const deleteMemoryMutation = useMutation({
    mutationFn: (memoryId: string) => deleteMyAgentMemory(selectedAgent!.id, memoryId),
    onSuccess: async () => {
      setSelectedMemoryId("")
      setIsMobileMemoryDetailOpen(false)
      await invalidateMemories()
    },
  })

  const memoryDetailContent = (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="size-4 text-slate-400" />
            记忆详情
          </p>
          <p className="mt-1 text-xs text-slate-400">编辑、启用与溯源</p>
        </div>
      </div>

      {selectedMemory ? (
        <div>
          <div className="grid gap-4 p-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-500">类型</span>
              <Input
                className="h-10 rounded-md border-slate-200 text-sm font-medium text-slate-800"
                onChange={(event) => setEditForm((current) => ({ ...current, type: event.currentTarget.value }))}
                value={editForm.type}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-500">内容</span>
              <Textarea
                className="min-h-32 resize-y rounded-md border-slate-200 text-sm leading-6 text-slate-800"
                onChange={(event) => setEditForm((current) => ({ ...current, content: event.currentTarget.value }))}
                value={editForm.content}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-slate-500">重要度</span>
              <Input
                className="h-10 rounded-md border-slate-200 text-sm font-medium text-slate-800"
                max={5}
                min={1}
                onChange={(event) => setEditForm((current) => ({ ...current, importance: Number(event.currentTarget.value) }))}
                type="number"
                value={editForm.importance}
              />
            </label>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Button
                className="rounded-md"
                disabled={updateMemoryMutation.isPending}
                onClick={() => {
                  void updateMemoryMutation.mutateAsync({
                    memoryId: selectedMemory.id,
                    patch: editForm,
                  })
                }}
                type="button"
              >
                <Save className="size-4" />
                保存
              </Button>
              <Button
                className="rounded-md"
                disabled={updateMemoryMutation.isPending}
                onClick={() => {
                  void updateMemoryMutation.mutateAsync({
                    memoryId: selectedMemory.id,
                    patch: { status: selectedMemory.status === "active" ? "disabled" : "active" },
                  })
                }}
                type="button"
                variant="outline"
              >
                {selectedMemory.status === "active" ? "停用" : "启用"}
              </Button>
              <Button
                className="rounded-md border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                disabled={deleteMemoryMutation.isPending}
                onClick={() => {
                  void deleteMemoryMutation.mutateAsync(selectedMemory.id)
                }}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                删除
              </Button>
            </div>
          </div>

          <section className="border-t border-slate-200 px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageCircle className="size-4 text-slate-400" />
              来源片段
            </p>
            {selectedMemory.sourceMessage ? (
              <div className="mt-3 flex items-start gap-3 bg-slate-50 px-3 py-3">
                {selectedMemory.sourceMessage.role === "user" ? (
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
                    <UserRound className="size-4" />
                  </span>
                ) : selectedAgent ? (
                  <AgentAvatar
                    className="mt-0.5 size-8 shrink-0 rounded-md bg-slate-100 text-[10px] text-slate-700"
                    fallbackClassName="bg-slate-100 text-slate-700"
                    imageKey={selectedAgent.imageKey}
                    name={selectedAgent.name}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-400">
                    {selectedMemory.sourceMessage.role === "user" ? "用户消息" : "Agent 回复"} · {formatRelativeTime(selectedMemory.sourceMessage.createdAtMs)}
                  </p>
                  <p className="mt-2 whitespace-break-spaces text-sm leading-6 text-slate-700">{selectedMemory.sourceMessage.content}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">这条记忆暂无来源消息。</p>
            )}
          </section>
        </div>
      ) : (
        <div className="px-5 py-12 text-center">
          <Brain className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">选择一条记忆后可以编辑。</p>
        </div>
      )}
    </>
  )

  return (
    <DashboardShell title="记忆库">
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
        <section className="border-b bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-medium text-slate-400">MEMORY LIBRARY</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">记忆库</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">管理 Agent 在对话中可调用的长期记忆，并为每条记忆保留清晰的来源与启用状态。</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {selectedAgent ? (
                <div className="flex min-w-40 items-center gap-2.5">
                  <AgentAvatar
                    className="size-8 rounded-md"
                    imageKey={selectedAgent.imageKey}
                    name={selectedAgent.name}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-400">当前 Agent</p>
                    <p className="truncate text-sm font-medium text-slate-800">{selectedAgent.name}</p>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-3 divide-x divide-slate-200 border-l border-slate-200">
                {memoryStats.map((item) => {
                  const Icon = item.icon

                  return (
                    <div className="min-w-16 px-3 first:pl-4 last:pr-0 sm:min-w-20 sm:px-4" key={item.label}>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                        <Icon className="size-3.5" />
                        <span className="hidden sm:inline">{item.label}</span>
                      </div>
                      <p className="mt-1 text-lg font-semibold leading-none text-slate-800">{item.value}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-6 lg:px-8">
          <div className="mx-auto grid max-w-[90rem] gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_22rem]">
            <aside className="overflow-hidden border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Agent</p>
                  <p className="mt-1 text-xs text-slate-400">选择要维护的记忆</p>
                </div>
                <Bot className="size-4 text-slate-400" />
              </div>
              <div className="flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-y-auto">
                {agentInboxQuery.isLoading ? (
                  <div className="px-3 py-5 text-sm text-slate-400">正在加载 Agent...</div>
                ) : agents.length === 0 ? (
                  <div className="px-3 py-5 text-sm leading-6 text-slate-400">还没有可管理记忆的 Agent。</div>
                ) : agents.map((agent) => {
                  const selected = selectedAgent?.id === agent.id

                  return (
                    <button
                      className={cn(
                        "relative flex min-w-48 items-center gap-3 rounded-md px-3 py-3 text-left transition-colors lg:min-w-0 lg:w-full",
                        selected ? "bg-slate-100" : "hover:bg-slate-50",
                      )}
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id)
                        setSelectedMemoryId("")
                        setIsMobileMemoryDetailOpen(false)
                      }}
                      type="button"
                    >
                      {selected ? <span className="absolute inset-y-2 left-0 w-0.5 bg-slate-950" /> : null}
                      <AgentAvatar
                        className="size-9 rounded-md bg-slate-100 text-xs text-slate-700"
                        fallbackClassName="bg-slate-100 text-slate-700"
                        imageKey={agent.imageKey}
                        name={agent.name}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{agent.name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{agent.status}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="min-w-0 overflow-hidden border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">记忆目录</p>
                  <p className="mt-1 text-xs text-slate-400">{selectedAgent ? `${selectedAgent.name} 的长期记忆` : "请选择一个 Agent"}</p>
                </div>
                <span className="text-xs font-medium text-slate-400">{memories.length} 条记录</span>
              </div>
              <div className="flex min-h-12 items-center gap-2 overflow-x-auto border-b border-slate-200 px-4 py-2">
                {categories.length > 0 ? categories.map(([type, count]) => (
                  <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600" key={type}>
                    {type} <span className="ml-1 text-slate-400">{count}</span>
                  </span>
                )) : (
                  <span className="text-sm text-slate-400">暂无记忆分类</span>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {memoriesQuery.isLoading ? (
                  [1, 2, 3].map((item) => (
                    <div className="px-4 py-5" key={item}>
                      <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
                      <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100" />
                    </div>
                  ))
                ) : memories.length === 0 ? (
                  <div className="px-5 py-14 text-center">
                    <Brain className="mx-auto size-8 text-slate-300" />
                    <p className="mt-3 text-sm font-medium text-slate-700">还没有沉淀长期记忆</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">与 Agent 聊天后，系统会从稳定偏好、边界和目标中自动生成记忆。</p>
                  </div>
                ) : memories.map((memory) => {
                  const selected = selectedMemory?.id === memory.id

                  return (
                    <button
                      className={cn(
                        "relative w-full px-4 py-4 text-left transition-colors",
                        selected ? "bg-slate-50" : "bg-white hover:bg-slate-50",
                      )}
                      key={memory.id}
                      onClick={() => {
                        setSelectedMemoryId(memory.id)

                        if (window.matchMedia("(max-width: 1023px)").matches) {
                          setIsMobileMemoryDetailOpen(true)
                        }
                      }}
                      type="button"
                    >
                      {selected ? <span className="absolute inset-y-0 left-0 w-0.5 bg-slate-950" /> : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{memory.type}</p>
                          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{memory.content}</p>
                        </div>
                        <span className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-[11px] font-medium",
                          memory.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                        )}>
                          {memory.status === "active" ? "已启用" : "已停用"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>重要度 {getImportanceLabel(memory.importance)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(memory.updatedAtMs)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <aside className="hidden overflow-hidden border border-slate-200 bg-white lg:col-span-2 lg:block xl:col-span-1">
              {memoryDetailContent}
            </aside>
          </div>

          <Sheet open={isMobileMemoryDetailOpen} onOpenChange={setIsMobileMemoryDetailOpen}>
            <SheetContent className="!w-[min(26rem,94vw)] gap-0 p-0 sm:!max-w-none" side="right">
              <SheetHeader className="sr-only">
                <SheetTitle>编辑记忆</SheetTitle>
                <SheetDescription>编辑当前记忆的内容、重要度与启用状态，并查看来源片段。</SheetDescription>
              </SheetHeader>
              <div className="h-full w-full overflow-y-auto">
                {memoryDetailContent}
              </div>
            </SheetContent>
          </Sheet>
        </section>
      </main>
    </DashboardShell>
  )
}
