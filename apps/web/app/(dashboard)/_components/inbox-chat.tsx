"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import type { StickToBottomContext } from "use-stick-to-bottom"
import type {
  AgentConversationResponse,
  AgentMessageFeedback,
  AgentMessageFeedbackRating,
  InboxChatRequest,
} from "@repo/contracts"
import {
  AtSign,
  Clock3,
  CircleDot,
  Heart,
  LoaderCircle,
  PanelLeftOpen,
  RadioTower,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { MessageResponse } from "@/components/ai-elements/message"
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
import { readClientSession } from "@/auth/client-session"
import { getAgentConversation, getAgentConversationMessages, submitAgentMessageFeedback } from "@/auth/api"
import {
  localLlmConfigChangedEventName,
  readLocalLlmConfigStore,
  selectLocalLlmConfig,
  type LocalLlmConfigStore,
} from "@/auth/local-llm-config"
import { AgentAvatar } from "@/components/agent-avatar"
import { UserAvatar } from "@/components/user-avatar"
import { useWebDashboardContext } from "@/components/web-dashboard-guard"
import { getWebClientEnv } from "@/env.client"
import { cn } from "@/lib/utils"

type ChatConversation = InboxChatRequest["conversation"]

type InboxChatProps = {
  conversation: ChatConversation
  onConversationUpdated?: () => void
  onOpenConversationList?: () => void
}

type InboxChatInnerProps = InboxChatProps & {
  serverConversation: AgentConversationResponse
  isConversationTransitioning?: boolean
}

type PersistedHistoryMessage = AgentConversationResponse["messages"][number]

type LocalHistoryPage = {
  id: string
  messages: PersistedHistoryMessage[]
}

const quickPrompts = [
  "帮我用轻松自然的语气回复 TA。",
  "根据 TA 的信息找一个可以延续的话题。",
  "帮我写一句不尴尬的开场白。",
  "判断这段关系下一步适合怎么推进。",
]

const INITIAL_ASSISTANT_MESSAGE_ID = "initial-assistant-message"
const TYPEWRITER_INTERVAL_MS = 18
const TYPEWRITER_CHARS_PER_STEP = 1

function toUiMessage(message: AgentConversationResponse["messages"][number]): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [
      {
        type: "text",
        text: message.content,
      },
    ],
  }
}

function buildInitialMessages(serverConversation: AgentConversationResponse): UIMessage[] {
  if (serverConversation.messages.length > 0) {
    return serverConversation.messages.map(toUiMessage)
  }

  if (serverConversation.openingMessage?.trim()) {
    return [
      {
        id: INITIAL_ASSISTANT_MESSAGE_ID,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: serverConversation.openingMessage,
          },
        ],
      },
    ]
  }

  return [
    {
      id: INITIAL_ASSISTANT_MESSAGE_ID,
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "我已经准备好陪你聊天了。你可以直接说今天想聊什么。",
        },
      ],
    },
  ]
}

function flattenHistoryPages(pages: LocalHistoryPage[]) {
  const seenMessageIds = new Set<string>()
  const messages: PersistedHistoryMessage[] = []

  for (const page of pages) {
    for (const message of page.messages) {
      if (seenMessageIds.has(message.id)) {
        continue
      }

      seenMessageIds.add(message.id)
      messages.push(message)
    }
  }

  return messages
}

function buildMessagesFromHistoryPages(pages: LocalHistoryPage[], serverConversation: AgentConversationResponse) {
  const persistedMessages = flattenHistoryPages(pages)

  if (persistedMessages.length > 0) {
    return persistedMessages.map(toUiMessage)
  }

  return buildInitialMessages(serverConversation)
}

function replaceLatestHistoryPage(pages: LocalHistoryPage[], latestMessages: PersistedHistoryMessage[]) {
  const latestMessageIds = new Set(latestMessages.map((message) => message.id))
  const olderPages = pages
    .filter((page) => page.id !== "latest")
    .map((page) => ({
      ...page,
      messages: page.messages.filter((message) => !latestMessageIds.has(message.id)),
    }))
    .filter((page) => page.messages.length > 0)
  const olderMessageIds = new Set(flattenHistoryPages(olderPages).map((message) => message.id))
  const retainedLatestMessages = (pages.find((page) => page.id === "latest")?.messages ?? [])
    .filter((message) => !latestMessageIds.has(message.id) && !olderMessageIds.has(message.id))

  return [
    ...olderPages,
    ...(retainedLatestMessages.length > 0
      ? [{ id: `retained-${retainedLatestMessages[0]!.id}`, messages: retainedLatestMessages }]
      : []),
    {
      id: "latest",
      messages: latestMessages,
    },
  ]
}

function buildMessageFeedbackById(messages: AgentConversationResponse["messages"]) {
  return messages.reduce<Record<string, AgentMessageFeedback | null>>((map, message) => {
    if (message.role === "assistant") {
      map[message.id] = message.feedback
    }

    return map
  }, {})
}

function buildPersistedAssistantMessageIds(messages: AgentConversationResponse["messages"]) {
  return new Set(messages.filter((message) => message.role === "assistant").map((message) => message.id))
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

function getTextLength(text: string) {
  return Array.from(text).length
}

function sliceText(text: string, length: number) {
  return Array.from(text).slice(0, length).join("")
}

function buildVisibleAssistantTextById(messages: UIMessage[]) {
  const textById: Record<string, string> = {}

  for (const message of messages) {
    if (message.role !== "assistant" || message.id === INITIAL_ASSISTANT_MESSAGE_ID) {
      continue
    }

    const text = getMessageText(message)

    if (text) {
      textById[message.id] = text
    }
  }

  return textById
}

function formatChatErrorMessage(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as {
      error?: {
        message?: unknown
      }
    }
    const message = parsed.error?.message

    if (typeof message === "string" && message.trim()) {
      return message
    }
  } catch {
    // Keep the original error message when it is not a JSON API response.
  }

  return error.message || "聊天请求失败，请检查 LLM 配置。"
}

function TypingBubble({ conversation }: { conversation: ChatConversation }) {
  return (
    <div className="flex w-full items-start gap-3">
      <AgentAvatar
        className="mt-5 size-8 rounded-md bg-slate-100 text-xs text-slate-700"
        fallbackClassName="bg-slate-100 text-slate-700"
        imageKey={conversation.imageKey}
        name={conversation.name}
      />
      <div className="flex min-w-0 max-w-[min(38rem,82%)] flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500">{conversation.name}</span>
        <div className="relative rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 before:absolute before:top-2 before:-left-2 before:h-0 before:w-0 before:border-y-[6px] before:border-y-transparent before:border-r-[8px] before:border-r-slate-200 after:absolute after:top-[9px] after:-left-[6px] after:h-0 after:w-0 after:border-y-[5px] after:border-y-transparent after:border-r-[7px] after:border-r-white">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500">正在回复</span>
            <div className="flex items-center gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InboxChatLoadingPanel({ conversation }: { conversation: ChatConversation }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="border-b border-[#e3dbd0] bg-[#fbfaf7] px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <AgentAvatar
            className="size-14 rounded-md border-[#27353a] bg-[#27353a] text-base text-white"
            fallbackClassName="bg-[#27353a] text-white"
            imageKey={conversation.imageKey}
            name={conversation.name}
          />
          <div className="min-w-0 flex-1">
            <div className="h-5 w-44 animate-pulse rounded bg-[#eae4da]" />
            <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-[#eae4da]" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="text-sm font-medium text-[#857c70]">正在加载聊天历史...</div>
      </div>
    </section>
  )
}

function InboxChatErrorPanel({ conversation, error }: { conversation: ChatConversation; error: unknown }) {
  const message = error instanceof Error && error.message
    ? error.message
    : "请确认 API 已启动并完成最新 D1 迁移后刷新页面。"

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm text-center">
          <AgentAvatar
            className="mx-auto size-12 rounded-md border-[#ded5c9] bg-[#eee8de] text-sm text-[#53665f]"
            fallbackClassName="bg-[#eee8de] text-[#53665f]"
            imageKey={conversation.imageKey}
            name={conversation.name}
          />
          <h2 className="mt-4 text-base font-semibold text-[#27353a]">聊天历史加载失败</h2>
          <p className="mt-2 text-sm leading-6 text-[#857c70]">
            {message}
          </p>
        </div>
      </div>
    </section>
  )
}

function InboxChatInner({
  conversation,
  serverConversation,
  onConversationUpdated,
  onOpenConversationList,
  isConversationTransitioning = false,
}: InboxChatInnerProps) {
  const { profile } = useWebDashboardContext()
  const queryClient = useQueryClient()
  const [draftMessage, setDraftMessage] = useState("")
  const [initialChatMessages] = useState<UIMessage[]>(() => buildInitialMessages(serverConversation))
  const [historyPages, setHistoryPages] = useState<LocalHistoryPage[]>(() => [
    {
      id: "latest",
      messages: serverConversation.messages,
    },
  ])
  const historyPagesRef = useRef(historyPages)
  const conversationScrollContextRef = useRef<StickToBottomContext | null>(null)
  const pendingScrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const isLoadingMoreHistoryRef = useRef(false)
  const canLoadMoreOnScrollRef = useRef(false)
  const hasUserScrolledHistoryRef = useRef(false)
  const suppressHistoryScrollLoadRef = useRef(false)
  const loadMoreHistoryRef = useRef<() => void>(() => undefined)
  const historyAnimationTimerRef = useRef<number | null>(null)
  const [enteringHistoryMessageIds, setEnteringHistoryMessageIds] = useState<Set<string>>(() => new Set())
  const [nextCursor, setNextCursor] = useState(serverConversation.nextCursor)
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false)
  const [historyLoadError, setHistoryLoadError] = useState(false)
  const [feedbackByMessageId, setFeedbackByMessageId] = useState<Record<string, AgentMessageFeedback | null>>(() =>
    buildMessageFeedbackById(serverConversation.messages),
  )
  const [persistedAssistantMessageIds, setPersistedAssistantMessageIds] = useState<Set<string>>(() =>
    buildPersistedAssistantMessageIds(serverConversation.messages),
  )
  const [llmStore, setLlmStore] = useState<LocalLlmConfigStore>({ selectedConfigId: null, items: [] })
  const enabledLlmConfigs = llmStore.items.filter((item) => item.enabled)
  const selectedLlmConfig =
    enabledLlmConfigs.find((item) => item.id === llmStore.selectedConfigId) ?? null
  const transport = useMemo(
    () => new TextStreamChatTransport<UIMessage>({
      api: `${getWebClientEnv().NEXT_PUBLIC_API_BASE_URL}/rpc/chat/inbox`,
      prepareSendMessagesRequest({ api, body, messages }) {
        const storedSession = readClientSession()
        const latestStore = readLocalLlmConfigStore()
        const selectedConfig = latestStore.items.find((item) => item.enabled && item.id === latestStore.selectedConfigId)
        const requestMessages = messages.slice(-20)
        const localLlmConfig = selectedConfig
          ? {
              providerName: selectedConfig.providerName,
              baseURL: selectedConfig.baseURL,
              model: selectedConfig.model,
              apiKey: selectedConfig.apiKey,
              wireApi: selectedConfig.wireApi,
              ...(selectedConfig.reasoningEffort ? { reasoningEffort: selectedConfig.reasoningEffort } : {}),
            }
          : null

        return {
          api,
          headers: storedSession
            ? { authorization: `Bearer ${storedSession.accessToken}` }
            : undefined,
          body: {
            ...body,
            conversationId: serverConversation.conversationId,
            messages: requestMessages,
            conversation,
            ...(localLlmConfig ? { llmConfig: localLlmConfig } : {}),
          },
        }
      },
    }),
    [conversation, serverConversation.conversationId],
  )
  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    id: serverConversation.conversationId,
    transport,
    messages: initialChatMessages,
  })
  const feedbackMutation = useMutation({
    mutationFn: (input: { messageId: string; rating: AgentMessageFeedbackRating }) => {
      if (!conversation.id) {
        throw new Error("Agent id is required")
      }

      return submitAgentMessageFeedback(conversation.id, input.messageId, {
        rating: input.rating,
        reason: input.rating === "positive" ? "helpful" : "other",
      })
    },
    onSuccess(response) {
      setFeedbackByMessageId((current) => ({
        ...current,
        [response.messageId]: response.feedback,
      }))
      void queryClient.invalidateQueries({ queryKey: ["agent-conversation", conversation.id] })
    },
  })
  const isSending = status === "submitted" || status === "streaming"
  const [visibleAssistantTextById, setVisibleAssistantTextById] = useState<Record<string, string>>(() =>
    buildVisibleAssistantTextById(initialChatMessages),
  )
  const assistantTextSignature = messages
    .filter((message) => message.role === "assistant" && message.id !== INITIAL_ASSISTANT_MESSAGE_ID)
    .map((message) => `${message.id}:${getMessageText(message)}`)
    .join("\n")
  const assistantFullTextById = useMemo(() => {
    const textById: Record<string, string> = {}

    for (const message of messages) {
      if (message.role !== "assistant" || message.id === INITIAL_ASSISTANT_MESSAGE_ID) {
        continue
      }

      const text = getMessageText(message)

      if (text) {
        textById[message.id] = text
      }
    }

    return textById
  }, [assistantTextSignature, messages])
  const latestMessage = messages[messages.length - 1]
  const latestAssistantText =
    latestMessage?.role === "assistant" ? getMessageText(latestMessage).trim() : ""
  const serverMessageContentSignature = serverConversation.messages
    .map((message) => [
      message.id,
      message.role,
      message.createdAtMs,
      message.status,
      message.content,
    ].join(":"))
    .join("\n")
  const serverMessageFeedbackSignature = serverConversation.messages
    .map((message) => [
      message.id,
      message.feedback?.rating ?? "none",
      message.feedback?.updatedAtMs ?? 0,
    ].join(":"))
    .join("\n")
  const lastServerMessageContentSignatureRef = useRef(serverMessageContentSignature)
  const shouldShowTypingBubble =
    status === "submitted" ||
    (status === "streaming" && latestMessage?.role !== "assistant") ||
    (status === "streaming" && latestMessage?.role === "assistant" && !latestAssistantText)
  const hasTypewriterWork = Object.entries(assistantFullTextById).some(([id, fullText]) => {
    const visibleText = visibleAssistantTextById[id] ?? ""

    return getTextLength(visibleText) < getTextLength(fullText)
  })
  const [hasPendingConversationUpdate, setHasPendingConversationUpdate] = useState(false)

  useEffect(() => {
    if (isSending || lastServerMessageContentSignatureRef.current === serverMessageContentSignature) {
      return
    }

    lastServerMessageContentSignatureRef.current = serverMessageContentSignature
    const currentPages = historyPagesRef.current
    const nextPages = replaceLatestHistoryPage(currentPages, serverConversation.messages)
    const nextMessages = buildMessagesFromHistoryPages(nextPages, serverConversation)

    historyPagesRef.current = nextPages
    setHistoryPages(nextPages)
    setMessages(nextMessages)
    setVisibleAssistantTextById(buildVisibleAssistantTextById(nextMessages))

    if (currentPages.length === 1) {
      setNextCursor(serverConversation.nextCursor)
    }
  }, [isSending, serverConversation, serverMessageContentSignature, setMessages])

  useEffect(() => {
    const latestFeedbackById = buildMessageFeedbackById(serverConversation.messages)
    const latestAssistantMessageIds = buildPersistedAssistantMessageIds(serverConversation.messages)

    setFeedbackByMessageId((current) => ({
      ...current,
      ...latestFeedbackById,
    }))
    setPersistedAssistantMessageIds((current) => {
      const next = new Set(current)

      for (const messageId of latestAssistantMessageIds) {
        next.add(messageId)
      }

      return next
    })
  }, [serverConversation.messages, serverMessageFeedbackSignature])

  async function loadMoreHistory() {
    if (!nextCursor || isLoadingMoreHistoryRef.current || isSending || !conversation.id) {
      return
    }

    const requestedCursor = nextCursor
    const scrollElement = conversationScrollContextRef.current?.scrollRef.current

    if (scrollElement) {
      pendingScrollRestoreRef.current = {
        scrollHeight: scrollElement.scrollHeight,
        scrollTop: scrollElement.scrollTop,
      }
    }

    isLoadingMoreHistoryRef.current = true
    setIsLoadingMoreHistory(true)
    setHistoryLoadError(false)

    try {
      const response = await getAgentConversationMessages(conversation.id, requestedCursor)
      const olderMessages = response.messages.map(toUiMessage)
      const olderFeedbackById = buildMessageFeedbackById(response.messages)
      const olderAssistantMessageIds = buildPersistedAssistantMessageIds(response.messages)
      const existingMessageIds = new Set(flattenHistoryPages(historyPagesRef.current).map((message) => message.id))
      const uniquePersistedMessages = response.messages.filter((message) => !existingMessageIds.has(message.id))
      const uniqueOlderMessages = olderMessages.filter((message) => !existingMessageIds.has(message.id))

      if (uniquePersistedMessages.length > 0) {
        suppressHistoryScrollLoadRef.current = true
        const nextPages = [
          {
            id: requestedCursor,
            messages: uniquePersistedMessages,
          },
          ...historyPagesRef.current,
        ]

        historyPagesRef.current = nextPages
        setHistoryPages(nextPages)
        setEnteringHistoryMessageIds(new Set(uniquePersistedMessages.map((message) => message.id)))

        if (historyAnimationTimerRef.current !== null) {
          window.clearTimeout(historyAnimationTimerRef.current)
        }
        historyAnimationTimerRef.current = window.setTimeout(() => {
          setEnteringHistoryMessageIds(new Set())
          historyAnimationTimerRef.current = null
        }, 360)
      } else {
        pendingScrollRestoreRef.current = null
      }

      setFeedbackByMessageId((current) => ({
        ...olderFeedbackById,
        ...current,
      }))
      setPersistedAssistantMessageIds((current) => {
        const next = new Set(current)

        for (const messageId of olderAssistantMessageIds) {
          next.add(messageId)
        }

        return next
      })
      setVisibleAssistantTextById((current) => {
        const next = { ...current }
        let changed = false

        for (const message of olderMessages) {
          if (message.role !== "assistant" || message.id === INITIAL_ASSISTANT_MESSAGE_ID) {
            continue
          }

          const text = getMessageText(message)

          if (text && next[message.id] !== text) {
            next[message.id] = text
            changed = true
          }
        }

        return changed ? next : current
      })
      setMessages((current) => {
        const currentMessageIds = new Set(current.map((message) => message.id))

        return [
          ...uniqueOlderMessages.filter((message) => !currentMessageIds.has(message.id)),
          ...current,
        ]
      })
      setNextCursor(response.nextCursor)
    } catch {
      pendingScrollRestoreRef.current = null
      setHistoryLoadError(true)
    } finally {
      isLoadingMoreHistoryRef.current = false
      setIsLoadingMoreHistory(false)
    }
  }

  loadMoreHistoryRef.current = () => {
    void loadMoreHistory()
  }

  useLayoutEffect(() => {
    const pendingScrollRestore = pendingScrollRestoreRef.current
    const scrollElement = conversationScrollContextRef.current?.scrollRef.current

    if (!pendingScrollRestore || !scrollElement) {
      return
    }

    const addedHeight = scrollElement.scrollHeight - pendingScrollRestore.scrollHeight

    scrollElement.scrollTop = pendingScrollRestore.scrollTop + Math.max(0, addedHeight)
    pendingScrollRestoreRef.current = null
    window.requestAnimationFrame(() => {
      suppressHistoryScrollLoadRef.current = false
    })
  }, [historyPages])

  useEffect(() => {
    const scrollElement = conversationScrollContextRef.current?.scrollRef.current

    if (!scrollElement) {
      return
    }

    canLoadMoreOnScrollRef.current = false
    const animationFrame = window.requestAnimationFrame(() => {
      canLoadMoreOnScrollRef.current = true
    })
    const requestOlderHistory = () => {
      if (
        !canLoadMoreOnScrollRef.current ||
        !hasUserScrolledHistoryRef.current ||
        suppressHistoryScrollLoadRef.current ||
        scrollElement.scrollTop > 96
      ) {
        return
      }

      loadMoreHistoryRef.current()
    }
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        hasUserScrolledHistoryRef.current = true
        requestOlderHistory()
      }
    }
    let touchStartY: number | null = null
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null
    }
    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY

      if (touchStartY !== null && currentY !== undefined && currentY > touchStartY + 12) {
        hasUserScrolledHistoryRef.current = true
        requestOlderHistory()
        touchStartY = currentY
      }
    }

    scrollElement.addEventListener("scroll", requestOlderHistory, { passive: true })
    scrollElement.addEventListener("wheel", handleWheel, { passive: true })
    scrollElement.addEventListener("touchstart", handleTouchStart, { passive: true })
    scrollElement.addEventListener("touchmove", handleTouchMove, { passive: true })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      scrollElement.removeEventListener("scroll", requestOlderHistory)
      scrollElement.removeEventListener("wheel", handleWheel)
      scrollElement.removeEventListener("touchstart", handleTouchStart)
      scrollElement.removeEventListener("touchmove", handleTouchMove)
    }
  }, [serverConversation.conversationId])

  useEffect(() => () => {
    if (historyAnimationTimerRef.current !== null) {
      window.clearTimeout(historyAnimationTimerRef.current)
    }
  }, [])

  useEffect(() => {
    function reloadLlmStore() {
      setLlmStore(readLocalLlmConfigStore())
    }

    reloadLlmStore()
    window.addEventListener(localLlmConfigChangedEventName, reloadLlmStore)

    return () => {
      window.removeEventListener(localLlmConfigChangedEventName, reloadLlmStore)
    }
  }, [])

  useEffect(() => {
    setVisibleAssistantTextById((current) => {
      const next: Record<string, string> = {}
      let changed = false

      for (const [id, fullText] of Object.entries(assistantFullTextById)) {
        const visibleText = current[id]

        if (visibleText === undefined || !fullText.startsWith(visibleText)) {
          next[id] = sliceText(fullText, TYPEWRITER_CHARS_PER_STEP)
          changed = true
          continue
        }

        next[id] = visibleText
      }

      if (Object.keys(current).length !== Object.keys(next).length) {
        changed = true
      }

      return changed ? next : current
    })
  }, [assistantFullTextById])

  useEffect(() => {
    if (!hasTypewriterWork) {
      return
    }

    const timer = window.setTimeout(() => {
      setVisibleAssistantTextById((current) => {
        let changed = false
        const next = { ...current }

        for (const [id, fullText] of Object.entries(assistantFullTextById)) {
          const visibleText = current[id] ?? ""
          const visibleLength = getTextLength(visibleText)
          const fullLength = getTextLength(fullText)

          if (visibleLength >= fullLength) {
            continue
          }

          next[id] = sliceText(fullText, visibleLength + TYPEWRITER_CHARS_PER_STEP)
          changed = true
        }

        return changed ? next : current
      })
    }, TYPEWRITER_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [assistantFullTextById, hasTypewriterWork, visibleAssistantTextById])

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      setHasPendingConversationUpdate(true)
      return
    }

    if (!hasPendingConversationUpdate) {
      return
    }

    setHasPendingConversationUpdate(false)
    onConversationUpdated?.()
  }, [hasPendingConversationUpdate, onConversationUpdated, status])

  return (
    <section
      aria-busy={isConversationTransitioning}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
    >
      <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-4 border-b border-[#e3dbd0] bg-[#fbfaf7] px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onOpenConversationList ? (
            <button
              aria-label="选择对话"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#897d6f] hover:bg-[#ebe4da] lg:hidden"
              onClick={onOpenConversationList}
              title="选择对话"
              type="button"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          ) : null}
          <div className="relative shrink-0">
            <AgentAvatar
              className="size-9 rounded-md bg-[#27353a] text-xs text-white"
              fallbackClassName="bg-[#27353a] text-white"
              imageKey={conversation.imageKey}
              name={conversation.name}
            />
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#fbfaf7] bg-[#7ca58b]" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-[#27353a]">{conversation.name}</h2>
              <span className="hidden shrink-0 items-center gap-1 text-[10px] text-[#9a8d7e] sm:inline-flex">
                <AtSign className="size-3 text-[#a37b4f]" />
                {conversation.handle}
              </span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] text-[#687971]">
              <span className="flex min-w-0 items-center gap-1.5">
                <Sparkles className="size-3 shrink-0 text-[#a37b4f]" />
                <span className="truncate">{conversation.headline}</span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-[#9a8d7e] sm:inline-flex">
                <Heart className="size-3 text-[#b27e75]" />
                {conversation.relationship}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#e5eee8] px-2 py-1 text-[10px] font-medium text-[#426453]">
            <CircleDot className="size-3 fill-current" />
            {isConversationTransitioning ? "切换中" : conversation.status}
          </span>
        </div>
      </div>

      <Conversation
        className="min-h-0 overscroll-contain"
        contextRef={conversationScrollContextRef}
        initial="instant"
        resize="instant"
      >
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-7 sm:px-6">
          <div className="flex h-8 items-center justify-center" aria-live="polite">
            <span
              className={cn(
                "inline-flex items-center gap-2 text-[11px] font-medium text-[#8d9894]",
                isLoadingMoreHistory && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
              )}
            >
              {isLoadingMoreHistory ? (
                <LoaderCircle className="size-3.5 animate-spin text-[#9a7b59]" />
              ) : (
                <Clock3 className="size-3.5 text-[#9a7b59]" />
              )}
              {historyLoadError
                ? "历史消息读取失败"
                : isLoadingMoreHistory
                  ? "正在读取更早消息"
                  : nextCursor
                    ? "更早消息"
                    : "已显示最早消息"}
            </span>
          </div>

          {messages.map((message) => {
            const isUser = message.role === "user"
            const messageText = getMessageText(message)
            const messageFeedback = feedbackByMessageId[message.id] ?? null
            const canSubmitFeedback =
              !isUser &&
              message.id !== INITIAL_ASSISTANT_MESSAGE_ID &&
              persistedAssistantMessageIds.has(message.id)
            const visibleMessageText =
              !isUser && message.id !== INITIAL_ASSISTANT_MESSAGE_ID
                ? visibleAssistantTextById[message.id] ?? sliceText(messageText, TYPEWRITER_CHARS_PER_STEP)
                : messageText

            if (!isUser && !messageText.trim()) {
              return null
            }

            return (
              <div
                className={cn(
                  "flex w-full items-start gap-3",
                  isUser ? "justify-end" : "justify-start",
                  enteringHistoryMessageIds.has(message.id) &&
                    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300",
                )}
                key={message.id}
              >
                {!isUser ? (
                  <AgentAvatar
                    className="mt-5 size-8 rounded-md border-[#ded5c9] bg-[#eee8de] text-xs text-[#53665f]"
                    fallbackClassName="bg-[#eee8de] text-[#53665f]"
                    imageKey={conversation.imageKey}
                    name={conversation.name}
                  />
                ) : null}

                <div
                  className={cn(
                    "flex min-w-0 max-w-[min(38rem,82%)] flex-col gap-1.5",
                    isUser ? "items-end" : "items-start",
                  )}
                >
                  {!isUser ? (
                    <div className="flex items-center gap-2 text-xs font-medium text-[#897d6f]">
                      <span>{conversation.name}</span>
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "relative border px-4 py-3 text-sm leading-6",
                      isUser
                        ? "rounded-md border-[#27353a] bg-[#27353a] text-[#fbfaf7] shadow-[0_8px_20px_rgba(39,53,58,0.12)] before:absolute before:top-3 before:-right-2 before:h-0 before:w-0 before:border-y-[6px] before:border-y-transparent before:border-l-[8px] before:border-l-[#27353a]"
                        : "rounded-md border-[#e3dbd0] bg-[#fbfaf7] text-[#27353a] shadow-[0_8px_20px_rgba(53,44,34,0.04)] before:absolute before:top-2 before:-left-2 before:h-0 before:w-0 before:border-y-[6px] before:border-y-transparent before:border-r-[8px] before:border-r-[#e3dbd0] after:absolute after:top-[9px] after:-left-[6px] after:h-0 after:w-0 after:border-y-[5px] after:border-y-transparent after:border-r-[7px] after:border-r-[#fbfaf7]",
                    )}
                  >
                    <MessageResponse
                      className={cn(
                        "[&_p]:leading-6",
                        isUser && "[&_a]:text-white [&_code]:text-white",
                      )}
                    >
                      {visibleMessageText}
                    </MessageResponse>
                  </div>

                  {canSubmitFeedback ? (
                    <div className="flex items-center gap-1.5 pl-1 text-xs text-slate-400">
                      <button
                        aria-label="这条回复有帮助"
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          messageFeedback?.rating === "positive"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white/70 text-slate-400 hover:border-emerald-200 hover:text-emerald-700",
                        )}
                        disabled={feedbackMutation.isPending}
                        onClick={() => {
                          feedbackMutation.mutate({ messageId: message.id, rating: "positive" })
                        }}
                        title="有帮助"
                        type="button"
                      >
                        <ThumbsUp className="size-3.5" />
                      </button>
                      <button
                        aria-label="这条回复不合适"
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                          messageFeedback?.rating === "negative"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-slate-200 bg-white/70 text-slate-400 hover:border-rose-200 hover:text-rose-700",
                        )}
                        disabled={feedbackMutation.isPending}
                        onClick={() => {
                          feedbackMutation.mutate({ messageId: message.id, rating: "negative" })
                        }}
                        title="不合适"
                        type="button"
                      >
                        <ThumbsDown className="size-3.5" />
                      </button>
                      {messageFeedback ? (
                        <span className="text-[11px] font-medium text-slate-400">
                          已记录偏好
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {isUser ? (
                  <span className="mt-0.5 shrink-0 [&>img]:!rounded-md [&>span]:!rounded-md">
                    <UserAvatar user={profile} size="sm" />
                  </span>
                ) : null}
              </div>
            )
          })}
          {shouldShowTypingBubble ? <TypingBubble conversation={conversation} /> : null}
          {error ? (
            <div className="rounded-xl border border-[#e8c9c0] bg-[#fff4f1] px-3 py-2 text-sm text-[#a14e43]">
              {formatChatErrorMessage(error)}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="bg-[#f7f8f6] px-4 pb-4 pt-3 sm:px-6">
        <PromptInput
          className="mx-auto max-w-3xl [&_[data-slot=input-group]]:rounded-lg [&_[data-slot=input-group]]:border-[#d9dfdc] [&_[data-slot=input-group]]:bg-[#fffefa] [&_[data-slot=input-group]]:shadow-[0_10px_28px_rgba(39,53,58,0.06)] [&_[data-slot=input-group]]:focus-within:border-[#9baba4] [&_[data-slot=input-group]]:focus-within:ring-2 [&_[data-slot=input-group]]:focus-within:ring-[#dce5e0]"
          onSubmit={(message) => {
            const text = message.text.trim()

            if (!text) {
              return
            }

            sendMessage({ text })
            setDraftMessage("")
          }}
        >
          <PromptInputHeader className="bg-transparent px-3 pb-1 pt-2.5">
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {quickPrompts.map((prompt) => (
                <button
                  className="h-7 shrink-0 rounded-md bg-[#f1f3f1] px-2.5 text-[11px] font-medium text-[#68736f] transition-colors hover:bg-[#e7ece9] hover:text-[#27353a] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSending || isConversationTransitioning}
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
            className="max-h-44 min-h-16 px-4 py-2.5 text-sm leading-6 placeholder:text-[#a2aaa7]"
            disabled={isSending || isConversationTransitioning}
            onChange={(event) => setDraftMessage(event.currentTarget.value)}
            placeholder="输入消息..."
            value={draftMessage}
          />
          <PromptInputFooter className="bg-transparent px-3 pb-2.5 pt-1">
            <PromptInputTools className="min-w-0 gap-2 text-[11px] text-[#7d8985]">
              <label className="flex min-w-0 items-center gap-1.5">
                <RadioTower className="size-3.5 text-[#86958f]" />
                <PromptInputSelect
                  disabled={isSending || isConversationTransitioning}
                  onValueChange={(value) => {
                    selectLocalLlmConfig(value === "platform-default" ? null : value)
                    setLlmStore(readLocalLlmConfigStore())
                  }}
                  value={selectedLlmConfig?.id ?? "platform-default"}
                >
                  <PromptInputSelectTrigger
                    aria-label="选择本次聊天使用的 LLM"
                    className="h-7 max-w-56 rounded-md border-0 bg-[#f1f3f1] px-2.5 text-[11px] font-medium text-[#68736f] hover:bg-[#e7ece9] data-placeholder:text-[#9aa39f]"
                    size="sm"
                  >
                    <PromptInputSelectValue placeholder="平台默认" />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent className="min-w-56 rounded-lg border border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.10)]">
                    <PromptInputSelectItem value="platform-default">
                      平台默认
                    </PromptInputSelectItem>
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
              disabled={isSending || isConversationTransitioning}
              onStop={stop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  )
}

export function InboxChat({ conversation, onConversationUpdated, onOpenConversationList }: InboxChatProps) {
  const queryClient = useQueryClient()
  const conversationQuery = useQuery({
    queryKey: ["agent-conversation", conversation.id],
    queryFn: () => getAgentConversation(conversation.id ?? ""),
    enabled: Boolean(conversation.id),
  })
  const [displayedChat, setDisplayedChat] = useState<InboxChatInnerProps | null>(null)
  const currentConversationData =
    conversationQuery.data?.agentId === conversation.id ? conversationQuery.data : null

  useEffect(() => {
    if (!currentConversationData) {
      return
    }

    setDisplayedChat((current) => {
      if (
        current?.conversation === conversation &&
        current?.serverConversation === currentConversationData
      ) {
        return current
      }

      return {
        conversation,
        serverConversation: currentConversationData,
      }
    })
  }, [conversation, currentConversationData])

  const chat = currentConversationData
    ? { conversation, serverConversation: currentConversationData }
    : displayedChat
  const isConversationTransitioning = Boolean(chat && chat.conversation.id !== conversation.id)

  if (!chat && conversationQuery.isLoading) {
    return <InboxChatLoadingPanel conversation={conversation} />
  }

  if (!chat && (conversationQuery.isError || !conversationQuery.data)) {
    return <InboxChatErrorPanel conversation={conversation} error={conversationQuery.error} />
  }

  if (chat && isConversationTransitioning && conversationQuery.isError) {
    return <InboxChatErrorPanel conversation={conversation} error={conversationQuery.error} />
  }

  if (!chat) {
    return <InboxChatLoadingPanel conversation={conversation} />
  }

  return (
    <InboxChatInner
      conversation={chat.conversation}
      key={chat.serverConversation.conversationId}
      isConversationTransitioning={isConversationTransitioning}
      onOpenConversationList={onOpenConversationList}
      onConversationUpdated={() => {
        void queryClient.invalidateQueries({ queryKey: ["agent-conversation", chat.conversation.id] })
        onConversationUpdated?.()
      }}
      serverConversation={chat.serverConversation}
    />
  )
}
