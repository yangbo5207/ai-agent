"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import type { MyAgentInboxItem } from "@repo/contracts"
import {
  ArrowUpRight,
  Compass,
  Inbox as InboxIcon,
  ListFilter,
  PanelLeftOpen,
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
import { SidebarTrigger } from "@repo/ui/sidebar"

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
    <aside className={cn("flex h-56 min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-[#e7e9e8] bg-white lg:h-auto lg:w-[17rem] lg:border-r lg:border-b-0", className)}>
      <div className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[#e7e9e8] bg-white px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <SidebarTrigger
            aria-label="收缩或展开区域 1 导航"
            className="size-7 shrink-0 rounded-lg text-[#687572] hover:bg-[#f0f2f1] hover:text-[#27353a]"
            title="收缩或展开导航"
          />
          <button
            aria-label="筛选对话（即将推出）"
            className="flex size-7 shrink-0 cursor-not-allowed items-center justify-center rounded-lg text-[#9aa29f]"
            disabled
            title="筛选功能即将推出"
            type="button"
          >
            <ListFilter className="size-3.5" />
          </button>
          <p className="truncate text-[13px] font-semibold text-[#17232b]">
            你的对话
            <span className="ml-1.5 text-[11px] font-normal text-[#9a8d7e]">{conversations.length} 位 Agent</span>
          </p>
        </div>
        {onClose ? (
          <button
            aria-label="关闭对话列表"
            className="flex size-7 items-center justify-center rounded-full text-[#7d8583] transition-colors hover:bg-[#f0f1f0] hover:text-[#27353a]"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div>
          {conversations.length === 0 ? (
            <div className="flex min-h-60 items-center justify-center px-6 text-center">
              <div>
                <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#f1f3f2] text-[#7b8783]">
                  <InboxIcon className="size-5" />
                </span>
                <p className="mt-4 text-sm font-medium text-[#4b5b58]">还没有对话</p>
                <p className="mt-1 text-xs leading-5 text-[#9aa29f]">创建一位 Agent 伴侣，开始第一段对话。</p>
              </div>
            </div>
          ) : conversations.map((conversation) => {
            const selected = conversation.id === selectedConversationId

            return (
              <button
                aria-current={selected ? "page" : undefined}
                key={conversation.id}
                className={cn(
                  "group relative flex w-full gap-2.5 rounded-none px-3 py-3 text-left transition-[background-color,opacity] duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] before:opacity-0 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent_0%,#d6e1db_22%,#d6e1db_78%,transparent_100%)] after:opacity-0",
                  "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9b7851]",
                  selected
                    ? "bg-[#f1f5f2] before:opacity-100 after:opacity-100"
                    : "hover:bg-[#f7f9f7] hover:before:opacity-100 hover:after:opacity-100",
                )}
                onClick={() => onSelectConversation(conversation.id)}
                type="button"
              >
                <span className="relative shrink-0">
                  <AgentAvatar
                    className={cn("size-9 rounded-md text-xs", selected ? "bg-[#27353a] text-[#f9f5ed]" : "border-[#e0e4e2] bg-[#f1f3f2] text-[#53665f]")}
                    fallbackClassName={selected ? "bg-[#27353a] text-[#f9f5ed]" : "bg-[#f1f3f2] text-[#53665f]"}
                    imageKey={conversation.imageKey}
                    name={conversation.name}
                  />
                  {conversation.unread ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-white bg-[#a37b4f]" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-[#27353a]">{conversation.name}</span>
                    {conversation.pinned ? <Star className="size-3 shrink-0 fill-[#a37b4f] text-[#a37b4f]" /> : null}
                    <span className="ml-auto shrink-0 text-[11px] text-[#9a8d7e]">{conversation.lastActive}</span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] leading-5 text-[#929b98]">{getConversationPreview(conversation)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

function EmptyChatPanel({ onOpenConversationList }: { onOpenConversationList?: () => void }) {
  const router = useRouter()

  return (
    <section className="flex min-h-0 flex-1 items-center justify-center bg-white px-6 py-10 sm:px-10">
      <div className="w-full max-w-md text-center">
        {onOpenConversationList ? (
          <button
            aria-label="打开聊天列表"
            className="mb-8 inline-flex size-9 items-center justify-center rounded-full border border-[#e0e4e2] text-[#687572] transition-colors hover:bg-[#f1f3f2] lg:hidden"
            onClick={onOpenConversationList}
            title="打开聊天列表"
            type="button"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        ) : null}
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#27353a] text-[#d7bb89] shadow-[0_12px_30px_rgba(39,53,58,0.14)]">
          <Compass className="size-6" />
        </span>
        <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a37b4f]">电子伴侣</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#27353a] sm:text-3xl">选择一位 Agent 开始聊天</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#89928f]">从左侧选择一位 Agent 伴侣，或者创建一个属于你的新角色。</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Button
            className="h-10 rounded-full bg-[#27353a] px-4 text-sm text-white hover:bg-[#33474b]"
            onClick={() => router.push("/create-agent-companion")}
            type="button"
          >
            <Plus className="size-4" />
            创建 Agent 伴侣
            <ArrowUpRight className="size-4" />
          </Button>
          <Button className="h-10 rounded-full border-[#dfe4e1] px-4 text-sm text-[#53615e] hover:bg-[#f1f3f2]" onClick={() => router.push("/discover")} type="button" variant="outline">
            浏览角色
          </Button>
        </div>
      </div>
    </section>
  )
}

function ChatPageState({ title, description }: { title: string; description: string }) {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center bg-white px-5 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-[#e3dbd0] bg-[#fbfaf7] px-7 py-8 text-center shadow-[0_18px_45px_rgba(51,43,34,0.06)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#27353a] text-[#d7bb89]">
          <Compass className="size-5" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-[#27353a]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#857c70]">{description}</p>
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
    <DashboardShell hideHeader title="聊天">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white lg:flex-row">
        {agentInboxQuery.isLoading ? (
          <ChatPageState title="正在加载对话" description="请稍候，正在读取你的 Agent 会话。" />
        ) : agentInboxQuery.isError ? (
          <ChatPageState title="对话列表加载失败" description="请检查网络或 API 服务后重试。" />
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
            ) : (
              <EmptyChatPanel onOpenConversationList={() => setIsMobileInboxOpen(true)} />
            )}
          </>
        )}
      </div>
    </DashboardShell>
  )
}
