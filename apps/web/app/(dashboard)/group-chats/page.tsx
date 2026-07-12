"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AgentGroupChat,
  AgentGroupChatDetailResponse,
  AgentGroupChatListResponse,
  AgentGroupChatMessage,
  MyAgentInboxItem,
} from "@repo/contracts"
import {
  Bot,
  Check,
  CirclePlus,
  Loader2,
  MessageCircle,
  MessagesSquare,
  PanelLeftOpen,
  RadioTower,
  Search,
  Users,
  X,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"
import {
  addAgentGroupChatMembers,
  createAgentGroupChat,
  getAgentGroupChatDetail,
  getAgentGroupChatMessages,
  getAgentGroupChats,
  getMyAgentInbox,
  removeAgentGroupChatMember,
  sendAgentGroupChatMessage,
} from "@/auth/api"
import {
  localLlmConfigChangedEventName,
  readLocalLlmConfigStore,
  selectLocalLlmConfig,
  type LocalLlmConfigStore,
} from "@/auth/local-llm-config"
import { MessageResponse } from "@/components/ai-elements/message"
import { AgentAvatar } from "@/components/agent-avatar"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet"

type GroupCreateDialogProps = {
  agents: MyAgentInboxItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (groupChatId: string) => void
}

function formatTime(timestamp: number | null) {
  if (!timestamp) {
    return "暂无消息"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function getMessagePreview(groupChat: AgentGroupChat) {
  if (!groupChat.latestMessage) {
    return "邀请几个 Agent 进来，开启一个新的多人陪伴场景。"
  }

  const speaker = groupChat.latestMessage.senderType === "agent"
    ? groupChat.latestMessage.agentName ?? "Agent"
    : "你"

  return `${speaker}：${groupChat.latestMessage.content}`
}

const groupQuickPrompts = ["汇总一下大家的意见", "请给出不同的视角", "一起制定下一步计划"]

type GroupChatListProps = {
  className?: string
  groupChats: AgentGroupChat[]
  isError: boolean
  isLoading: boolean
  onClose?: () => void
  onSelect: (groupChatId: string) => void
  selectedGroupChatId: string | null
}

function GroupChatList({
  className,
  groupChats,
  isError,
  isLoading,
  onClose,
  onSelect,
  selectedGroupChatId,
}: GroupChatListProps) {
  return (
    <aside className={cn("flex min-h-0 flex-col overflow-hidden border border-slate-200 bg-white", className)}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">群聊</p>
          <p className="mt-1 text-xs text-slate-400">选择一个会话继续讨论</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{groupChats.length}</span>
          {onClose ? (
            <button
              aria-label="关闭群聊列表"
              className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              onClick={onClose}
              title="关闭"
              type="button"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex min-h-44 items-center justify-center text-sm text-slate-400">正在加载群聊...</div>
        ) : isError ? (
          <div className="flex min-h-44 items-center justify-center px-4 text-center text-sm text-red-600">群聊列表加载失败</div>
        ) : groupChats.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
            <MessagesSquare className="size-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">还没有群聊</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">创建一个群聊，邀请 Agent 一起参与讨论。</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupChats.map((groupChat) => {
              const selected = groupChat.id === selectedGroupChatId

              return (
                <button
                  className={cn("relative w-full px-4 py-3 text-left transition-colors", selected ? "bg-slate-50" : "bg-white hover:bg-slate-50")}
                  key={groupChat.id}
                  onClick={() => onSelect(groupChat.id)}
                  type="button"
                >
                  {selected ? <span className="absolute inset-y-0 left-0 w-0.5 bg-slate-950" /> : null}
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-800">{groupChat.title}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatTime(groupChat.lastMessageAtMs)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs leading-5 text-slate-400">{getMessagePreview(groupChat)}</span>
                  <span className="mt-2 flex items-center gap-1">
                    {groupChat.members.slice(0, 4).map((member) => <AgentAvatar className="size-5 rounded-sm" imageKey={member.imageKey} key={member.id} name={member.name} />)}
                    {groupChat.members.length > 4 ? <span className="text-[11px] text-slate-400">+{groupChat.members.length - 4}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

type GroupMembersPanelProps = {
  agentSearch: string
  className?: string
  filteredAgents: MyAgentInboxItem[]
  isAdding: boolean
  isLoadingAgents: boolean
  isRemoving: boolean
  members: AgentGroupChat["members"]
  onAddAgent: (agentId: string) => void
  onAgentSearchChange: (value: string) => void
  onClose?: () => void
  onRemoveMember: (memberId: string) => void
  readonly: boolean
}

function GroupMembersPanel({
  agentSearch,
  className,
  filteredAgents,
  isAdding,
  isLoadingAgents,
  isRemoving,
  members,
  onAddAgent,
  onAgentSearchChange,
  onClose,
  onRemoveMember,
  readonly,
}: GroupMembersPanelProps) {
  return (
    <aside className={cn("min-h-0 overflow-hidden border border-slate-200 bg-white", className)}>
      <section>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">群成员</p>
            <p className="mt-1 text-xs text-slate-400">{members.length} / 6 位 Agent</p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-slate-400" />
            {onClose ? (
              <button
                aria-label="关闭成员管理"
                className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                onClick={onClose}
                title="关闭"
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {members.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">暂无成员</div>
          ) : (
            members.map((member) => (
              <div className="flex items-center gap-3 px-4 py-3" key={member.id}>
                <AgentAvatar className="size-8 rounded-md" imageKey={member.imageKey} name={member.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{member.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{member.headline || "Agent 伴侣"}</p>
                </div>
                <button
                  aria-label={`移除 ${member.name}`}
                  className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  disabled={readonly || isRemoving || members.length <= 1}
                  onClick={() => onRemoveMember(member.id)}
                  title={`移除 ${member.name}`}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="border-t border-slate-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">邀请 Agent</p>
            <p className="mt-1 text-xs text-slate-400">从你的伴侣列表中加入</p>
          </div>
          <Bot className="size-4 text-slate-400" />
        </div>
        <div className="relative px-4">
          <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-9 rounded-md border-slate-200 bg-white pl-9 text-sm"
            onChange={(event) => onAgentSearchChange(event.currentTarget.value)}
            placeholder="搜索 Agent"
            value={agentSearch}
          />
        </div>
        <div className="mt-3 divide-y divide-slate-100 px-4 pb-4">
          {isLoadingAgents ? (
            <div className="py-6 text-center text-sm text-slate-400">正在加载 Agent...</div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">没有可邀请的 Agent</div>
          ) : (
            filteredAgents.map((agent) => (
              <button
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={readonly || members.length >= 6 || isAdding}
                key={agent.id}
                onClick={() => onAddAgent(agent.id)}
                type="button"
              >
                <AgentAvatar className="size-8 rounded-md" imageKey={agent.imageKey} name={agent.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-700">{agent.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">{agent.headline}</span>
                </span>
                <CirclePlus className="size-4 shrink-0 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </section>
    </aside>
  )
}

function toLlmRequestConfig(store: LocalLlmConfigStore) {
  const selected = store.items.find((item) => item.enabled && item.id === store.selectedConfigId)

  if (!selected) {
    return null
  }

  return {
    providerName: selected.providerName,
    baseURL: selected.baseURL,
    model: selected.model,
    apiKey: selected.apiKey,
    wireApi: selected.wireApi,
    ...(selected.reasoningEffort ? { reasoningEffort: selected.reasoningEffort } : {}),
  }
}

function GroupCreateDialog({ agents, open, onCreated, onOpenChange }: GroupCreateDialogProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("周末闲聊小队")
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const createMutation = useMutation({
    mutationFn: () => createAgentGroupChat({
      title: title.trim(),
      agentIds: selectedAgentIds,
    }),
    async onSuccess(response) {
      queryClient.setQueryData<AgentGroupChatListResponse>(["agent-group-chats"], (current) => ({
        items: [
          response.groupChat,
          ...(current?.items ?? []).filter((item) => item.id !== response.groupChat.id),
        ],
      }))
      await queryClient.invalidateQueries({ queryKey: ["agent-group-chats"] })
      onCreated(response.groupChat.id)
      onOpenChange(false)
      setTitle("周末闲聊小队")
      setSelectedAgentIds([])
    },
  })

  function toggleAgent(agentId: string) {
    setSelectedAgentIds((current) => {
      if (current.includes(agentId)) {
        return current.filter((id) => id !== agentId)
      }

      return [...current, agentId].slice(0, 6)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-lg p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>创建 Agent 群聊</DialogTitle>
          <DialogDescription>
            选择 1-6 个 Agent。第一版采用受控回复，每轮会选择最合适的 1-3 个 Agent 发言。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4">
          <label className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">群聊名称</span>
            <Input
              className="h-10 rounded-md"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="例如：深夜陪伴小队"
              value={title}
            />
          </label>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">邀请 Agent</span>
              <span className="text-xs text-muted-foreground">{selectedAgentIds.length}/6</span>
            </div>
            <div className="max-h-[20rem] overflow-y-auto border-y border-slate-200">
              {agents.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                  还没有可邀请的 Agent
                </div>
              ) : (
                agents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id)

                  return (
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-slate-100 px-1 py-3 text-left transition-colors last:border-b-0",
                        selected ? "bg-slate-100" : "hover:bg-slate-50",
                      )}
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      type="button"
                    >
                      <AgentAvatar
                        className="size-10 rounded-md"
                        imageKey={agent.imageKey}
                        name={agent.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-950">{agent.name}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{agent.headline}</div>
                      </div>
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border",
                          selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
          {createMutation.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createMutation.error instanceof Error ? createMutation.error.message : "创建群聊失败"}
            </div>
          ) : null}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-2xl">
          <Button
            disabled={!title.trim() || selectedAgentIds.length === 0 || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CirclePlus className="size-4" />}
            创建群聊
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageBubble({ message }: { message: AgentGroupChatMessage }) {
  const isUser = message.senderType === "user"
  const isAgent = message.senderType === "agent"

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {isAgent ? (
        <AgentAvatar
          className="mt-5 size-8 rounded-md"
          imageKey={message.agentImageKey}
          name={message.agentName ?? "Agent"}
        />
      ) : null}
      <div className={cn("max-w-[82%] sm:max-w-[min(38rem,82%)]", isUser && "order-first")}>
        <div className={cn("mb-1 flex items-center gap-2 text-xs text-muted-foreground", isUser && "justify-end")}>
          <span>{isUser ? "你" : message.agentName ?? "Agent"}</span>
          <span>{formatTime(message.createdAtMs)}</span>
        </div>
        <div
          className={cn(
            "border px-4 py-3 text-sm leading-6",
            isUser
              ? "whitespace-pre-wrap rounded-md border-slate-950 bg-slate-950 text-white"
              : "rounded-md border-slate-200 bg-white text-slate-800",
          )}
        >
          {isUser ? (
            message.content
          ) : (
            <MessageResponse className="[&_p]:leading-6">
              {message.content}
            </MessageResponse>
          )}
        </div>
      </div>
      {isUser ? (
        <span className="mt-5 flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-950 bg-slate-950 text-white">
          <Users className="size-4" />
        </span>
      ) : null}
    </div>
  )
}

export default function GroupChatsPage() {
  const queryClient = useQueryClient()
  const [selectedGroupChatId, setSelectedGroupChatId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [isMobileGroupListOpen, setIsMobileGroupListOpen] = useState(false)
  const [isMobileMembersOpen, setIsMobileMembersOpen] = useState(false)
  const [draftMessage, setDraftMessage] = useState("")
  const [agentSearch, setAgentSearch] = useState("")
  const [llmStore, setLlmStore] = useState<LocalLlmConfigStore>({ selectedConfigId: null, items: [] })
  const shouldStickToBottomRef = useRef(false)
  const messageScrollRef = useRef<HTMLDivElement | null>(null)
  const groupChatsQuery = useQuery({
    queryKey: ["agent-group-chats"],
    queryFn: getAgentGroupChats,
  })
  const agentInboxQuery = useQuery({
    queryKey: ["dashboard", "my-agent-inbox", "group-chats"],
    queryFn: getMyAgentInbox,
  })
  const groupChats = groupChatsQuery.data?.items ?? []
  const selectedGroupChat = groupChats.find((groupChat) => groupChat.id === selectedGroupChatId) ?? groupChats[0] ?? null
  const detailQuery = useQuery({
    queryKey: ["agent-group-chat", selectedGroupChat?.id],
    queryFn: () => getAgentGroupChatDetail(selectedGroupChat?.id ?? ""),
    enabled: Boolean(selectedGroupChat?.id),
  })
  const availableAgents = agentInboxQuery.data?.items ?? []
  const currentMembers = detailQuery.data?.groupChat.members ?? selectedGroupChat?.members ?? []
  const filteredAvailableAgents = useMemo(() => {
    const normalized = agentSearch.trim().toLowerCase()
    const currentMemberAgentIds = new Set(currentMembers.map((member) => member.agentId))

    return availableAgents.filter((agent) => {
      if (currentMemberAgentIds.has(agent.id)) {
        return false
      }

      if (!normalized) {
        return true
      }

      return [agent.name, agent.headline, agent.profileNote].some((value) => value.toLowerCase().includes(normalized))
    })
  }, [agentSearch, availableAgents, currentMembers])
  const enabledLlmConfigs = llmStore.items.filter((item) => item.enabled)
  const selectedLlmConfig =
    enabledLlmConfigs.find((item) => item.id === llmStore.selectedConfigId) ?? null
  const sendMutation = useMutation({
    mutationFn: ({ groupChatId, message }: { groupChatId: string; message: string }) => {
      const llmConfig = toLlmRequestConfig(readLocalLlmConfigStore())

      return sendAgentGroupChatMessage({
        groupChatId,
        message,
        ...(llmConfig ? { llmConfig } : {}),
      })
    },
    onMutate(variables) {
      const previousDetail = queryClient.getQueryData<AgentGroupChatDetailResponse>([
        "agent-group-chat",
        variables.groupChatId,
      ])
      const optimisticMessage: AgentGroupChatMessage = {
        id: `optimistic-${Date.now()}`,
        groupChatId: variables.groupChatId,
        senderType: "user",
        agentId: null,
        agentName: null,
        agentImageKey: null,
        content: variables.message,
        status: "completed",
        turnIndex: (previousDetail?.messages.at(-1)?.turnIndex ?? 0) + 1,
        createdAtMs: Date.now(),
      }

      queryClient.setQueryData<AgentGroupChatDetailResponse>(
        ["agent-group-chat", variables.groupChatId],
        (current) => current
          ? {
              ...current,
              groupChat: {
                ...current.groupChat,
                latestMessage: optimisticMessage,
                lastMessageAtMs: optimisticMessage.createdAtMs,
                messageCount: current.groupChat.messageCount + 1,
              },
              messages: [...current.messages, optimisticMessage],
            }
          : current,
      )
      queryClient.setQueryData<AgentGroupChatListResponse>(["agent-group-chats"], (current) => current
        ? {
            items: current.items.map((item) => item.id === variables.groupChatId
              ? {
                  ...item,
                  latestMessage: optimisticMessage,
                  lastMessageAtMs: optimisticMessage.createdAtMs,
                  messageCount: item.messageCount + 1,
                }
              : item),
          }
        : current)
      setDraftMessage("")

      return {
        optimisticMessageId: optimisticMessage.id,
        previousDetail,
      }
    },
    async onSuccess(response, variables, context) {
      queryClient.setQueryData<AgentGroupChatDetailResponse>(
        ["agent-group-chat", variables.groupChatId],
        (current) => current
          ? {
              ...current,
              groupChat: response.groupChat,
              messages: [
                ...current.messages.filter((message) => (
                  message.id !== context?.optimisticMessageId &&
                  message.id !== response.userMessage.id &&
                  !response.agentMessages.some((agentMessage) => agentMessage.id === message.id)
                )),
                response.userMessage,
                ...response.agentMessages,
              ],
            }
          : current,
      )
      queryClient.setQueryData<AgentGroupChatListResponse>(["agent-group-chats"], (current) => current
        ? {
            items: [
              response.groupChat,
              ...current.items.filter((item) => item.id !== response.groupChat.id),
            ],
          }
        : current)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-group-chats"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-group-chat", variables.groupChatId] }),
      ])
    },
    onError(_, variables, context) {
      if (context?.previousDetail) {
        queryClient.setQueryData(["agent-group-chat", variables.groupChatId], context.previousDetail)
      }
      setDraftMessage(variables.message)
    },
  })
  const addMemberMutation = useMutation({
    mutationFn: ({ groupChatId, agentId }: { groupChatId: string; agentId: string }) => addAgentGroupChatMembers(groupChatId, { agentIds: [agentId] }),
    async onSuccess(_, variables) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-group-chats"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-group-chat", variables.groupChatId] }),
      ])
    },
  })
  const removeMemberMutation = useMutation({
    mutationFn: ({ groupChatId, memberId }: { groupChatId: string; memberId: string }) => removeAgentGroupChatMember(groupChatId, memberId),
    async onSuccess(_, variables) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agent-group-chats"] }),
        queryClient.invalidateQueries({ queryKey: ["agent-group-chat", variables.groupChatId] }),
      ])
    },
  })
  const loadMoreMessagesMutation = useMutation({
    mutationFn: ({ groupChatId, cursor }: { groupChatId: string; cursor: string }) => getAgentGroupChatMessages(groupChatId, cursor),
    onSuccess(response, variables) {
      queryClient.setQueryData<AgentGroupChatDetailResponse>(
        ["agent-group-chat", variables.groupChatId],
        (current) => current
          ? {
              ...current,
              messages: [
                ...response.messages,
                ...current.messages.filter((message) => !response.messages.some((item) => item.id === message.id)),
              ],
              nextCursor: response.nextCursor,
            }
          : current,
      )
    },
  })

  useEffect(() => {
    setLlmStore(readLocalLlmConfigStore())

    function handleChanged() {
      setLlmStore(readLocalLlmConfigStore())
    }

    window.addEventListener(localLlmConfigChangedEventName, handleChanged)

    return () => window.removeEventListener(localLlmConfigChangedEventName, handleChanged)
  }, [])

  useEffect(() => {
    if (selectedGroupChatId && groupChats.some((groupChat) => groupChat.id === selectedGroupChatId)) {
      return
    }

    setSelectedGroupChatId(groupChats[0]?.id ?? null)
  }, [groupChats, selectedGroupChatId])

  const messages = detailQuery.data?.messages ?? []
  const isSending = sendMutation.isPending
  const latestMessageId = messages.at(-1)?.id ?? null

  useEffect(() => {
    if (!selectedGroupChat?.id) {
      return
    }

    const shouldScrollToBottom = shouldStickToBottomRef.current || isSending

    if (!shouldScrollToBottom) {
      return
    }

    requestAnimationFrame(() => {
      const container = messageScrollRef.current

      if (!container) {
        return
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      })
    })
  }, [isSending, latestMessageId, selectedGroupChat?.id])

  return (
    <DashboardShell title="Agent 群聊">
      <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-50/70">
        <section className="shrink-0 border-b bg-white">
          <div className="mx-auto flex max-w-[90rem] items-end justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-6 lg:px-8">
            <div>
              <p className="text-xs font-medium text-slate-400">MULTI-AGENT</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">Agent 群聊</h1>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-600 sm:block">让多个 Agent 围绕同一个话题协作回应，每轮由系统控制参与范围。</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <span className="hidden text-sm text-slate-500 sm:inline">{groupChats.length} 个群聊</span>
              <Button className="h-9 rounded-md px-3 sm:h-10 sm:px-4" onClick={() => setCreateDialogOpen(true)}>
                <CirclePlus className="size-4" />
                新建群聊
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto grid min-h-0 w-full max-w-[90rem] flex-1 gap-4 px-0 py-0 sm:px-5 sm:py-6 lg:grid-cols-[18rem_minmax(0,1fr)_18rem] lg:gap-6 lg:overflow-hidden lg:px-8 lg:py-8">
          <GroupChatList
            className="hidden lg:flex"
            groupChats={groupChats}
            isError={groupChatsQuery.isError}
            isLoading={groupChatsQuery.isLoading}
            onSelect={setSelectedGroupChatId}
            selectedGroupChatId={selectedGroupChat?.id ?? null}
          />

          <section className="flex min-h-0 flex-col overflow-hidden bg-white sm:border sm:border-slate-200">
            {selectedGroupChat ? (
              <>
                <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      aria-label="选择群聊"
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
                      onClick={() => setIsMobileGroupListOpen(true)}
                      title="选择群聊"
                      type="button"
                    >
                      <PanelLeftOpen className="size-4" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900">{selectedGroupChat.title}</h2>
                      <p className="mt-1 text-xs text-slate-400">{currentMembers.length} 位 Agent · {detailQuery.data?.groupChat.messageCount ?? selectedGroupChat.messageCount} 条消息</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      aria-label="管理群成员"
                      className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
                      onClick={() => setIsMobileMembersOpen(true)}
                      title="管理群成员"
                      type="button"
                    >
                      <Users className="size-4" />
                    </button>
                    <div className="hidden items-center -space-x-1.5 sm:flex">
                      {currentMembers.slice(0, 5).map((member) => <AgentAvatar className="size-7 rounded-md border-2 border-white" imageKey={member.imageKey} key={member.id} name={member.name} />)}
                    </div>
                  </div>
                </header>
                <div ref={messageScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-3 py-4 sm:px-5 sm:py-6">
                  {detailQuery.isLoading ? (
                    <div className="flex h-full min-h-80 items-center justify-center text-sm text-slate-400">正在加载群聊消息...</div>
                  ) : detailQuery.isError ? (
                    <div className="flex h-full min-h-80 items-center justify-center text-sm text-red-600">群聊消息加载失败</div>
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-80 items-center justify-center">
                      <div className="max-w-md text-center">
                        <MessageCircle className="mx-auto size-9 text-slate-300" />
                        <p className="mt-4 text-sm font-medium text-slate-700">开始第一轮群聊</p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">直接提问或点名某个 Agent；也可以说“你们怎么看”。</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
                      {detailQuery.data?.nextCursor ? (
                        <div className="flex justify-center">
                          <Button
                            className="rounded-md"
                            disabled={loadMoreMessagesMutation.isPending}
                            onClick={() => {
                              if (selectedGroupChat && detailQuery.data?.nextCursor) {
                                loadMoreMessagesMutation.mutate({ groupChatId: selectedGroupChat.id, cursor: detailQuery.data.nextCursor })
                              }
                            }}
                            size="sm"
                            variant="outline"
                          >
                            {loadMoreMessagesMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                            加载更早消息
                          </Button>
                        </div>
                      ) : null}
                      {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
                    </div>
                  )}
                  {sendMutation.isPending ? (
                    <div className="mx-auto mt-5 flex max-w-3xl items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" /> Agent 正在组织回复...</div>
                  ) : null}
                  {sendMutation.isError ? (
                    <div className="mx-auto mt-5 max-w-3xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sendMutation.error instanceof Error ? sendMutation.error.message : "发送失败"}</div>
                  ) : null}
                </div>
                <footer className="shrink-0 border-t bg-white px-3 py-3 sm:px-4 sm:py-4">
                  <PromptInput
                    className="mx-auto max-w-3xl border border-slate-200 bg-white"
                    onSubmit={(message) => {
                      const text = message.text.trim()

                      if (!text || !selectedGroupChat || isSending) {
                        return
                      }

                      shouldStickToBottomRef.current = true
                      sendMutation.mutate({ groupChatId: selectedGroupChat.id, message: text })
                    }}
                  >
                    <PromptInputHeader className="border-b bg-slate-50/70 px-3 py-2">
                      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                        {groupQuickPrompts.map((prompt) => (
                          <button
                            className="h-7 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSending}
                            key={prompt}
                            onClick={() => setDraftMessage(prompt)}
                            type="button"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </PromptInputHeader>
                    <PromptInputTextarea
                      className="max-h-36 min-h-[4.5rem] px-3 py-3 text-sm sm:max-h-44 sm:min-h-20"
                      disabled={isSending}
                      onChange={(event) => setDraftMessage(event.currentTarget.value)}
                      placeholder="输入群聊消息，可以点名 Agent 或邀请大家一起讨论..."
                      value={draftMessage}
                    />
                    <PromptInputFooter className="border-t bg-slate-50/70 px-3 py-2">
                      <PromptInputTools className="min-w-0 gap-2 text-xs text-muted-foreground">
                        <label className="flex min-w-0 items-center gap-1.5">
                          <RadioTower className="size-3.5" />
                          <PromptInputSelect
                            disabled={isSending}
                            onValueChange={(value) => {
                              selectLocalLlmConfig(value === "platform-default" ? null : value)
                              setLlmStore(readLocalLlmConfigStore())
                            }}
                            value={selectedLlmConfig?.id ?? "platform-default"}
                          >
                            <PromptInputSelectTrigger
                              aria-label="选择本次群聊使用的 LLM"
                              className="h-7 max-w-[calc(100vw-8rem)] rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 data-placeholder:text-slate-500 sm:max-w-56"
                              size="sm"
                            >
                              <PromptInputSelectValue placeholder="平台默认" />
                            </PromptInputSelectTrigger>
                            <PromptInputSelectContent className="min-w-56 rounded-md border border-slate-200 shadow-none">
                              <PromptInputSelectItem value="platform-default">平台默认</PromptInputSelectItem>
                              {enabledLlmConfigs.map((item) => (
                                <PromptInputSelectItem key={item.id} value={item.id}>
                                  {item.name} · {item.model} · {item.wireApi === "responses" ? "Responses" : "Chat"}
                                </PromptInputSelectItem>
                              ))}
                            </PromptInputSelectContent>
                          </PromptInputSelect>
                        </label>
                      </PromptInputTools>
                      <PromptInputSubmit
                        className="rounded-md"
                        disabled={!draftMessage.trim() || !selectedGroupChat || isSending}
                        status={isSending ? "submitted" : "ready"}
                      />
                    </PromptInputFooter>
                  </PromptInput>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-5 py-12">
                <div className="max-w-md text-center">
                  <MessagesSquare className="mx-auto size-10 text-slate-300" />
                  <h2 className="mt-4 text-base font-semibold text-slate-950">创建第一个 Agent 群聊</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">选择多个 Agent，让它们围绕同一个话题协作回应。</p>
                  <Button className="mt-5 rounded-md" onClick={() => setCreateDialogOpen(true)}>
                    <CirclePlus className="size-4" />
                    新建群聊
                  </Button>
                </div>
              </div>
            )}
          </section>

          <GroupMembersPanel
            agentSearch={agentSearch}
            className="hidden lg:block lg:overflow-y-auto"
            filteredAgents={filteredAvailableAgents}
            isAdding={addMemberMutation.isPending}
            isLoadingAgents={agentInboxQuery.isLoading}
            isRemoving={removeMemberMutation.isPending}
            members={currentMembers}
            onAddAgent={(agentId) => {
              if (selectedGroupChat) {
                addMemberMutation.mutate({ groupChatId: selectedGroupChat.id, agentId })
              }
            }}
            onAgentSearchChange={setAgentSearch}
            onRemoveMember={(memberId) => {
              if (selectedGroupChat) {
                removeMemberMutation.mutate({ groupChatId: selectedGroupChat.id, memberId })
              }
            }}
            readonly={!selectedGroupChat}
          />
        </section>

        <Sheet open={isMobileGroupListOpen} onOpenChange={setIsMobileGroupListOpen}>
          <SheetContent
            className="!w-[min(20rem,88vw)] gap-0 p-0 sm:!max-w-none"
            showCloseButton={false}
            side="left"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>选择群聊</SheetTitle>
              <SheetDescription>从群聊列表中切换当前多人对话。</SheetDescription>
            </SheetHeader>
            <GroupChatList
              className="h-full w-full border-0"
              groupChats={groupChats}
              isError={groupChatsQuery.isError}
              isLoading={groupChatsQuery.isLoading}
              onClose={() => setIsMobileGroupListOpen(false)}
              onSelect={(groupChatId) => {
                setSelectedGroupChatId(groupChatId)
                setIsMobileGroupListOpen(false)
              }}
              selectedGroupChatId={selectedGroupChat?.id ?? null}
            />
          </SheetContent>
        </Sheet>

        <Sheet open={isMobileMembersOpen} onOpenChange={setIsMobileMembersOpen}>
          <SheetContent
            className="!w-[min(22rem,92vw)] gap-0 p-0 sm:!max-w-none"
            showCloseButton={false}
            side="right"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>管理群成员</SheetTitle>
              <SheetDescription>查看当前成员，或从伴侣列表中邀请新的 Agent。</SheetDescription>
            </SheetHeader>
            <GroupMembersPanel
              agentSearch={agentSearch}
              className="h-full w-full overflow-y-auto border-0"
              filteredAgents={filteredAvailableAgents}
              isAdding={addMemberMutation.isPending}
              isLoadingAgents={agentInboxQuery.isLoading}
              isRemoving={removeMemberMutation.isPending}
              members={currentMembers}
              onAddAgent={(agentId) => {
                if (selectedGroupChat) {
                  addMemberMutation.mutate({ groupChatId: selectedGroupChat.id, agentId })
                }
              }}
              onAgentSearchChange={setAgentSearch}
              onClose={() => setIsMobileMembersOpen(false)}
              onRemoveMember={(memberId) => {
                if (selectedGroupChat) {
                  removeMemberMutation.mutate({ groupChatId: selectedGroupChat.id, memberId })
                }
              }}
              readonly={!selectedGroupChat}
            />
          </SheetContent>
        </Sheet>

        <GroupCreateDialog
          agents={availableAgents}
          onCreated={setSelectedGroupChatId}
          onOpenChange={setCreateDialogOpen}
          open={createDialogOpen}
        />
      </main>
    </DashboardShell>
  )
}
