"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useChat, type UIMessage } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import type {
  AgentConversationResponse,
  AgentMessageFeedback,
  AgentMessageFeedbackRating,
  InboxChatRequest,
} from "@repo/contracts"
import {
  Clock3,
  PanelLeftOpen,
  RadioTower,
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
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800">
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
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50/70">
      <div className="border-b bg-white/90 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <AgentAvatar
            className="size-14 rounded-2xl bg-slate-950 text-base text-white"
            fallbackClassName="bg-slate-950 text-white"
            imageKey={conversation.imageKey}
            name={conversation.name}
          />
          <div className="min-w-0 flex-1">
            <div className="h-5 w-44 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="text-sm font-medium text-slate-500">正在加载聊天历史...</div>
      </div>
    </section>
  )
}

function InboxChatErrorPanel({ conversation, error }: { conversation: ChatConversation; error: unknown }) {
  const message = error instanceof Error && error.message
    ? error.message
    : "请确认 API 已启动并完成最新 D1 迁移后刷新页面。"

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50/70">
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm text-center">
          <AgentAvatar
            className="mx-auto size-12 rounded-2xl bg-slate-100 text-sm text-slate-700"
            fallbackClassName="bg-slate-100 text-slate-700"
            imageKey={conversation.imageKey}
            name={conversation.name}
          />
          <h2 className="mt-4 text-base font-semibold text-slate-950">聊天历史加载失败</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    </section>
  )
}

function InboxChatInner({ conversation, serverConversation, onConversationUpdated, onOpenConversationList }: InboxChatInnerProps) {
  const { profile } = useWebDashboardContext()
  const queryClient = useQueryClient()
  const [draftMessage, setDraftMessage] = useState("")
  const [historyMessages, setHistoryMessages] = useState<UIMessage[]>(() => buildInitialMessages(serverConversation))
  const [nextCursor, setNextCursor] = useState(serverConversation.nextCursor)
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false)
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
    messages: historyMessages,
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
    buildVisibleAssistantTextById(historyMessages),
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
  const serverMessageSignature = serverConversation.messages
    .map((message) => [
      message.id,
      message.role,
      message.createdAtMs,
      message.feedback?.rating ?? "none",
      message.feedback?.updatedAtMs ?? 0,
    ].join(":"))
    .join("\n")
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
    if (isSending) {
      return
    }

    const nextMessages = buildInitialMessages(serverConversation)

    setHistoryMessages(nextMessages)
    setMessages(nextMessages)
    setNextCursor(serverConversation.nextCursor)
    setFeedbackByMessageId(buildMessageFeedbackById(serverConversation.messages))
    setPersistedAssistantMessageIds(buildPersistedAssistantMessageIds(serverConversation.messages))
    setVisibleAssistantTextById(buildVisibleAssistantTextById(nextMessages))
  }, [isSending, serverConversation, serverMessageSignature, setMessages])

  async function loadMoreHistory() {
    if (!nextCursor || isLoadingMoreHistory || !conversation.id) {
      return
    }

    setIsLoadingMoreHistory(true)

    try {
      const response = await getAgentConversationMessages(conversation.id, nextCursor)
      const olderMessages = response.messages.map(toUiMessage)
      const olderFeedbackById = buildMessageFeedbackById(response.messages)
      const olderAssistantMessageIds = buildPersistedAssistantMessageIds(response.messages)

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
      setHistoryMessages((current) => [...olderMessages, ...current])
      setMessages((current) => [...olderMessages, ...current])
      setNextCursor(response.nextCursor)
    } finally {
      setIsLoadingMoreHistory(false)
    }
  }

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
    <section className="flex min-h-0 flex-1 flex-col bg-slate-50/70">
      <div className="flex min-h-16 items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onOpenConversationList ? (
            <button
              aria-label="选择对话"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={onOpenConversationList}
              title="选择对话"
              type="button"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          ) : null}
          <AgentAvatar
            className="size-9 rounded-md bg-slate-950 text-xs text-white"
            fallbackClassName="bg-slate-950 text-white"
            imageKey={conversation.imageKey}
            name={conversation.name}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold text-slate-900">{conversation.name}</h2>
              <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{conversation.handle}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{conversation.headline}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 sm:inline-flex">{conversation.relationship}</span>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">{conversation.status}</span>
        </div>
      </div>

      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-7 sm:px-6">
          <div className="flex items-center justify-center">
            {nextCursor ? (
              <button
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingMoreHistory}
                onClick={() => {
                  void loadMoreHistory()
                }}
                type="button"
              >
                <Clock3 className="size-3.5 text-slate-500" />
                {isLoadingMoreHistory ? "正在加载历史" : "加载更早消息"}
              </button>
            ) : (
              <span className="text-xs text-slate-400">更早的对话会显示在这里</span>
            )}
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
                )}
                key={message.id}
              >
                {!isUser ? (
                  <AgentAvatar
                    className="mt-5 size-8 rounded-md bg-slate-100 text-xs text-slate-700"
                    fallbackClassName="bg-slate-100 text-slate-700"
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
                  <div
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium",
                      isUser ? "text-slate-500" : "text-slate-500",
                    )}
                  >
                    <span>{isUser ? "你" : conversation.name}</span>
                  </div>

                  <div
                    className={cn(
                      "relative border px-4 py-3 text-sm leading-6",
                      isUser
                        ? "rounded-md border-slate-900 bg-slate-950 text-white"
                        : "rounded-md border-slate-200 bg-white text-slate-800",
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
                  <span className="mt-6 shrink-0">
                    <UserAvatar user={profile} size="sm" />
                  </span>
                ) : null}
              </div>
            )
          })}
          {shouldShowTypingBubble ? <TypingBubble conversation={conversation} /> : null}
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">
              {formatChatErrorMessage(error)}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-white px-4 py-4 sm:px-6">
        <PromptInput
          className="mx-auto max-w-3xl border border-slate-200 bg-white"
          onSubmit={(message) => {
            const text = message.text.trim()

            if (!text) {
              return
            }

            sendMessage({ text })
            setDraftMessage("")
          }}
        >
          <PromptInputHeader className="border-b bg-slate-50/70 px-3 py-2">
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {quickPrompts.map((prompt) => (
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
            className="max-h-44 min-h-20 px-3 py-3 text-sm"
            disabled={isSending}
            onChange={(event) => setDraftMessage(event.currentTarget.value)}
            placeholder="输入想说的话，或先选择上方快捷提示..."
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
                    aria-label="选择本次聊天使用的 LLM"
                    className="h-7 max-w-56 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 data-placeholder:text-slate-500"
                    size="sm"
                  >
                    <PromptInputSelectValue placeholder="平台默认" />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent className="min-w-56 rounded-md border border-slate-200 shadow-none">
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
              className="rounded-md"
              disabled={isSending}
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

  if (conversationQuery.isLoading) {
    return <InboxChatLoadingPanel conversation={conversation} />
  }

  if (conversationQuery.isError || !conversationQuery.data) {
    return <InboxChatErrorPanel conversation={conversation} error={conversationQuery.error} />
  }

  return (
    <InboxChatInner
      conversation={conversation}
      key={conversationQuery.data.conversationId}
      onOpenConversationList={onOpenConversationList}
      onConversationUpdated={() => {
        void queryClient.invalidateQueries({ queryKey: ["agent-conversation", conversation.id] })
        onConversationUpdated?.()
      }}
      serverConversation={conversationQuery.data}
    />
  )
}
