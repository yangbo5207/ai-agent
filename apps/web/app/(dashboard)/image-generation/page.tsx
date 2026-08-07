"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import {
  Brush,
  CheckCircle2,
  Clock3,
  Download,
  Eraser,
  Eye,
  HardDrive,
  ImageIcon,
  KeyRound,
  Loader2,
  Palette,
  RadioTower,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import {
  createDefaultImageGenerationConfig,
  isApiClubImageProvider,
  isDirectGptImageModel,
  isGptImage2Model,
  localImageGenerationConfigChangedEventName,
  normalizeLocalImageGenerationConfig,
  readLocalImageGenerationConfig,
  saveLocalImageGenerationConfig,
  type LocalImageGenerationConfig,
} from "@/auth/local-image-generation-config"
import {
  generateImage,
  isImageGenerationConfigReady,
  uploadGeneratedImage,
} from "@/auth/image-generation"
import {
  deleteLocalImageGenerationHistory,
  listLocalImageGenerationHistory,
  localImageGenerationHistoryLimit,
  markLocalImageGenerationHistoryUploaded,
  saveLocalImageGenerationHistory,
  type LocalImageGenerationHistoryRecord,
} from "@/auth/local-image-generation-history"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { DashboardShell } from "../_components/dashboard-shell"

type ImageGenerationHistoryItem = LocalImageGenerationHistoryRecord & {
  imageUrl: string
}

const quickPrompts = [
  "赛博朋克风格的雨夜街角，霓虹灯反射在湿漉漉的路面",
  "温暖自然光下的产品摄影，一只极简白色智能音箱",
  "中国水墨风山海场景，云雾、远山、孤舟",
  "一张适合作为 App 首页的插画，主题是 AI 个人助手",
]

const imageStyles = [
  { id: "auto", label: "自动", instruction: "" },
  {
    id: "anime",
    label: "动漫",
    instruction: "采用高质量动漫插画风格，线条干净，角色造型鲜明，色彩层次丰富，画面细节完整。",
  },
  {
    id: "chinese",
    label: "中国风",
    instruction: "采用中国传统美学与东方构图，融合国风配色、水墨或工笔质感，意境含蓄雅致。",
  },
  {
    id: "western",
    label: "欧美风",
    instruction: "采用欧美商业插画风格，轮廓清晰，构图大胆，配色成熟，具有现代出版物质感。",
  },
  {
    id: "realistic",
    label: "写实",
    instruction: "采用高写实摄影风格，真实材质与自然光影，合理景深，细节可信，避免插画感。",
  },
  {
    id: "3d",
    label: "3D",
    instruction: "采用精致的 3D CG 渲染风格，材质细腻，体积光自然，空间层次明确。",
  },
  {
    id: "cinematic",
    label: "电影感",
    instruction: "采用电影级画面风格，镜头语言明确，光影富有戏剧性，色彩分级克制，氛围完整。",
  },
  {
    id: "watercolor",
    label: "水彩",
    instruction: "采用手绘水彩风格，保留纸张纹理、自然晕染和轻盈笔触，色彩通透。",
  },
] as const

const imageSizes = ["1024x1024", "1024x1536", "1536x1024", "auto"]
const imageQualities = [
  { value: "low", label: "低（更快）" },
  { value: "medium", label: "中" },
  { value: "high", label: "高（更精细）" },
] as const
const reasoningEfforts = [
  { value: "none", label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "xhigh", label: "极高" },
] as const
const imageBackgrounds = ["auto", "transparent", "opaque"]
const imageOutputFormats = ["png", "jpeg", "webp"]
const maxImageGenerationPromptLength = 4000

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

function formatGenerationDuration(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getImageAspectRatio(size: string) {
  if (size === "1024x1536") {
    return "2 / 3"
  }

  if (size === "1536x1024") {
    return "3 / 2"
  }

  return "1 / 1"
}

function getImageSkeletonMaxWidth(size: string) {
  if (size === "1024x1536") {
    return "22.667rem"
  }

  if (size === "1536x1024") {
    return "42rem"
  }

  return "34rem"
}

function buildStyledImagePrompt(prompt: string, style: (typeof imageStyles)[number]) {
  if (!style.instruction) {
    return prompt.slice(0, maxImageGenerationPromptLength)
  }

  const suffix = `风格要求：${style.instruction}`
  const availablePromptLength = maxImageGenerationPromptLength - suffix.length - 2

  return `${prompt.slice(0, availablePromptLength)}\n\n${suffix}`
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

async function readGeneratedImageBlob(url: string, fallbackMimeType: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("生成图片读取失败，无法写入本地历史记录。")
  }

  const blob = await response.blob()

  return blob.type ? blob : new Blob([blob], { type: fallbackMimeType })
}

function createGeneratedImageFile(item: ImageGenerationHistoryItem) {
  return new File(
    [item.imageBlob],
    `generated-image-${item.id}.${getImageFileExtension(item.mimeType)}`,
    {
      type: item.mimeType,
      lastModified: item.createdAtMs,
    },
  )
}

function ConfigField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-medium text-[#687572]">{label}</span>
      {children}
    </label>
  )
}

export default function ImageGenerationPage() {
  const [config, setConfig] = useState<LocalImageGenerationConfig>(() => createDefaultImageGenerationConfig())
  const [draftPrompt, setDraftPrompt] = useState("")
  const [selectedImageStyleId, setSelectedImageStyleId] = useState<(typeof imageStyles)[number]["id"]>("auto")
  const [notice, setNotice] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStartedAtMs, setGenerationStartedAtMs] = useState<number | null>(null)
  const [generationElapsedMs, setGenerationElapsedMs] = useState(0)
  const [historyItems, setHistoryItems] = useState<ImageGenerationHistoryItem[]>([])
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [previewHistoryId, setPreviewHistoryId] = useState<string | null>(null)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyNotice, setHistoryNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [uploadingHistoryIds, setUploadingHistoryIds] = useState<Set<string>>(() => new Set())
  const historyObjectUrlsRef = useRef<Set<string>>(new Set())
  const latestImageMessage = historyItems.find((item) => item.id === selectedHistoryId)
    ?? historyItems[0]
    ?? null
  const previewHistoryItem = historyItems.find((item) => item.id === previewHistoryId) ?? null
  const selectedImageStyle = imageStyles.find((style) => style.id === selectedImageStyleId) ?? imageStyles[0]
  const usesDirectImageApi = isDirectGptImageModel(config.model)
  const usesApiClub = isApiClubImageProvider(config.baseURL)
  const usesGptImage2 = isGptImage2Model(config.model)
  const usesFixedJpegOutput = usesApiClub || usesGptImage2

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

  useEffect(() => {
    let cancelled = false

    void listLocalImageGenerationHistory()
      .then((records) => {
        const items = records.map((record) => ({
          ...record,
          imageUrl: URL.createObjectURL(record.imageBlob),
        }))

        if (cancelled) {
          items.forEach((item) => URL.revokeObjectURL(item.imageUrl))
          return
        }

        items.forEach((item) => historyObjectUrlsRef.current.add(item.imageUrl))
        setHistoryItems(items)
        setSelectedHistoryId((current) => current ?? items[0]?.id ?? null)
      })
      .catch((error) => {
        if (!cancelled) {
          setHistoryNotice({
            type: "error",
            text: error instanceof Error ? error.message : "无法读取本地图片历史记录。",
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHistoryLoading(false)
        }
      })

    return () => {
      cancelled = true
      historyObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      historyObjectUrlsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!isGenerating || generationStartedAtMs === null) {
      return
    }

    const startedAtMs = generationStartedAtMs

    function updateElapsedTime() {
      setGenerationElapsedMs(Date.now() - startedAtMs)
    }

    updateElapsedTime()
    const timer = window.setInterval(updateElapsedTime, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [generationStartedAtMs, isGenerating])

  function handleSaveConfig() {
    const nextConfig = normalizeLocalImageGenerationConfig({
      ...config,
      providerName: config.providerName.trim(),
      baseURL: config.baseURL.trim(),
      model: config.model.trim(),
      apiKey: config.apiKey.trim(),
    })

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

  function addHistoryRecord(record: LocalImageGenerationHistoryRecord) {
    const item: ImageGenerationHistoryItem = {
      ...record,
      imageUrl: URL.createObjectURL(record.imageBlob),
    }

    historyObjectUrlsRef.current.add(item.imageUrl)
    setSelectedHistoryId(item.id)
    setHistoryItems((current) => {
      const nextItems = [item, ...current.filter((currentItem) => currentItem.id !== item.id)]
        .sort((left, right) => right.createdAtMs - left.createdAtMs)
      const retainedItems = nextItems.slice(0, localImageGenerationHistoryLimit)
      const expiredItems = nextItems.slice(localImageGenerationHistoryLimit)

      expiredItems.forEach((expiredItem) => {
        URL.revokeObjectURL(expiredItem.imageUrl)
        historyObjectUrlsRef.current.delete(expiredItem.imageUrl)
      })

      return retainedItems
    })
  }

  async function handleUploadHistoryItem(item: ImageGenerationHistoryItem) {
    if (item.uploadedKey || uploadingHistoryIds.has(item.id)) {
      return
    }

    setUploadingHistoryIds((current) => new Set(current).add(item.id))
    setHistoryNotice(null)

    try {
      const uploaded = await uploadGeneratedImage(createGeneratedImageFile(item))
      let localStatusSaved = true

      try {
        await markLocalImageGenerationHistoryUploaded(item.id, uploaded.key, uploaded.uploadedAtMs)
      } catch {
        localStatusSaved = false
      }

      setHistoryItems((current) => current.map((currentItem) => currentItem.id === item.id
        ? {
            ...currentItem,
            uploadedKey: uploaded.key,
            uploadedAtMs: uploaded.uploadedAtMs,
          }
        : currentItem))
      setHistoryNotice({
        type: localStatusSaved ? "success" : "error",
        text: localStatusSaved
          ? "图片已由你确认上传。"
          : "图片已上传，但浏览器未能保存上传状态；请勿重复上传。",
      })
    } catch (error) {
      setHistoryNotice({
        type: "error",
        text: error instanceof Error ? error.message : "图片上传失败，请稍后重试。",
      })
    } finally {
      setUploadingHistoryIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }

  async function handleDeleteHistoryItem(item: ImageGenerationHistoryItem) {
    if (!window.confirm("仅删除当前浏览器中的这条图片记录，是否继续？")) {
      return
    }

    try {
      await deleteLocalImageGenerationHistory(item.id)
      URL.revokeObjectURL(item.imageUrl)
      historyObjectUrlsRef.current.delete(item.imageUrl)
      setHistoryItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
      setPreviewHistoryId((current) => current === item.id ? null : current)
      setSelectedHistoryId((current) => current === item.id
        ? historyItems.find((currentItem) => currentItem.id !== item.id)?.id ?? null
        : current)
      setHistoryNotice(null)
    } catch (error) {
      setHistoryNotice({
        type: "error",
        text: error instanceof Error ? error.message : "删除本地图片记录失败。",
      })
    }
  }

  async function handleGenerate() {
    const prompt = draftPrompt.trim()
    const activeConfig = normalizeLocalImageGenerationConfig({
      ...config,
      providerName: config.providerName.trim(),
      baseURL: config.baseURL.trim(),
      model: config.model.trim(),
      apiKey: config.apiKey.trim(),
    })

    if (!prompt) {
      setErrorMessage("请输入图片提示词。")
      return
    }

    if (!isImageGenerationConfigReady(activeConfig)) {
      setErrorMessage("请先保存并启用完整的图片生成 LLM 配置。")
      return
    }

    saveLocalImageGenerationConfig(activeConfig)
    setConfig(readLocalImageGenerationConfig())

    setDraftPrompt("")
    const startedAtMs = Date.now()

    setGenerationStartedAtMs(startedAtMs)
    setGenerationElapsedMs(0)
    setIsGenerating(true)
    setErrorMessage("")
    setNotice("")
    setHistoryNotice(null)

    try {
      const image = await generateImage(activeConfig, buildStyledImagePrompt(prompt, selectedImageStyle))
      const durationMs = Date.now() - startedAtMs
      const imageBlob = await readGeneratedImageBlob(image.url, image.mimeType)
      const historyRecord: LocalImageGenerationHistoryRecord = {
        id: createMessageId(),
        prompt,
        styleId: selectedImageStyle.id,
        styleLabel: selectedImageStyle.label,
        model: activeConfig.model,
        size: activeConfig.size,
        quality: activeConfig.quality,
        reasoningEffort: activeConfig.providerApi === "responses"
          ? activeConfig.reasoningEffort
          : undefined,
        mimeType: image.mimeType,
        imageBlob,
        durationMs,
        createdAtMs: Date.now(),
      }

      try {
        await saveLocalImageGenerationHistory(historyRecord)
      } catch (cacheError) {
        setHistoryNotice({
          type: "error",
          text: cacheError instanceof Error
            ? `图片已生成，但本地缓存失败：${cacheError.message}`
            : "图片已生成，但无法写入本地历史记录。",
        })
      }

      setGenerationElapsedMs(durationMs)
      addHistoryRecord(historyRecord)
    } catch (error) {
      const durationMs = Date.now() - startedAtMs
      const message = error instanceof Error ? error.message : "图片生成失败，请检查配置。"

      setGenerationElapsedMs(durationMs)
      setErrorMessage(`${message}（已运行 ${formatGenerationDuration(durationMs)}）`)
    } finally {
      setIsGenerating(false)
      setGenerationStartedAtMs(null)
    }
  }

  return (
    <DashboardShell
      headerRight={
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {[
            { label: "连接", value: config.enabled ? "已启用" : "已停用", icon: CheckCircle2 },
            { label: "模型", value: config.model || "未配置", icon: RadioTower },
            { label: "输出", value: `${config.size} · ${config.outputFormat}`, icon: ImageIcon },
          ].map((item) => {
            const Icon = item.icon

            return (
              <span
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#d9dfdc] bg-[#fbfaf7] px-2.5 text-[10px] font-medium text-[#53615e]"
                key={item.label}
              >
                <Icon className="size-3 text-[#a37b4f]" />
                <span className="text-[#9a8d7e]">{item.label}</span>
                <span className="max-w-28 truncate font-semibold text-[#27353a]">{item.value}</span>
              </span>
            )
          })}
        </div>
      }
      title="图片生成"
    >
      <main className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <section className="mx-auto grid min-h-0 flex-1 max-w-[90rem] gap-5 overflow-y-auto rounded-xl border border-[#dfe3e1] bg-white px-4 py-5 sm:px-5 sm:py-5 lg:px-6 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
            <aside className="xl:sticky xl:top-4 xl:self-start">
              <form
                className="overflow-hidden rounded-lg border border-[#dfe3e1] bg-[#fffefa]"
                onSubmit={(event) => {
                  event.preventDefault()
                  handleSaveConfig()
                }}
              >
                <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#e3e6e4] bg-[#fbfaf7] px-3.5 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]">
                      <KeyRound className="size-3.5 text-[#a37b4f]" />
                      连接与参数
                    </p>
                    <p className="mt-0.5 text-[10px] leading-5 text-[#929b98]">当前浏览器的生图配置</p>
                  </div>
                  <button
                    aria-label="启用图片生成连接"
                    aria-pressed={config.enabled}
                    className={config.enabled ? "h-6 w-10 rounded-full bg-[#27353a] p-0.5" : "h-6 w-10 rounded-full bg-[#dfe3e1] p-0.5"}
                    onClick={() => {
                      setConfig((current) => ({ ...current, enabled: !current.enabled }))
                      setNotice("")
                    }}
                    type="button"
                  >
                    <span className={config.enabled ? "ml-auto block size-5 rounded-full bg-white" : "block size-5 rounded-full bg-white"} />
                  </button>
                </div>

                <div className="grid gap-3.5 px-3.5 py-4">
                  <ConfigField label="服务名称">
                    <input
                      className="h-8 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-2.5 text-[11px] text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
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
                    className="h-8 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-2.5 text-[11px] text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
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
                  <span className="text-[11px] font-medium text-[#687572]">请求协议</span>
                  <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#d9dfdc]">
                    <button
                      aria-pressed={config.providerApi === "responses"}
                      className={config.providerApi === "responses" ? "h-8 bg-[#27353a] px-3 text-[11px] font-medium text-white" : "h-8 border-r border-[#d9dfdc] bg-[#fffefa] px-3 text-[11px] font-medium text-[#687572] hover:bg-[#f1f3f1]"}
                      disabled={usesDirectImageApi}
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
                      className={config.providerApi === "images_generations" ? "h-8 bg-[#27353a] px-3 text-[11px] font-medium text-white" : "h-8 bg-[#fffefa] px-3 text-[11px] font-medium text-[#687572] hover:bg-[#f1f3f1]"}
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
                    className="h-8 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-2.5 text-[11px] text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
                    onChange={(event) => {
                      const model = event.currentTarget.value
                      setConfig((current) => ({
                        ...current,
                        model,
                        ...(isDirectGptImageModel(model) ? { providerApi: "images_generations" as const } : {}),
                        ...(isGptImage2Model(model)
                          ? {
                              background: current.background === "transparent" ? "opaque" : current.background,
                              outputFormat: "jpeg",
                            }
                          : {}),
                      }))
                      setNotice("")
                    }}
                    placeholder="gpt-image-2"
                    value={config.model}
                  />
                </ConfigField>

                <ConfigField label="API Key">
                  <input
                    className="h-8 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-2.5 text-[11px] text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0]"
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

                <div className="border-t border-[#edf0ee] pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a37b4f]">生成参数</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <ConfigField label="尺寸">
                      <Select
                        onValueChange={(size) => {
                          setConfig((current) => ({ ...current, size }))
                          setNotice("")
                        }}
                        value={config.size}
                      >
                        <SelectTrigger className="h-8 w-full rounded-md border-[#d9dfdc] bg-[#fffefa] text-[11px] text-[#53615e] shadow-none focus:ring-[#dce5e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.10)]">
                          {imageSizes.map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>

                    <ConfigField label="质量">
                      <Select
                        onValueChange={(quality) => {
                          setConfig((current) => ({
                            ...current,
                            quality: quality as LocalImageGenerationConfig["quality"],
                          }))
                          setNotice("")
                        }}
                        value={config.quality}
                      >
                        <SelectTrigger className="h-8 w-full rounded-md border-[#d9dfdc] bg-[#fffefa] text-[11px] text-[#53615e] shadow-none focus:ring-[#dce5e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.10)]">
                          {imageQualities.map((quality) => (
                            <SelectItem key={quality.value} value={quality.value}>{quality.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ConfigField>

                    <ConfigField label="思考强度">
                      <Select
                        disabled={config.providerApi !== "responses"}
                        onValueChange={(reasoningEffort) => {
                          setConfig((current) => ({
                            ...current,
                            reasoningEffort: reasoningEffort as LocalImageGenerationConfig["reasoningEffort"],
                          }))
                          setNotice("")
                        }}
                        value={config.reasoningEffort}
                      >
                        <SelectTrigger className="h-8 w-full rounded-md border-[#d9dfdc] bg-[#fffefa] text-[11px] text-[#53615e] shadow-none focus:ring-[#dce5e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.10)]">
                          {reasoningEfforts.map((effort) => (
                            <SelectItem key={effort.value} value={effort.value}>{effort.label}</SelectItem>
                          ))}
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
                        <SelectTrigger className="h-8 w-full rounded-md border-[#d9dfdc] bg-[#fffefa] text-[11px] text-[#53615e] shadow-none focus:ring-[#dce5e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.10)]">
                          {imageBackgrounds
                            .filter((background) => !usesFixedJpegOutput || background !== "transparent")
                            .map((background) => <SelectItem key={background} value={background}>{background}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>

                    <ConfigField label="格式">
                      <Select
                        disabled={usesFixedJpegOutput}
                        onValueChange={(outputFormat) => {
                          setConfig((current) => ({ ...current, outputFormat }))
                          setNotice("")
                        }}
                        value={usesFixedJpegOutput ? "jpeg" : config.outputFormat}
                      >
                        <SelectTrigger className="h-8 w-full rounded-md border-[#d9dfdc] bg-[#fffefa] text-[11px] text-[#53615e] shadow-none focus:ring-[#dce5e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#d9dfdc] bg-[#fffefa] shadow-[0_12px_30px_rgba(39,53,58,0.10)]">
                          {imageOutputFormats.map((format) => <SelectItem key={format} value={format}>{format}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </ConfigField>
                  </div>
                </div>

                {notice ? <p className="rounded-md border border-[#d9dfdc] bg-[#f1f5f2] px-3 py-2 text-[11px] leading-5 text-[#53615e]">{notice}</p> : null}

                <div className="grid grid-cols-2 gap-2 border-t border-[#e8ece9] pt-4">
                  <button className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[#27353a] px-3 text-[11px] font-semibold text-white hover:bg-[#35484c]" type="submit">
                    <CheckCircle2 className="size-4" />
                    保存
                  </button>
                  <button
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#d9dfdc] px-3 text-[11px] font-semibold text-[#687572] hover:bg-[#f1f3f1]"
                    onClick={handleResetConfig}
                    type="button"
                  >
                    <Eraser className="size-4" />
                    重置
                  </button>
                </div>

                  <p className="flex gap-2 border-t border-[#e8ece9] pt-4 text-[10px] leading-5 text-[#929b98]">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    配置保存在当前浏览器。生成时，所填 API Key 会随本次请求发送至 API 代理进行转发，不写入用户资料或 D1。
                  </p>
                </div>
              </form>
            </aside>

            <div className="min-w-0 space-y-5">
              <section className="overflow-hidden rounded-lg border border-[#dfe3e1] bg-[#fffefa]">
                <div className="flex flex-col items-start justify-between gap-3 border-b border-[#e3e6e4] bg-[#fbfaf7] px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <div>
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-[#27353a]"><Brush className="size-3.5 text-[#a37b4f]" /> 创作画布</p>
                    <p className="mt-0.5 text-[10px] text-[#929b98]">生成结果或从本地历史选择的图片会显示在这里。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {isGenerating ? (
                      <div className="flex h-7 items-center gap-2 rounded-md bg-[#f1f3f1] px-2.5 text-[10px] font-medium text-[#687572]">
                        <span className="size-1.5 rounded-full bg-[#a37b4f] motion-safe:animate-pulse" />
                        <span>生成中</span>
                        <time className="min-w-10 tabular-nums text-[#27353a]">
                          {formatGenerationDuration(generationElapsedMs)}
                        </time>
                      </div>
                    ) : null}
                    {latestImageMessage?.uploadedKey ? (
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#e5eee8] px-2.5 text-[10px] font-medium text-[#426453]">
                        <CheckCircle2 className="size-3.5" />
                        已上传
                      </span>
                    ) : latestImageMessage ? (
                      <button
                        aria-label="上传最新图片"
                        className="flex size-7 items-center justify-center rounded-md border border-[#d9dfdc] text-[#687572] hover:bg-[#f1f3f1] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={uploadingHistoryIds.has(latestImageMessage.id)}
                        onClick={() => void handleUploadHistoryItem(latestImageMessage)}
                        title="上传最新图片"
                        type="button"
                      >
                        {uploadingHistoryIds.has(latestImageMessage.id)
                          ? <Loader2 className="size-4 animate-spin" />
                          : <Upload className="size-4" />}
                      </button>
                    ) : null}
                    {latestImageMessage?.imageUrl ? (
                      <a
                        aria-label="下载最新图片"
                        className="flex size-7 items-center justify-center rounded-md border border-[#d9dfdc] text-[#687572] hover:bg-[#f1f3f1]"
                        download={`generated-image-${latestImageMessage.id}.${getImageFileExtension(latestImageMessage.mimeType)}`}
                        href={latestImageMessage.imageUrl}
                        title="下载最新图片"
                      >
                        <Download className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-h-[30rem] items-center justify-center bg-[#f7f8f6] p-5 sm:p-8">
                  {latestImageMessage?.imageUrl && !isGenerating ? (
                    <div className="flex max-h-[38rem] w-full flex-col items-center">
                      <img alt="最新生成图片" className="max-h-[34rem] w-full object-contain" src={latestImageMessage.imageUrl} />
                      <p className="mt-4 self-start text-[10px] leading-5 text-[#929b98]">
                        {formatDateTime(latestImageMessage.createdAtMs)} · {latestImageMessage.model}
                        {latestImageMessage.styleLabel ? ` · ${latestImageMessage.styleLabel}` : ""}
                        {` · 耗时 ${formatGenerationDuration(latestImageMessage.durationMs)}`}
                      </p>
                    </div>
                  ) : isGenerating ? (
                    <Skeleton
                      aria-live="polite"
                      className="mx-auto flex w-full items-center justify-center border border-[#dfe3e1] bg-gradient-to-br from-[#eef1ef] via-[#f8faf8] to-[#dfe7e1]"
                      role="status"
                      style={{
                        aspectRatio: getImageAspectRatio(config.size),
                        maxWidth: getImageSkeletonMaxWidth(config.size),
                      }}
                    >
                      <div className="relative z-10 text-center text-[#687572]">
                        <ImageIcon className="mx-auto size-8 text-[#a1ada7]" />
                        <p className="mt-4 text-sm font-semibold text-[#53615e]">正在生成图片</p>
                        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold tabular-nums text-[#687572]">
                          <Clock3 className="size-4 text-[#a37b4f]" />
                          {formatGenerationDuration(generationElapsedMs)}
                        </p>
                        <p className="mt-2 text-[11px] text-[#929b98]">画布会在完成后自动更新。</p>
                      </div>
                    </Skeleton>
                  ) : isHistoryLoading ? (
                    <Skeleton className="aspect-square w-full max-w-2xl border border-[#dfe3e1] bg-gradient-to-br from-[#eef1ef] via-[#f8faf8] to-[#dfe7e1]" />
                  ) : (
                    <div className="max-w-sm text-center">
                      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[#f1f3f1] text-[#7b8783]"><Brush className="size-5" /></span>
                      <p className="mt-4 text-sm font-semibold text-[#53615e]">开始一次新的创作</p>
                      <p className="mt-2 text-sm leading-6 text-[#929b98]">描述画面主体、风格、构图和光线，生成结果将在这里呈现。</p>
                    </div>
                  )}
                </div>

                <form
                  className="border-t border-[#e3e6e4] bg-[#fffefa] px-4 py-4 sm:px-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleGenerate()
                  }}
                >
                  <div className="mb-4">
                    <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[#53615e]">
                      <Palette className="size-3.5 text-[#a37b4f]" />
                      图片风格
                    </div>
                    <div aria-label="图片风格" className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group">
                      {imageStyles.map((style) => (
                        <button
                          aria-pressed={selectedImageStyleId === style.id}
                          className={selectedImageStyleId === style.id
                            ? "h-8 shrink-0 rounded-md bg-[#27353a] px-2.5 text-[11px] font-semibold text-white"
                            : "h-8 shrink-0 rounded-md bg-[#f1f3f1] px-2.5 text-[11px] font-medium text-[#687572] hover:bg-[#e7ece9] hover:text-[#27353a]"}
                          disabled={isGenerating}
                          key={style.id}
                          onClick={() => {
                            setSelectedImageStyleId(style.id)
                            setErrorMessage("")
                          }}
                          type="button"
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3 flex min-w-0 gap-2 overflow-x-auto pb-1">
                    {quickPrompts.map((prompt) => (
                      <button
                        className="shrink-0 rounded-md bg-[#f1f3f1] px-2.5 py-1.5 text-[10px] text-[#687572] transition-colors hover:bg-[#e7ece9] disabled:cursor-not-allowed disabled:opacity-50"
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
                      <span className="text-[11px] font-semibold text-[#687572]">提示词</span>
                      <textarea
                        className="min-h-24 resize-y rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 py-2.5 text-sm leading-6 text-[#53615e] outline-none transition-colors placeholder:text-[#b0b8b4] focus:border-[#9baba4] focus:ring-2 focus:ring-[#dce5e0] disabled:cursor-not-allowed disabled:bg-[#f1f3f1]"
                        disabled={isGenerating}
                        id="image-prompt"
                        maxLength={maxImageGenerationPromptLength}
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
                      className="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md bg-[#27353a] px-4 text-sm font-semibold text-white hover:bg-[#35484c] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isGenerating}
                      type="submit"
                    >
                      {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {isGenerating ? `生成中 ${formatGenerationDuration(generationElapsedMs)}` : "生成图片"}
                    </button>
                  </div>
                  {errorMessage ? <p className="mt-3 rounded-md border border-[#e8c9c0] bg-[#fff4f1] px-3 py-2 text-sm leading-6 text-[#a14e43]">{errorMessage}</p> : null}
                </form>
              </section>

              <section className="overflow-hidden rounded-lg border border-[#dfe3e1] bg-[#fffefa]" aria-labelledby="generation-history-heading">
                <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-[#e3e6e4] bg-[#fbfaf7] px-4 py-3 sm:px-5">
                  <HardDrive className="size-3.5 text-[#a37b4f]" />
                  <h2 className="text-sm font-semibold text-[#27353a]" id="generation-history-heading">本地图片历史</h2>
                  <span className="text-[11px] text-[#929b98]">{historyItems.length} 张</span>
                  <span className="ml-auto text-[11px] text-[#929b98]">仅保存在当前浏览器</span>
                </div>

              {historyNotice ? (
                <p className={historyNotice.type === "success"
                  ? "border-b border-[#cfe0d6] bg-[#f0f7f2] px-4 py-2.5 text-xs text-[#426453] sm:px-5"
                  : "border-b border-[#e8c9c0] bg-[#fff4f1] px-4 py-2.5 text-xs text-[#a14e43] sm:px-5"}
                >
                  {historyNotice.text}
                </p>
              ) : null}

              {isHistoryLoading ? (
                <div className="divide-y divide-[#edf0ee]" aria-label="正在读取本地历史记录">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[10rem_minmax(0,1fr)] md:items-stretch" key={index}>
                      <Skeleton className="h-[7.5rem] w-40 rounded-md border border-[#dfe3e1]" />
                      <div className="flex min-w-0 flex-col py-1 md:h-[7.5rem]">
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-4/5 rounded" />
                          <Skeleton className="h-4 w-3/5 rounded" />
                          <Skeleton className="h-3 w-2/5 rounded" />
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 md:mt-auto md:pt-3">
                          <Skeleton className="h-3 w-32 rounded" />
                          <div className="flex gap-2">
                            <Skeleton className="size-9 rounded-md" />
                            <Skeleton className="size-9 rounded-md" />
                            <Skeleton className="size-9 rounded-md" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="px-4 py-12 text-center sm:px-5">
                  <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[#27353a] text-[#f7f3ec]">
                    <ImageIcon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm text-[#687572]">生成后的图片会缓存在当前浏览器，刷新页面后仍可查看。</p>
                </div>
              ) : (
                <div className="divide-y divide-[#edf0ee]">
                  {historyItems.map((item) => (
                    <article className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[10rem_minmax(0,1fr)] md:items-stretch" key={item.id}>
                      <button
                        aria-label="在画布中查看这张图片"
                        className={selectedHistoryId === item.id
                          ? "h-[7.5rem] w-40 overflow-hidden rounded-md border-2 border-[#27353a] bg-[#f1f3f1]"
                          : "h-[7.5rem] w-40 overflow-hidden rounded-md border border-[#d9dfdc] bg-[#f1f3f1] hover:border-[#a9b5b0]"}
                        onClick={() => setSelectedHistoryId(item.id)}
                        type="button"
                      >
                        <img alt="本地生成图片" className="size-full object-cover" src={item.imageUrl} />
                      </button>

                      <div className="flex min-w-0 flex-col md:h-[7.5rem]">
                        <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#53615e]">{item.prompt}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#929b98]">
                          <span>{formatDateTime(item.createdAtMs)}</span>
                          <span>{item.model}</span>
                          {item.styleLabel ? <span>{item.styleLabel}</span> : null}
                          {item.quality ? <span>{`质量 ${item.quality}`}</span> : null}
                          <span>{item.size}</span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Clock3 className="size-3" />
                            {formatGenerationDuration(item.durationMs)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 md:mt-auto md:pt-3">
                          <p className={item.uploadedKey
                            ? "flex items-center gap-1.5 text-[11px] font-medium text-[#426453]"
                            : "flex items-center gap-1.5 text-[11px] text-[#929b98]"}
                          >
                            {item.uploadedKey ? <CheckCircle2 className="size-3.5" /> : <HardDrive className="size-3.5" />}
                            {item.uploadedKey ? "已由你手动上传" : "仅本地缓存，尚未上传"}
                          </p>

                          <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
                            {!item.uploadedKey ? (
                              <button
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-[11px] font-medium text-[#53615e] hover:border-[#a9b5b0] hover:bg-[#f1f3f1] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={uploadingHistoryIds.has(item.id)}
                                onClick={() => void handleUploadHistoryItem(item)}
                                type="button"
                              >
                                {uploadingHistoryIds.has(item.id)
                                  ? <Loader2 className="size-3.5 animate-spin" />
                                  : <Upload className="size-3.5" />}
                                {uploadingHistoryIds.has(item.id) ? "上传中" : "上传"}
                              </button>
                            ) : null}
                            <button
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#d9dfdc] bg-[#fffefa] px-3 text-[11px] font-medium text-[#53615e] hover:border-[#a9b5b0] hover:bg-[#f1f3f1]"
                              onClick={() => setPreviewHistoryId(item.id)}
                              type="button"
                            >
                              <Eye className="size-3.5" />
                              预览
                            </button>
                            <a
                              aria-label="下载图片"
                              className="flex size-8 items-center justify-center rounded-md border border-[#d9dfdc] bg-[#fffefa] text-[#687572] hover:border-[#a9b5b0] hover:bg-[#f1f3f1]"
                              download={`generated-image-${item.id}.${getImageFileExtension(item.mimeType)}`}
                              href={item.imageUrl}
                              title="下载图片"
                            >
                              <Download className="size-4" />
                            </a>
                            <button
                              aria-label="删除本地记录"
                              className="flex size-8 items-center justify-center rounded-md border border-[#d9dfdc] bg-[#fffefa] text-[#929b98] hover:border-[#e8c9c0] hover:bg-[#fff4f1] hover:text-[#a14e43]"
                              onClick={() => void handleDeleteHistoryItem(item)}
                              title="删除本地记录"
                              type="button"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
        </div>
      </main>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPreviewHistoryId(null)
          }
        }}
        open={previewHistoryItem !== null}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden rounded-xl border-[#dfe3e1] bg-[#fffefa] p-0 shadow-[0_18px_60px_rgba(39,53,58,0.16)] sm:max-w-5xl">
          <DialogHeader className="border-b border-[#e3e6e4] bg-[#fbfaf7] px-5 py-4 pr-12 sm:px-6">
            <DialogTitle className="text-base text-[#27353a]">图片预览</DialogTitle>
            <DialogDescription className="text-xs text-[#929b98]">查看本地历史中的原始生成结果。</DialogDescription>
          </DialogHeader>

          {previewHistoryItem ? (
            <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex min-h-72 items-center justify-center bg-[#f7f8f6] p-4 sm:p-6">
                <img
                  alt={previewHistoryItem.prompt || "生成图片预览"}
                  className="max-h-[calc(100dvh-13rem)] max-w-full object-contain"
                  src={previewHistoryItem.imageUrl}
                />
              </div>

              <div className="border-t border-[#e3e6e4] bg-[#fffefa] px-5 py-5 lg:border-l lg:border-t-0 lg:px-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#a37b4f]">提示词</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#53615e]">
                  {previewHistoryItem.prompt}
                </p>

                <dl className="mt-6 grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-t border-[#edf0ee] pt-5 text-xs">
                  <dt className="text-[#929b98]">风格</dt>
                  <dd className="text-[#53615e]">{previewHistoryItem.styleLabel || "自动"}</dd>
                  <dt className="text-[#929b98]">模型</dt>
                  <dd className="break-all text-[#53615e]">{previewHistoryItem.model}</dd>
                  <dt className="text-[#929b98]">尺寸</dt>
                  <dd className="text-[#53615e]">{previewHistoryItem.size}</dd>
                  <dt className="text-[#929b98]">图片质量</dt>
                  <dd className="text-[#53615e]">{previewHistoryItem.quality || "未记录"}</dd>
                  <dt className="text-[#929b98]">思考强度</dt>
                  <dd className="text-[#53615e]">{previewHistoryItem.reasoningEffort || "不适用"}</dd>
                  <dt className="text-[#929b98]">耗时</dt>
                  <dd className="text-[#53615e]">{formatGenerationDuration(previewHistoryItem.durationMs)}</dd>
                  <dt className="text-[#929b98]">生成时间</dt>
                  <dd className="text-[#53615e]">{formatDateTime(previewHistoryItem.createdAtMs)}</dd>
                </dl>

                <Button
                  asChild
                  className="mt-6 w-full !bg-[#27353a] !text-white hover:!bg-[#35484c]"
                  size="lg"
                >
                  <a
                    download={`generated-image-${previewHistoryItem.id}.${getImageFileExtension(previewHistoryItem.mimeType)}`}
                    href={previewHistoryItem.imageUrl}
                  >
                    <Download className="size-4" />
                    下载图片
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
