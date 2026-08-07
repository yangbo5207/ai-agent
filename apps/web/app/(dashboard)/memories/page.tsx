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
      <div className="flex min-h-14 items-center justify-between border-b border-[#e3e6e4] bg-[#fbfaf7] px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]">
            <Sparkles className="size-3.5 text-[#a37b4f]" />
            记忆详情
          </p>
          <p className="mt-0.5 text-[10px] text-[#929b98]">编辑、启用与溯源</p>
        </div>
      </div>

      {selectedMemory ? (
        <div>
          <div className="grid gap-4 p-4">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-medium text-[#687572]">类型</span>
              <Input
                className="h-9 rounded-md border-[#d9dfdc] bg-[#fffefa] text-sm font-medium text-[#53615e]"
                onChange={(event) => setEditForm((current) => ({ ...current, type: event.currentTarget.value }))}
                value={editForm.type}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-medium text-[#687572]">内容</span>
              <Textarea
                className="min-h-32 resize-y rounded-md border-[#d9dfdc] bg-[#fffefa] text-sm leading-6 text-[#53615e]"
                onChange={(event) => setEditForm((current) => ({ ...current, content: event.currentTarget.value }))}
                value={editForm.content}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-medium text-[#687572]">重要度</span>
              <Input
                className="h-9 rounded-md border-[#d9dfdc] bg-[#fffefa] text-sm font-medium text-[#53615e]"
                max={5}
                min={1}
                onChange={(event) => setEditForm((current) => ({ ...current, importance: Number(event.currentTarget.value) }))}
                type="number"
                value={editForm.importance}
              />
            </label>
            <div className="flex flex-wrap gap-2 border-t border-[#edf0ee] pt-4">
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

          <section className="border-t border-[#e3e6e4] px-4 py-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]">
              <MessageCircle className="size-3.5 text-[#a37b4f]" />
              来源片段
            </p>
            {selectedMemory.sourceMessage ? (
              <div className="mt-3 flex items-start gap-3 bg-[#f6f7f5] px-3 py-3">
                {selectedMemory.sourceMessage.role === "user" ? (
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-[#dfe3e1] bg-[#fffefa] text-[#687572]">
                    <UserRound className="size-4" />
                  </span>
                ) : selectedAgent ? (
                  <AgentAvatar
                    className="mt-0.5 size-8 shrink-0 rounded-md bg-[#eef1ef] text-[10px] text-[#53615e]"
                    fallbackClassName="bg-[#eef1ef] text-[#53615e]"
                    imageKey={selectedAgent.imageKey}
                    name={selectedAgent.name}
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-[#929b98]">
                    {selectedMemory.sourceMessage.role === "user" ? "用户消息" : "Agent 回复"} · {formatRelativeTime(selectedMemory.sourceMessage.createdAtMs)}
                  </p>
                  <p className="mt-2 whitespace-break-spaces text-[13px] leading-6 text-[#53615e]">{selectedMemory.sourceMessage.content}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] leading-6 text-[#89928f]">这条记忆暂无来源消息。</p>
            )}
          </section>
        </div>
      ) : (
        <div className="px-5 py-12 text-center">
          <Brain className="mx-auto size-8 text-[#c8cecb]" />
          <p className="mt-3 text-[13px] text-[#89928f]">选择一条记忆后可以编辑。</p>
        </div>
      )}
    </>
  )

  return (
    <DashboardShell
      headerRight={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          {selectedAgent ? (
            <span className="inline-flex h-7 max-w-40 items-center gap-1.5 rounded-full border border-[#d9dfdc] bg-[#fbfaf7] px-2.5 text-[10px] font-medium text-[#53615e]">
              <AgentAvatar
                className="size-4 rounded-[4px] text-[7px]"
                fallbackClassName="bg-[#eef1ef] text-[#53615e]"
                imageKey={selectedAgent.imageKey}
                name={selectedAgent.name}
              />
              <span className="truncate">{selectedAgent.name}</span>
            </span>
          ) : null}
          {memoryStats.map((item) => {
            const Icon = item.icon

            return (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#d9dfdc] bg-[#fbfaf7] px-2.5 text-[10px] font-medium text-[#53615e]" key={item.label}>
                <Icon className="size-3 text-[#a37b4f]" />
                <span className="text-[#9a8d7e]">{item.label}</span>
                <span className="font-semibold text-[#27353a]">{item.value}</span>
              </span>
            )
          })}
        </div>
      }
      title="记忆库"
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <section className="grid min-h-0 w-full flex-1 overflow-y-auto bg-white px-0 py-0 lg:h-full lg:overflow-hidden lg:grid-cols-[17rem_24rem_minmax(0,1fr)]">
          <aside className="flex h-56 min-h-0 shrink-0 flex-col overflow-hidden border-b border-[#e3e6e4] bg-white lg:h-full lg:border-r lg:border-b-0">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e3e6e4] bg-[#fffefa] px-3">
                <div>
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]"><Bot className="size-3.5 text-[#a37b4f]" />Agent</p>
                  <p className="mt-0.5 text-[10px] text-[#929b98]">选择要维护的记忆</p>
                </div>
                <span className="text-[10px] text-[#9a8d7e]">{agents.length} 位</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-0">
                {agentInboxQuery.isLoading ? (
                  <div className="px-3 py-5 text-sm text-slate-400">正在加载 Agent...</div>
                ) : agents.length === 0 ? (
                  <div className="px-3 py-5 text-sm leading-6 text-slate-400">还没有可管理记忆的 Agent。</div>
                ) : agents.map((agent) => {
                  const selected = selectedAgent?.id === agent.id

                  return (
                    <button
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-none px-3 py-3 text-left transition-[background-color,opacity] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] before:opacity-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] after:opacity-0",
                        selected ? "bg-[#f1f5f2] before:opacity-100 after:opacity-100" : "hover:bg-[#f7f9f7] hover:before:opacity-100 hover:after:opacity-100",
                      )}
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id)
                        setSelectedMemoryId("")
                        setIsMobileMemoryDetailOpen(false)
                      }}
                      type="button"
                    >
                      <AgentAvatar
                        className={cn("size-9 rounded-md text-xs", selected ? "bg-[#27353a] text-[#f9f5ed]" : "border-[#e0e4e2] bg-[#f1f3f2] text-[#53665f]")}
                        fallbackClassName={selected ? "bg-[#27353a] text-[#f9f5ed]" : "bg-[#f1f3f2] text-[#53665f]"}
                        imageKey={agent.imageKey}
                        name={agent.name}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#27353a]">{agent.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#929b98]">{agent.status}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="flex min-h-[24rem] min-w-0 flex-col overflow-hidden border-b border-[#e3e6e4] bg-[#fffefa] lg:h-full lg:min-h-0 lg:border-r lg:border-b-0">
              <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e3e6e4] bg-[#fbfaf7] px-4 py-2.5">
                <div>
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]"><Brain className="size-3.5 text-[#a37b4f]" />记忆目录</p>
                  <p className="mt-0.5 text-[10px] text-[#929b98]">{selectedAgent ? `${selectedAgent.name} 的长期记忆` : "请选择一个 Agent"}</p>
                </div>
                <span className="text-[10px] font-medium text-[#9a8d7e]">{memories.length} 条记录</span>
              </div>
              <div className="flex min-h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-[#e3e6e4] px-4 py-1.5">
                {categories.length > 0 ? categories.map(([type, count]) => (
                  <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-[#dfe3e1] bg-[#fffefa] px-2.5 text-[10px] font-medium text-[#687572]" key={type}>
                    {type} <span className="ml-1 text-[#9a8d7e]">{count}</span>
                  </span>
                )) : (
                  <span className="text-[11px] text-[#929b98]">暂无记忆分类</span>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[#e7e9e8]">
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
                        "group relative w-full px-4 py-4 text-left transition-[background-color,opacity] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] before:opacity-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] after:opacity-0",
                        selected ? "bg-[#f1f5f2] before:opacity-100 after:opacity-100" : "bg-[#fffefa] hover:bg-[#f7f9f7] hover:before:opacity-100 hover:after:opacity-100",
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[#27353a]">{memory.type}</p>
                          <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#687572]">{memory.content}</p>
                        </div>
                        <span className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          memory.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#dfe3e1] bg-[#f1f3f2] text-[#89928f]",
                        )}>
                          {memory.status === "active" ? "已启用" : "已停用"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#9a8d7e]">
                        <span>重要度 {getImportanceLabel(memory.importance)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(memory.updatedAtMs)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            <aside className="hidden min-h-0 overflow-y-auto bg-[#fffefa] lg:block lg:h-full">
              {memoryDetailContent}
            </aside>
        </section>

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
      </main>
    </DashboardShell>
  )
}
