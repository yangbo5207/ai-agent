"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { MyAgentInboxItem } from "@repo/contracts"
import {
  Compass,
  Plus,
  Star,
  X,
} from "lucide-react"
import { DashboardShell } from "./_components/dashboard-shell"
import { InboxChat } from "./_components/inbox-chat"
import { getMyAgentInbox } from "@/auth/api"
import { AgentAvatar } from "@/components/agent-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet"

type ChatConversation = MyAgentInboxItem

type InboxListProps = {
  conversations: ChatConversation[]
  selectedConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  onClose?: () => void
  className?: string
}

function getConversationPreview(conversation: ChatConversation) {
  return conversation.lastAssistantMessage || conversation.profileNote
}

function InboxList({ conversations, selectedConversationId, onSelectConversation, onClose, className }: InboxListProps) {
  return (
    <aside className={cn("flex h-56 min-h-0 w-full shrink-0 flex-col border-b bg-white lg:h-auto lg:w-[19rem] lg:border-r lg:border-b-0", className)}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">对话</p>
          <p className="mt-1 text-xs text-slate-400">{conversations.length} 位 Agent 伴侣</p>
        </div>
        {onClose ? (
          <button
            aria-label="关闭对话列表"
            className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-100">
          {conversations.map((conversation) => {
            const selected = conversation.id === selectedConversationId

            return (
              <button
                aria-current={selected ? "page" : undefined}
                key={conversation.id}
                className={cn(
                  "group relative flex w-full gap-3 px-4 py-3.5 text-left transition-colors",
                  "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400",
                  selected ? "bg-slate-50" : "bg-white hover:bg-slate-50",
                )}
                onClick={() => onSelectConversation(conversation.id)}
                type="button"
              >
                {selected ? <span className="absolute inset-y-0 left-0 w-0.5 bg-slate-950" /> : null}
                <span className="relative shrink-0">
                  <AgentAvatar
                    className={cn("size-9 rounded-md text-xs", selected ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700")}
                    fallbackClassName={selected ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}
                    imageKey={conversation.imageKey}
                    name={conversation.name}
                  />
                  {conversation.unread ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white bg-slate-950" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{conversation.name}</span>
                    {conversation.pinned ? <Star className="size-3 shrink-0 fill-slate-500 text-slate-500" /> : null}
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">{conversation.lastActive}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{conversation.headline}</span>
                  <span className="mt-1 block truncate text-xs leading-5 text-slate-400">{getConversationPreview(conversation)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function EmptyChatPanel() {
  const router = useRouter()

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50/70">
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-md border border-slate-200 bg-white px-6 py-7 text-center">
          <Compass className="mx-auto size-8 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-950">创建一个 Agent 开始聊天</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">创建完成后，新的对话会出现在左侧列表中。</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button className="rounded-md" onClick={() => router.push("/create-agent-companion")} type="button">
              <Plus className="size-4" />
              创建 Agent 伴侣
            </Button>
            <Button className="rounded-md" onClick={() => router.push("/discover")} type="button" variant="outline">浏览角色</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ChatPageState({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center bg-slate-50/70 px-5 py-8">
      <div className="w-full max-w-sm border border-slate-200 bg-white px-6 py-7 text-center">
        <Compass className="mx-auto size-8 text-slate-300" />
        <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </section>
  )
}

export default function Page() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isMobileInboxOpen, setIsMobileInboxOpen] = useState(false)
  const agentInboxQuery = useQuery({
    queryKey: ["dashboard", "my-agent-inbox"],
    queryFn: getMyAgentInbox,
  })
  const conversations = agentInboxQuery.data?.items ?? []
  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0] ?? null
  const hasAgent = conversations.length > 0

  useEffect(() => {
    if (conversations.length === 0) {
      if (selectedConversationId !== null) {
        setSelectedConversationId(null)
      }

      return
    }

    if (!selectedConversationId || !conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0]!.id)
    }
  }, [conversations, selectedConversationId])

  return (
    <DashboardShell title="聊天">
      <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden bg-slate-50/70 lg:flex-row">
        {agentInboxQuery.isLoading ? (
          <ChatPageState title="正在加载对话" description="请稍候，正在读取你的 Agent 会话。" />
        ) : agentInboxQuery.isError ? (
          <ChatPageState title="对话列表加载失败" description="请检查网络或 API 服务后重试。" />
        ) : !hasAgent ? (
          <EmptyChatPanel />
        ) : (
          <>
            <div className="hidden min-h-0 lg:flex">
              <InboxList
                className="h-full max-h-none lg:h-full"
                conversations={conversations}
                onSelectConversation={setSelectedConversationId}
                selectedConversationId={selectedConversation?.id ?? null}
              />
            </div>
            <Sheet open={isMobileInboxOpen} onOpenChange={setIsMobileInboxOpen}>
              <SheetContent
                className="!w-[min(20rem,88vw)] gap-0 p-0 sm:!max-w-none"
                showCloseButton={false}
                side="left"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>选择对话</SheetTitle>
                  <SheetDescription>从 Agent 伴侣列表中切换当前聊天。</SheetDescription>
                </SheetHeader>
                <InboxList
                  className="h-full max-h-none w-full border-0"
                  conversations={conversations}
                  onClose={() => setIsMobileInboxOpen(false)}
                  onSelectConversation={(conversationId) => {
                    setSelectedConversationId(conversationId)
                    setIsMobileInboxOpen(false)
                  }}
                  selectedConversationId={selectedConversation?.id ?? null}
                />
              </SheetContent>
            </Sheet>
            {selectedConversation ? (
          <InboxChat
            conversation={selectedConversation}
            onOpenConversationList={() => setIsMobileInboxOpen(true)}
            onConversationUpdated={() => {
              void agentInboxQuery.refetch()
            }}
          />
            ) : <EmptyChatPanel />}
          </>
        )}
      </div>
    </DashboardShell>
  )
}
