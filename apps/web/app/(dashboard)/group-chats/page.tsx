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

type MentionContext = {
  end: number
  query: string
  start: number
}

function getMentionContext(value: string, cursor: number): MentionContext | null {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/)

  if (!match) {
    return null
  }

  const query = match[2] ?? ""

  return {
    start: cursor - query.length - 1,
    end: cursor,
    query,
  }
}

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
    <aside className={cn("flex min-h-0 flex-col overflow-hidden border-[#e3e6e4] bg-[#fffefa]", className)}>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[#e3e6e4] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f1f3f1] text-[#687572]">
            <MessagesSquare className="size-3.5" />
          </span>
          <p className="truncate text-[13px] font-semibold text-[#27353a]">
            群聊
            <span className="ml-1.5 text-[11px] font-normal text-[#9a8d7e]">{groupChats.length}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onClose ? (
            <button
              aria-label="关闭群聊列表"
              className="flex size-7 items-center justify-center rounded-full text-[#7d8583] transition-colors hover:bg-[#f0f1f0] hover:text-[#27353a]"
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
          <div className="flex min-h-44 items-center justify-center text-[11px] text-[#929b98]">正在加载群聊...</div>
        ) : isError ? (
          <div className="flex min-h-44 items-center justify-center px-4 text-center text-sm text-[#a14e43]">群聊列表加载失败</div>
        ) : groupChats.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#27353a] text-[#d7bb89]"><MessagesSquare className="size-4" /></span>
            <p className="mt-3 text-[12px] font-semibold text-[#53615e]">还没有群聊</p>
            <p className="mt-1 text-[10px] leading-5 text-[#929b98]">创建一个群聊，邀请 Agent 一起参与讨论。</p>
          </div>
        ) : (
          <div>
            {groupChats.map((groupChat) => {
              const selected = groupChat.id === selectedGroupChatId

              return (
                <button
                  className={cn(
                    "group relative flex w-full flex-col gap-1.5 rounded-none px-3 py-3 text-left transition-[background-color,opacity] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] before:opacity-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] after:opacity-0",
                    "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9b7851]",
                    selected ? "bg-[#f1f5f2] before:opacity-100 after:opacity-100" : "hover:bg-[#f7f9f7] hover:before:opacity-100 hover:after:opacity-100",
                  )}
                  key={groupChat.id}
                  onClick={() => onSelect(groupChat.id)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] font-semibold text-[#27353a]">{groupChat.title}</span>
                    <span className="shrink-0 text-[10px] text-[#9a8d7e]">{formatTime(groupChat.lastMessageAtMs)}</span>
                  </span>
                  <span className="block truncate text-[11px] leading-5 text-[#929b98]">{getMessagePreview(groupChat)}</span>
                  <span className="mt-1.5 flex items-center gap-1">
                    {groupChat.members.slice(0, 4).map((member) => <AgentAvatar className="size-5 rounded-sm" imageKey={member.imageKey} key={member.id} name={member.name} />)}
                    {groupChat.members.length > 4 ? <span className="text-[10px] text-[#9a8d7e]">+{groupChat.members.length - 4}</span> : null}
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
    <aside className={cn("min-h-0 overflow-hidden border-[#e3e6e4] bg-[#fffefa]", className)}>
      <section>
        <div className="flex h-11 items-center justify-between gap-2 border-b border-[#e3e6e4] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f1f3f1] text-[#687572]">
              <Users className="size-3.5" />
            </span>
            <p className="truncate text-[13px] font-semibold text-[#27353a]">
              群成员
              <span className="ml-1.5 text-[11px] font-normal text-[#9a8d7e]">{members.length} / 6</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onClose ? (
              <button
                aria-label="关闭成员管理"
                className="flex size-7 items-center justify-center rounded-full text-[#7d8583] transition-colors hover:bg-[#f0f1f0] hover:text-[#27353a]"
                onClick={onClose}
                title="关闭"
                type="button"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="divide-y divide-[#edf0ee]">
          {members.length === 0 ? (
            <div className="px-3 py-8 text-center text-[11px] text-[#929b98]">暂无成员</div>
          ) : (
            members.map((member) => (
              <div className="flex items-center gap-3 px-3 py-3" key={member.id}>
                <AgentAvatar className="size-8 rounded-md" imageKey={member.imageKey} name={member.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#27353a]">{member.name}</p>
                </div>
                <button
                  aria-label={`移除 ${member.name}`}
                  className="flex size-7 items-center justify-center rounded-full text-[#9aa29f] transition-colors hover:bg-[#f0f1f0] hover:text-[#53615e] disabled:opacity-50"
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

      <section className="border-t border-[#e3e6e4]">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-[#53615e]">
            <Bot className="size-3.5 text-[#a37b4f]" />
            邀请 Agent
          </p>
          <span className="text-[10px] text-[#9a8d7e]">最多 6 位</span>
        </div>
        <div className="relative px-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 size-3.5 -translate-y-1/2 text-[#9aa29f]" />
          <Input
            className="h-8 rounded-md border-0 bg-[#f1f3f1] pl-8 text-[11px] text-[#53615e] shadow-none placeholder:text-[#9aa29f] focus-visible:ring-1 focus-visible:ring-[#b8c7bf]"
            onChange={(event) => onAgentSearchChange(event.currentTarget.value)}
            placeholder="搜索 Agent"
            value={agentSearch}
          />
        </div>
        <div className="mt-2 divide-y divide-[#edf0ee] px-3 pb-3">
          {isLoadingAgents ? (
            <div className="py-6 text-center text-[11px] text-[#929b98]">正在加载 Agent...</div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-[#929b98]">没有可邀请的 Agent</div>
          ) : (
            filteredAgents.map((agent) => (
              <button
                className="flex w-full items-center gap-3 rounded-none py-2.5 text-left transition-colors hover:bg-[#f7f9f7] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={readonly || members.length >= 6 || isAdding}
                key={agent.id}
                onClick={() => onAddAgent(agent.id)}
                type="button"
              >
                <AgentAvatar className="size-8 rounded-md" imageKey={agent.imageKey} name={agent.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-[#27353a]">{agent.name}</span>
                </span>
                <CirclePlus className="size-4 shrink-0 text-[#a37b4f]" />
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
      <DialogContent className="max-w-2xl rounded-xl border-[#dfe3e1] bg-[#fffefa] p-0 shadow-[0_18px_50px_rgba(39,53,58,0.14)]">
        <DialogHeader className="border-b border-[#e3e6e4] px-5 py-4">
          <DialogTitle className="text-base text-[#27353a]">创建 Agent 群聊</DialogTitle>
          <DialogDescription className="text-xs leading-5 text-[#89928f]">
            选择 1-6 个 Agent。第一版采用受控回复，每轮会选择最合适的 1-3 个 Agent 发言。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-5 py-4">
          <label className="grid gap-2">
            <span className="text-xs font-medium text-[#687572]">群聊名称</span>
            <Input
              className="h-9 rounded-md border-[#d9dfdc] bg-[#fffefa] text-sm shadow-none focus-visible:ring-[#dce5e0]"
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="例如：深夜陪伴小队"
              value={title}
            />
          </label>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-[#687572]">邀请 Agent</span>
              <span className="text-[11px] text-[#9a8d7e]">{selectedAgentIds.length}/6</span>
            </div>
            <div className="max-h-[20rem] overflow-y-auto border-y border-[#e3e6e4]">
              {agents.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-[#929b98]">
                  还没有可邀请的 Agent
                </div>
              ) : (
                agents.map((agent) => {
                  const selected = selectedAgentIds.includes(agent.id)

                  return (
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-[#edf0ee] px-1 py-3 text-left transition-colors last:border-b-0",
                        selected ? "bg-[#f1f5f2]" : "hover:bg-[#f7f9f7]",
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
                        <div className="truncate text-sm font-semibold text-[#27353a]">{agent.name}</div>
                        <div className="mt-0.5 truncate text-xs text-[#929b98]">{agent.headline}</div>
                      </div>
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border",
                          selected ? "border-[#27353a] bg-[#27353a] text-white" : "border-[#d9dfdc] text-transparent",
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
            <div className="rounded-md border border-[#e8c9c0] bg-[#fff4f1] px-3 py-2 text-sm text-[#a14e43]">
              {createMutation.error instanceof Error ? createMutation.error.message : "创建群聊失败"}
            </div>
          ) : null}
        </div>
        <DialogFooter className="mx-0 mb-0 border-t border-[#e3e6e4] bg-[#f7f8f6] px-5 py-3">
          <Button
            className="h-9 rounded-md bg-[#27353a] px-4 text-sm text-white hover:bg-[#35484c]"
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
        <div className={cn("mb-1 flex items-center gap-2 text-[10px] text-[#9a8d7e]", isUser && "justify-end")}>
          {!isUser ? <span>{message.agentName ?? "Agent"}</span> : null}
          <span>{formatTime(message.createdAtMs)}</span>
        </div>
        <div
          className={cn(
            "relative border px-4 py-3 text-sm leading-6",
            isUser
              ? "whitespace-pre-wrap rounded-md border-[#27353a] bg-[#27353a] text-[#fbfaf7] shadow-[0_8px_20px_rgba(39,53,58,0.12)] before:absolute before:top-3 before:-right-2 before:h-0 before:w-0 before:border-y-[6px] before:border-y-transparent before:border-l-[8px] before:border-l-[#27353a]"
              : "rounded-md border-[#e3dbd0] bg-[#fbfaf7] text-[#27353a] shadow-[0_8px_20px_rgba(53,44,34,0.04)] before:absolute before:top-2 before:-left-2 before:h-0 before:w-0 before:border-y-[6px] before:border-y-transparent before:border-r-[8px] before:border-r-[#e3dbd0] after:absolute after:top-[9px] after:-left-[6px] after:h-0 after:w-0 after:border-y-[5px] after:border-y-transparent after:border-r-[7px] after:border-r-[#fbfaf7]",
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
        <span className="mt-5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#27353a] text-[#fbfaf7]">
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
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
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
  const mentionCandidates = useMemo(() => {
    if (!mentionContext) {
      return []
    }

    const query = mentionContext.query.trim().toLowerCase()

    return currentMembers.filter((member) => {
      if (!query) {
        return true
      }

      return [member.name, member.headline ?? ""].some((value) => value.toLowerCase().includes(query))
    })
  }, [currentMembers, mentionContext])

  function updateDraftMessage(value: string, cursor: number) {
    setDraftMessage(value)
    setMentionContext(getMentionContext(value, cursor))
    setMentionIndex(0)
  }

  function insertMention(member: AgentGroupChat["members"][number]) {
    if (!mentionContext) {
      return
    }

    setDraftMessage((current) => `${current.slice(0, mentionContext.start)}@${member.name} ${current.slice(mentionContext.end)}`)
    setMentionContext(null)
    setMentionIndex(0)
  }
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
    shouldStickToBottomRef.current = true
    setMentionContext(null)
    setMentionIndex(0)
  }, [selectedGroupChat?.id])

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
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#eef0f1]">
        <section className="shrink-0 border-b border-[#e3e6e4] bg-[#fffefa]">
          <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 lg:px-8">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a37b4f]">
                <MessagesSquare className="size-3.5" />
                Multi-agent
              </p>
              <h1 className="mt-1 text-lg font-semibold text-[#27353a] sm:text-xl">Agent 群聊</h1>
              <p className="mt-1 hidden max-w-2xl text-[12px] leading-5 text-[#89928f] sm:block">让多个 Agent 围绕同一个话题协作回应，每轮由系统控制参与范围。</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <span className="hidden text-[11px] text-[#9a8d7e] sm:inline">{groupChats.length} 个群聊</span>
              <Button className="h-8 rounded-md bg-[#27353a] px-3 text-xs text-white hover:bg-[#35484c] sm:h-9 sm:px-3.5" onClick={() => setCreateDialogOpen(true)}>
                <CirclePlus className="size-4" />
                新建群聊
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto grid min-h-0 w-full max-w-[90rem] flex-1 overflow-hidden border-[#dfe3e1] bg-[#fffefa] px-0 py-0 sm:m-4 sm:w-[calc(100%-2rem)] sm:rounded-xl sm:border lg:grid-cols-[17rem_minmax(0,1fr)_17rem] lg:gap-0 lg:px-0 lg:py-0">
          <GroupChatList
            className="hidden border-r lg:flex"
            groupChats={groupChats}
            isError={groupChatsQuery.isError}
            isLoading={groupChatsQuery.isLoading}
            onSelect={setSelectedGroupChatId}
            selectedGroupChatId={selectedGroupChat?.id ?? null}
          />

          <section className="flex min-h-0 flex-col overflow-hidden border-[#e3e6e4] bg-[#fffefa] lg:border-r">
            {selectedGroupChat ? (
              <>
                <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[#e3e6e4] bg-[#fbfaf7] px-3 py-2.5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      aria-label="选择群聊"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#897d6f] hover:bg-[#ebe4da] lg:hidden"
                      onClick={() => setIsMobileGroupListOpen(true)}
                      title="选择群聊"
                      type="button"
                    >
                      <PanelLeftOpen className="size-4" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-[#27353a]">{selectedGroupChat.title}</h2>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#89928f]">
                        <Users className="size-3 text-[#a37b4f]" />
                        {currentMembers.length} 位 Agent
                        <span className="text-[#c0c8c4]">·</span>
                        {detailQuery.data?.groupChat.messageCount ?? selectedGroupChat.messageCount} 条消息
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      aria-label="管理群成员"
                      className="flex size-8 items-center justify-center rounded-full text-[#897d6f] hover:bg-[#ebe4da] lg:hidden"
                      onClick={() => setIsMobileMembersOpen(true)}
                      title="管理群成员"
                      type="button"
                    >
                      <Users className="size-4" />
                    </button>
                    <div className="hidden items-center -space-x-1 sm:flex">
                      {currentMembers.slice(0, 5).map((member) => <AgentAvatar className="size-7 rounded-md border-2 border-[#fbfaf7]" imageKey={member.imageKey} key={member.id} name={member.name} />)}
                    </div>
                  </div>
                </header>
                <div ref={messageScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#fffefa] px-3 py-5 sm:px-5 sm:py-7">
                  {detailQuery.isLoading ? (
                    <div className="flex h-full min-h-80 items-center justify-center text-[11px] text-[#929b98]">正在加载群聊消息...</div>
                  ) : detailQuery.isError ? (
                    <div className="flex h-full min-h-80 items-center justify-center text-sm text-[#a14e43]">群聊消息加载失败</div>
                  ) : messages.length === 0 ? (
                    <div className="flex min-h-80 items-center justify-center">
                      <div className="max-w-md text-center">
                        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#f1f3f1] text-[#7b8783]"><MessageCircle className="size-5" /></span>
                        <p className="mt-4 text-sm font-semibold text-[#53615e]">开始第一轮群聊</p>
                        <p className="mt-2 text-sm leading-6 text-[#929b98]">直接提问或点名某个 Agent；也可以说“你们怎么看”。</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
                      {detailQuery.data?.nextCursor ? (
                        <div className="flex justify-center">
                          <Button
                            className="h-8 rounded-md border-[#dfe3e1] bg-[#f1f3f1] px-3 text-[11px] font-medium text-[#687572] shadow-none hover:bg-[#e7ece9] hover:text-[#27353a]"
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
                    <div className="mx-auto mt-5 flex max-w-3xl items-center gap-2 text-[11px] text-[#89928f]"><Loader2 className="size-3.5 animate-spin text-[#a37b4f]" /> Agent 正在组织回复...</div>
                  ) : null}
                  {sendMutation.isError ? (
                    <div className="mx-auto mt-5 max-w-3xl rounded-md border border-[#e8c9c0] bg-[#fff4f1] px-3 py-2 text-sm text-[#a14e43]">{sendMutation.error instanceof Error ? sendMutation.error.message : "发送失败"}</div>
                  ) : null}
                </div>
                <footer className="shrink-0 bg-[#f7f8f6] px-3 pb-4 pt-3 sm:px-5">
                  <PromptInput
                    className="mx-auto max-w-3xl [&_[data-slot=input-group]]:rounded-lg [&_[data-slot=input-group]]:border-[#d9dfdc] [&_[data-slot=input-group]]:bg-[#fffefa] [&_[data-slot=input-group]]:shadow-[0_10px_28px_rgba(39,53,58,0.06)] [&_[data-slot=input-group]]:focus-within:border-[#9baba4] [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-[#dce5e0]"
                    onSubmit={(message) => {
                      const text = message.text.trim()

                      if (!text || !selectedGroupChat || isSending) {
                        return
                      }

                      shouldStickToBottomRef.current = true
                      setMentionContext(null)
                      sendMutation.mutate({ groupChatId: selectedGroupChat.id, message: text })
                    }}
                  >
                    <PromptInputHeader className="bg-transparent px-3 pb-1 pt-2.5">
                      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {groupQuickPrompts.map((prompt) => (
                          <button
                            className="h-7 shrink-0 rounded-md bg-[#f1f3f1] px-2.5 text-[11px] font-medium text-[#68736f] transition-colors hover:bg-[#e7ece9] hover:text-[#27353a] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSending}
                            key={prompt}
                            onClick={() => {
                              setDraftMessage(prompt)
                              setMentionContext(null)
                              setMentionIndex(0)
                            }}
                            type="button"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </PromptInputHeader>
                    <PromptInputTextarea
                      className="max-h-44 min-h-16 px-4 py-2.5 text-sm leading-6 placeholder:text-[#a2aaa7] sm:min-h-16"
                      disabled={isSending}
                      onChange={(event) => {
                        updateDraftMessage(
                          event.currentTarget.value,
                          event.currentTarget.selectionStart ?? event.currentTarget.value.length,
                        )
                      }}
                      onKeyDown={(event) => {
                        if (!mentionContext) {
                          return
                        }

                        if (event.key === "Escape") {
                          event.preventDefault()
                          setMentionContext(null)
                          return
                        }

                        if (mentionCandidates.length === 0) {
                          return
                        }

                        if (event.key === "ArrowDown") {
                          event.preventDefault()
                          setMentionIndex((current) => (current + 1) % mentionCandidates.length)
                          return
                        }

                        if (event.key === "ArrowUp") {
                          event.preventDefault()
                          setMentionIndex((current) => (current - 1 + mentionCandidates.length) % mentionCandidates.length)
                          return
                        }

                        if (event.key === "Enter" || event.key === "Tab") {
                          event.preventDefault()
                          insertMention(mentionCandidates[mentionIndex] ?? mentionCandidates[0]!)
                        }
                      }}
                      placeholder="输入群聊消息，输入 @ 点名群内 Agent..."
                      value={draftMessage}
                    />
                    {mentionContext ? (
                      <div className="absolute bottom-12 left-3 z-20 w-[min(22rem,calc(100%-1.5rem))] overflow-hidden rounded-lg border border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.1)]">
                        <div className="flex items-center justify-between border-b border-[#e8ece9] px-3 py-2 text-[10px] text-[#89928f]">
                          <span>提及群成员</span>
                          <span>@{mentionContext.query || "全部"}</span>
                        </div>
                        {mentionCandidates.length > 0 ? (
                          <div className="max-h-56 overflow-y-auto p-1">
                            {mentionCandidates.map((member, index) => (
                              <button
                                className={cn(
                                  "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                                  index === mentionIndex ? "bg-[#f1f5f2]" : "hover:bg-[#f7f9f7]",
                                )}
                                key={member.id}
                                onClick={() => insertMention(member)}
                                onMouseDown={(event) => event.preventDefault()}
                                type="button"
                              >
                                <AgentAvatar className="size-7 rounded-md" imageKey={member.imageKey} name={member.name} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12px] font-semibold text-[#27353a]">{member.name}</span>
                                  <span className="mt-0.5 block truncate text-[10px] text-[#929b98]">{member.headline || "Agent 伴侣"}</span>
                                </span>
                                <span className="shrink-0 text-[10px] text-[#9a8d7e]">@{member.name}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-4 text-sm text-[#929b98]">没有匹配的群成员</p>
                        )}
                      </div>
                    ) : null}
                    <PromptInputFooter className="bg-transparent px-3 pb-2.5 pt-1">
                      <PromptInputTools className="min-w-0 gap-2 text-[11px] text-[#7d8985]">
                        <label className="flex min-w-0 items-center gap-1.5">
                          <RadioTower className="size-3.5 text-[#86958f]" />
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
                              className="h-7 max-w-[calc(100vw-8rem)] rounded-md border-0 bg-[#f1f3f1] px-2.5 text-[11px] font-medium text-[#68736f] hover:bg-[#e7ece9] data-placeholder:text-[#9aa39f] sm:max-w-56"
                              size="sm"
                            >
                              <PromptInputSelectValue placeholder="平台默认" />
                            </PromptInputSelectTrigger>
                            <PromptInputSelectContent className="min-w-56 rounded-lg border border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.1)]">
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
                        className="size-8 rounded-md bg-[#27353a] text-white hover:bg-[#35484c] disabled:bg-[#c8cfcc]"
                        disabled={!draftMessage.trim() || !selectedGroupChat || isSending}
                        status={isSending ? "submitted" : "ready"}
                      />
                    </PromptInputFooter>
                  </PromptInput>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-[#fffefa] px-5 py-12">
                <div className="max-w-md text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#27353a] text-[#d7bb89]"><MessagesSquare className="size-5" /></span>
                  <h2 className="mt-5 text-lg font-semibold text-[#27353a]">创建第一个 Agent 群聊</h2>
                  <p className="mt-2 text-sm leading-6 text-[#89928f]">选择多个 Agent，让它们围绕同一个话题协作回应。</p>
                  <Button className="mt-6 h-9 rounded-md bg-[#27353a] px-4 text-sm text-white hover:bg-[#35484c]" onClick={() => setCreateDialogOpen(true)}>
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
