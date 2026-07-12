"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import {
  Brush,
  CheckCircle2,
  Download,
  Eraser,
  ImageIcon,
  KeyRound,
  Loader2,
  MessageSquareText,
  RadioTower,
  Send,
  ShieldCheck,
} from "lucide-react"
import type {
  ImageGenerationProxyRequest,
  ImageGenerationProxyResponse,
} from "@repo/contracts"

import {
  createDefaultImageGenerationConfig,
  localImageGenerationConfigChangedEventName,
  readLocalImageGenerationConfig,
  saveLocalImageGenerationConfig,
  type LocalImageGenerationConfig,
} from "@/auth/local-image-generation-config"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { http } from "@/lib/http"
import { DashboardShell } from "../_components/dashboard-shell"

type ImageGenerationMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  imageUrl?: string
  imageMimeType?: string
  createdAtMs: number
}

const quickPrompts = [
  "赛博朋克风格的雨夜街角，霓虹灯反射在湿漉漉的路面",
  "温暖自然光下的产品摄影，一只极简白色智能音箱",
  "中国水墨风山海场景，云雾、远山、孤舟",
  "一张适合作为 App 首页的插画，主题是 AI 个人助手",
]

const imageSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"]
const imageQualities = ["auto", "low", "medium", "high"]
const imageBackgrounds = ["auto", "transparent", "opaque"]
const imageOutputFormats = ["png", "jpeg", "webp"]

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `image-message-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value)).replaceAll("/", ".")
}

function buildImageUrl(value: string, mimeType = "image/png") {
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value
  }

  return `data:${mimeType};base64,${value}`
}

async function generateImage(config: LocalImageGenerationConfig, prompt: string) {
  const proxyConfig: ImageGenerationProxyRequest["config"] = {
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    model: config.model,
    providerApi: config.providerApi,
    size: config.size,
    quality: config.quality,
    background: config.background,
    outputFormat: config.outputFormat,
    ...(config.providerName ? { providerName: config.providerName } : {}),
  }
  const response = await http.post<ImageGenerationProxyResponse, ImageGenerationProxyRequest>("/rpc/image-generation/generate", {
    prompt,
    config: proxyConfig,
  })

  if (!response.image) {
    throw new Error("未能从 API 代理响应中解析到图片结果。")
  }

  return {
    url: buildImageUrl(response.image, response.mimeType),
    mimeType: response.mimeType,
  }
}

function getLatestImageMessage(messages: ImageGenerationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]

    if (message?.role === "assistant" && message.imageUrl) {
      return message
    }
  }

  return null
}

function getImageFileExtension(mimeType: string | undefined) {
  if (mimeType === "image/jpeg") {
    return "jpg"
  }

  if (mimeType === "image/webp") {
    return "webp"
  }

  return "png"
}

function ConfigField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export default function ImageGenerationPage() {
  const [config, setConfig] = useState<LocalImageGenerationConfig>(() => createDefaultImageGenerationConfig())
  const [draftPrompt, setDraftPrompt] = useState("")
  const [notice, setNotice] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [messages, setMessages] = useState<ImageGenerationMessage[]>([])
  const latestImageMessage = useMemo(
    () => getLatestImageMessage(messages),
    [messages],
  )

  useEffect(() => {
    setConfig(readLocalImageGenerationConfig())

    function handleChanged() {
      setConfig(readLocalImageGenerationConfig())
    }

    window.addEventListener(localImageGenerationConfigChangedEventName, handleChanged)

    return () => {
      window.removeEventListener(localImageGenerationConfigChangedEventName, handleChanged)
    }
  }, [])

  function handleSaveConfig() {
    const nextConfig = {
      ...config,
      providerName: config.providerName.trim(),
      baseURL: config.baseURL.trim(),
      model: config.model.trim(),
      apiKey: config.apiKey.trim(),
    }

    if (!nextConfig.providerName || !nextConfig.baseURL || !nextConfig.model || !nextConfig.apiKey) {
      setNotice("请完整填写 Provider、Base URL、Model 和 API Key。")
      return
    }

    saveLocalImageGenerationConfig(nextConfig)
    setConfig(readLocalImageGenerationConfig())
    setNotice("图片生成配置已保存到当前浏览器。")
    setErrorMessage("")
  }

  function handleResetConfig() {
    setConfig(createDefaultImageGenerationConfig())
    setNotice("已恢复默认配置，保存后生效。")
    setErrorMessage("")
  }

  async function handleGenerate() {
    const prompt = draftPrompt.trim()
    const activeConfig: LocalImageGenerationConfig = {
      ...config,
      providerName: config.providerName.trim(),
      baseURL: config.baseURL.trim(),
      model: config.model.trim(),
      apiKey: config.apiKey.trim(),
    }

    if (!prompt) {
      setErrorMessage("请输入图片提示词。")
      return
    }

    if (!activeConfig.enabled || !activeConfig.baseURL || !activeConfig.model || !activeConfig.apiKey) {
      setErrorMessage("请先保存并启用完整的图片生成 LLM 配置。")
      return
    }

    saveLocalImageGenerationConfig(activeConfig)
    setConfig(readLocalImageGenerationConfig())

    const userMessage: ImageGenerationMessage = {
      id: createMessageId(),
      role: "user",
      content: prompt,
      createdAtMs: Date.now(),
    }

    setMessages((current) => [...current, userMessage])
    setDraftPrompt("")
    setIsGenerating(true)
    setErrorMessage("")
    setNotice("")

    try {
      const image = await generateImage(activeConfig, prompt)
      const assistantMessage: ImageGenerationMessage = {
        id: createMessageId(),
        role: "assistant",
        content: "图片已生成",
        imageUrl: image.url,
        imageMimeType: image.mimeType,
        createdAtMs: Date.now(),
      }

      setMessages((current) => [...current, assistantMessage])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "图片生成失败，请检查配置。")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <DashboardShell title="图片生成">
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-6 lg:px-8 lg:py-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">IMAGE STUDIO</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">图片生成</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                使用当前连接生成图片，在主画布查看最新结果，并保留本次会话的生成记录。
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200 pt-4 xl:border-t-0 xl:pt-0">
              {[
                { label: "连接", value: config.enabled ? "已启用" : "已停用", icon: CheckCircle2 },
                { label: "模型", value: config.model || "未配置", icon: RadioTower },
                { label: "输出", value: `${config.size} · ${config.outputFormat}`, icon: ImageIcon },
              ].map((item, index) => {
                const Icon = item.icon

                return (
                  <div className={index === 0 ? "pr-4" : "border-l border-slate-200 px-4 last:pr-0"} key={item.label}>
                    <Icon className="size-4 text-slate-400" />
                    <p className="mt-2 text-[11px] font-medium text-slate-400">{item.label}</p>
                    <p className="mt-1 max-w-28 truncate text-sm font-medium text-slate-700">{item.value}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[90rem] gap-8 px-5 py-8 lg:px-8 xl:grid-cols-[19rem_minmax(0,1fr)] xl:items-start">
          <aside className="xl:sticky xl:top-20">
            <form
              className="border border-slate-200 bg-white"
              onSubmit={(event) => {
                event.preventDefault()
                handleSaveConfig()
              }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <KeyRound className="size-4 text-slate-400" />
                    连接与参数
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">当前浏览器的生图配置</p>
                </div>
                <button
                  aria-label="启用图片生成连接"
                  aria-pressed={config.enabled}
                  className={config.enabled ? "h-6 w-10 rounded-full bg-slate-950 p-0.5" : "h-6 w-10 rounded-full bg-slate-200 p-0.5"}
                  onClick={() => {
                    setConfig((current) => ({ ...current, enabled: !current.enabled }))
                    setNotice("")
                  }}
                  type="button"
                >
                  <span className={config.enabled ? "ml-auto block size-5 rounded-full bg-white" : "block size-5 rounded-full bg-white"} />
                </button>
              </div>

              <div className="grid gap-4 px-4 py-5">
                <ConfigField label="服务名称">
                  <input
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
                    onChange={(event) => {
                      const providerName = event.currentTarget.value
                      setConfig((current) => ({ ...current, providerName }))
                      setNotice("")
                    }}
                    placeholder="例如：我的生图服务"
                    value={config.providerName}
                  />
                </ConfigField>

                <ConfigField label="Base URL">
                  <input
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
                    onChange={(event) => {
                      const baseURL = event.currentTarget.value
                      setConfig((current) => ({ ...current, baseURL }))
                      setNotice("")
                    }}
                    placeholder="https://api.example.com/v1"
                    value={config.baseURL}
                  />
                </ConfigField>

                <div className="grid gap-2">
                  <span className="text-xs font-medium text-slate-500">请求协议</span>
                  <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200">
                    <button
                      aria-pressed={config.providerApi === "responses"}
                      className={config.providerApi === "responses" ? "h-9 bg-slate-950 px-3 text-xs font-medium text-white" : "h-9 border-r border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 hover:bg-slate-50"}
                      onClick={() => {
                        setConfig((current) => ({ ...current, providerApi: "responses" }))
                        setNotice("")
                      }}
                      type="button"
                    >
                      Responses
                    </button>
                    <button
                      aria-pressed={config.providerApi === "images_generations"}
                      className={config.providerApi === "images_generations" ? "h-9 bg-slate-950 px-3 text-xs font-medium text-white" : "h-9 bg-white px-3 text-xs font-medium text-slate-500 hover:bg-slate-50"}
                      onClick={() => {
                        setConfig((current) => ({ ...current, providerApi: "images_generations" }))
                        setNotice("")
                      }}
                      type="button"
                    >
                      Images
                    </button>
                  </div>
                </div>

                <ConfigField label="模型">
                  <input
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
                    onChange={(event) => {
                      const model = event.currentTarget.value
                      setConfig((current) => ({ ...current, model }))
                      setNotice("")
                    }}
                    placeholder="image-model"
                    value={config.model}
                  />
                </ConfigField>

                <ConfigField label="API Key">
                  <input
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500"
                    onChange={(event) => {
                      const apiKey = event.currentTarget.value
                      setConfig((current) => ({ ...current, apiKey }))
                      setNotice("")
                    }}
                    placeholder="sk-..."
                    type="password"
                    value={config.apiKey}
                  />
                </ConfigField>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-400">输出参数</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <ConfigField label="尺寸">
                      <Select
                        onValueChange={(size) => {
                          setConfig((current) => ({ ...current, size }))
                          setNotice("")
                        }}
                        value={config.size}
                      >
                        <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white text-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {imageSizes.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>

                    <ConfigField label="质量">
                      <Select
                        onValueChange={(quality) => {
                          setConfig((current) => ({ ...current, quality }))
                          setNotice("")
                        }}
                        value={config.quality}
                      >
                        <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white text-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {imageQualities.map((quality) => <SelectItem key={quality} value={quality}>{quality}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>

                    <ConfigField label="背景">
                      <Select
                        onValueChange={(background) => {
                          setConfig((current) => ({ ...current, background }))
                          setNotice("")
                        }}
                        value={config.background}
                      >
                        <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white text-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {imageBackgrounds.map((background) => <SelectItem key={background} value={background}>{background}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>

                    <ConfigField label="格式">
                      <Select
                        onValueChange={(outputFormat) => {
                          setConfig((current) => ({ ...current, outputFormat }))
                          setNotice("")
                        }}
                        value={config.outputFormat}
                      >
                        <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white text-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {imageOutputFormats.map((format) => <SelectItem key={format} value={format}>{format}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>
                  </div>
                </div>

                {notice ? <p className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{notice}</p> : null}

                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                  <button className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 text-sm font-medium text-white hover:bg-slate-800" type="submit">
                    <CheckCircle2 className="size-4" />
                    保存
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    onClick={handleResetConfig}
                    type="button"
                  >
                    <Eraser className="size-4" />
                    重置
                  </button>
                </div>

                <p className="flex gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  配置保存在当前浏览器。生成时，所填 API Key 会随本次请求发送至 API 代理进行转发，不写入用户资料或 D1。
                </p>
              </div>
            </form>
          </aside>

          <div className="min-w-0 space-y-8">
            <section className="overflow-hidden border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-sm font-semibold text-slate-900">创作画布</p>
                  <p className="mt-1 text-xs text-slate-400">最新结果会显示在这里。</p>
                </div>
                {latestImageMessage?.imageUrl ? (
                  <a
                    aria-label="下载最新图片"
                    className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    download={`generated-image-${latestImageMessage.id}.${getImageFileExtension(latestImageMessage.imageMimeType)}`}
                    href={latestImageMessage.imageUrl}
                    title="下载最新图片"
                  >
                    <Download className="size-4" />
                  </a>
                ) : null}
              </div>

              <div className="flex min-h-[32rem] items-center justify-center bg-slate-50/70 p-5 sm:p-8">
                {latestImageMessage?.imageUrl ? (
                  <div className="flex max-h-[38rem] w-full flex-col items-center">
                    <img alt="最新生成图片" className="max-h-[34rem] w-full object-contain" src={latestImageMessage.imageUrl} />
                    <p className="mt-4 self-start text-xs leading-5 text-slate-500">
                      {formatDateTime(latestImageMessage.createdAtMs)} · {config.model || "未配置模型"}
                    </p>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center text-slate-500">
                    <Loader2 className="mx-auto size-7 animate-spin" />
                    <p className="mt-3 text-sm font-medium">正在生成图片</p>
                    <p className="mt-1 text-xs text-slate-400">画布会在完成后自动更新。</p>
                  </div>
                ) : (
                  <div className="max-w-sm text-center">
                    <Brush className="mx-auto size-9 text-slate-300" />
                    <p className="mt-4 text-sm font-medium text-slate-700">开始一次新的创作</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">描述画面主体、风格、构图和光线，生成结果将在这里呈现。</p>
                  </div>
                )}
              </div>

              <form
                className="border-t border-slate-200 px-5 py-5 sm:px-6"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleGenerate()
                }}
              >
                <div className="mb-3 flex min-w-0 gap-2 overflow-x-auto pb-1">
                  {quickPrompts.map((prompt) => (
                    <button
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isGenerating}
                      key={prompt}
                      onClick={() => {
                        setDraftPrompt(prompt)
                        setErrorMessage("")
                      }}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <label className="grid gap-2" htmlFor="image-prompt">
                    <span className="text-sm font-medium text-slate-700">提示词</span>
                    <textarea
                      className="min-h-28 resize-y rounded-md border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                      disabled={isGenerating}
                      id="image-prompt"
                      onChange={(event) => {
                        setDraftPrompt(event.currentTarget.value)
                        setErrorMessage("")
                      }}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault()
                          void handleGenerate()
                        }
                      }}
                      placeholder="描述画面主体、风格、构图、光线和用途..."
                      value={draftPrompt}
                    />
                  </label>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isGenerating}
                    type="submit"
                  >
                    {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    生成图片
                  </button>
                </div>
                {errorMessage ? <p className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-600">{errorMessage}</p> : null}
              </form>
            </section>

            <section className="border border-slate-200 bg-white" aria-labelledby="generation-history-heading">
              <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 sm:px-6">
                <MessageSquareText className="size-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900" id="generation-history-heading">生成记录</h2>
                <span className="text-xs text-slate-400">{messages.length} 条</span>
              </div>

              {messages.length === 0 ? (
                <div className="px-5 py-10 text-center sm:px-6">
                  <ImageIcon className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">生成记录会保留在当前会话中。</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {messages.map((message) => (
                    <article className="grid gap-4 px-5 py-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:px-6" key={message.id}>
                      <div>
                        <p className="text-xs font-medium text-slate-400">{message.role === "user" ? "提示词" : "生成结果"}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDateTime(message.createdAtMs)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.content}</p>
                        {message.imageUrl ? <img alt="生成图片" className="mt-4 max-h-64 w-full object-contain object-left" src={message.imageUrl} /> : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </DashboardShell>
  )
}
