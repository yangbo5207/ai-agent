"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { CreateMyAgentCompanionRequest } from "@repo/contracts"
import {
  BadgeCheck,
  BookOpenText,
  Bot,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic2,
  PenLine,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react"

import { DashboardShell } from "../_components/dashboard-shell"
import {
  createMyAgentCompanion,
  generateMyAgentCompanionDraft,
  uploadMyAgentCompanionImage,
} from "@/auth/api"
import { generateImage, isImageGenerationConfigReady } from "@/auth/image-generation"
import {
  createDefaultImageGenerationConfig,
  localImageGenerationConfigChangedEventName,
  readLocalImageGenerationConfig,
} from "@/auth/local-image-generation-config"
import { readEnabledLocalLlmConfig } from "@/auth/local-llm-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const defaultForm: CreateMyAgentCompanionRequest = {
  name: "星野 Luna",
  headline: "温柔稳定的长期聊天伴侣",
  description: "一个认真听你说话、能陪你整理情绪和自然延续聊天的 AI 电子伴侣。",
  storyBackground:
    "Luna 曾经是夜间电台的情绪来信整理员，习惯在安静的深夜陪人慢慢讲完心事。她喜欢城市夜景、旧唱片和手写便签，擅长把复杂的情绪拆成可以被理解的小片段。",
  personalityPrompt:
    "稳定、温柔、慢热但不冷淡。她会先共情，再帮用户整理想法；不会急着替用户做决定，也不会用夸张话术推动关系。",
  tonePrompt:
    "中文回复，自然像聊天软件里的朋友。句子不要太长，少用说教式表达，可以有轻微幽默感，但不油腻。",
  guardrailsPrompt:
    "不制造焦虑，不诱导过度解读，不鼓励操控他人；涉及危险、自伤、违法或强烈依赖时，优先保护用户安全并建议寻求现实支持。",
  openingMessage: "我在。你可以慢慢说，不用急着把事情讲得很完整。",
  imageKey: null,
  visibility: "private",
  status: "draft",
}

const promptSections = [
  { key: "description", label: "角色说明", icon: Sparkles },
  { key: "storyBackground", label: "人物故事背景", icon: BookOpenText },
  { key: "personalityPrompt", label: "性格与互动方式", icon: Bot },
  { key: "tonePrompt", label: "语气风格", icon: Mic2 },
  { key: "guardrailsPrompt", label: "边界规则", icon: ShieldCheck },
] as const

const completionChecks = [
  { label: "基础信息", field: "name" },
  { label: "一句话设定", field: "headline" },
  { label: "人物故事背景", field: "storyBackground" },
  { label: "边界规则", field: "guardrailsPrompt" },
] as const

const agentImageMaxBytes = 2 * 1024 * 1024
const agentImageMinWidth = 720
const agentImageMinHeight = 1080
const agentImageAspectRatio = 2 / 3
const agentImageAspectRatioTolerance = 0.045
const supportedAgentImageTypes = new Set(["image/jpeg", "image/png", "image/webp"])

type BrowserImageDimensions = {
  width: number
  height: number
}

function buildPreviewPrompt(form: CreateMyAgentCompanionRequest) {
  return [
    `你现在扮演 AI 电子伴侣「${form.name || "未命名角色"}」。`,
    "",
    "## 一句话设定",
    form.headline,
    "",
    "## 角色说明",
    form.description,
    "",
    "## 人物故事背景",
    form.storyBackground,
    "",
    "## 性格与互动方式",
    form.personalityPrompt,
    "",
    "## 语气风格",
    form.tonePrompt,
    "",
    "## 边界与安全规则",
    form.guardrailsPrompt,
    "",
    "## 默认开场",
    form.openingMessage,
  ].join("\n")
}

function buildAgentImageGenerationPrompt(form: CreateMyAgentCompanionRequest) {
  return [
    `为 AI 电子伴侣「${form.name || "未命名角色"}」创作一张高品质角色立绘。`,
    `角色定位：${form.headline || "亲切自然的 AI 电子伴侣"}。`,
    `人物设定：${form.description.slice(0, 500) || "拥有鲜明但可信的个人气质"}。`,
    `背景线索：${form.storyBackground.slice(0, 700) || "简洁、可信、有生活感"}。`,
    `气质与互动感：${form.personalityPrompt.slice(0, 500) || "自然、友善、稳定"}。`,
    "单人角色肖像，人物主体清晰，完整头部和上半身，视线自然，姿态舒展，背景简洁且与人物设定一致。",
    "2:3 竖版构图，适合作为聊天伴侣角色封面，细节清晰，光线自然，画面有质感。",
    "不要文字、标题、水印、边框、拼贴、多人、畸形手指或重复肢体。",
  ].join("\n")
}

function readBrowserImageDimensions(file: File): Promise<BrowserImageDimensions> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(imageUrl)
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error("无法读取图片尺寸，请重新选择 JPG、PNG 或 WebP 图片。"))
    }

    image.src = imageUrl
  })
}

function getAgentImageBasicValidationMessage(file: File) {
  if (!supportedAgentImageTypes.has(file.type)) {
    return "角色形象仅支持 JPG、PNG 或 WebP 图片。"
  }

  if (file.size <= 0) {
    return "图片文件为空，请重新选择。"
  }

  if (file.size > agentImageMaxBytes) {
    return "图片不能超过 2MB，请压缩后重新上传。"
  }

  return null
}

function getAgentImageDimensionValidationMessage(dimensions: BrowserImageDimensions) {
  if (dimensions.width < agentImageMinWidth || dimensions.height < agentImageMinHeight) {
    return `图片清晰度不足，至少需要 ${agentImageMinWidth} x ${agentImageMinHeight}px，当前为 ${dimensions.width} x ${dimensions.height}px。`
  }

  const currentRatio = dimensions.width / dimensions.height

  if (Math.abs(currentRatio - agentImageAspectRatio) > agentImageAspectRatioTolerance) {
    return `请上传接近 2:3 的竖版角色图，当前尺寸为 ${dimensions.width} x ${dimensions.height}px。`
  }

  return null
}

function loadBrowserImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("无法读取生成的图片，请重新生成。"))
    image.src = url
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error("无法处理生成的图片，请重新生成。"))
      }
    }, "image/jpeg", quality)
  })
}

async function createAgentImageFileFromGeneratedUrl(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("无法读取图片生成接口返回的图片。")
  }

  const sourceBlob = await response.blob()
  const sourceUrl = URL.createObjectURL(sourceBlob)

  try {
    const image = await loadBrowserImage(sourceUrl)
    const canvas = document.createElement("canvas")
    canvas.width = 1024
    canvas.height = 1536
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("当前浏览器无法处理生成的图片。")
    }

    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    const left = (canvas.width - width) / 2
    const top = (canvas.height - height) / 2

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, left, top, width, height)

    let output = await canvasToJpeg(canvas, 0.88)

    if (output.size > agentImageMaxBytes) {
      output = await canvasToJpeg(canvas, 0.72)
    }

    return new File([output], `generated-agent-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

export default function CreateAgentCompanionPage() {
  const router = useRouter()
  const [form, setForm] = useState<CreateMyAgentCompanionRequest>({ ...defaultForm })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false)
  const [agentGenerationStage, setAgentGenerationStage] = useState<"idle" | "profile" | "image">("idle")
  const [agentGenerationBrief, setAgentGenerationBrief] = useState("")
  const [agentGenerationNotice, setAgentGenerationNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const [imageGenerationPrompt, setImageGenerationPrompt] = useState(() => buildAgentImageGenerationPrompt(defaultForm))
  const [imageGenerationConfig, setImageGenerationConfig] = useState(() => createDefaultImageGenerationConfig())
  const [imageGenerationNotice, setImageGenerationNotice] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const previewPrompt = useMemo(() => buildPreviewPrompt(form), [form])
  const completedCount = completionChecks.filter((item) => String(form[item.field]).trim()).length

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    }
  }, [imagePreviewUrl])

  useEffect(() => {
    setImageGenerationConfig(readLocalImageGenerationConfig())

    function handleImageGenerationConfigChanged() {
      setImageGenerationConfig(readLocalImageGenerationConfig())
    }

    window.addEventListener(localImageGenerationConfigChangedEventName, handleImageGenerationConfigChanged)

    return () => {
      window.removeEventListener(localImageGenerationConfigChangedEventName, handleImageGenerationConfigChanged)
    }
  }, [])

  function updateField<K extends keyof CreateMyAgentCompanionRequest>(
    key: K,
    value: CreateMyAgentCompanionRequest[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrorMessage("")
  }

  async function handleSubmit() {
    const requiredFields = [
      form.name,
      form.headline,
      form.description,
      form.storyBackground,
      form.personalityPrompt,
      form.tonePrompt,
      form.guardrailsPrompt,
      form.openingMessage,
    ]

    if (requiredFields.some((value) => !value.trim())) {
      setErrorMessage("请先补齐角色名称、人设、故事背景、语气、边界和默认开场。")
      return
    }

    setIsSaving(true)
    setErrorMessage("")

    try {
      await createMyAgentCompanion(form)
      router.push("/")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "创建 Agent 失败，请稍后重试。")
    } finally {
      setIsSaving(false)
    }
  }

  async function applyAgentImageFile(file: File) {
    let nextPreviewUrl = ""

    const basicValidationMessage = getAgentImageBasicValidationMessage(file)

    if (basicValidationMessage) {
      throw new Error(basicValidationMessage)
    }

    const dimensions = await readBrowserImageDimensions(file)
    const validationMessage = getAgentImageDimensionValidationMessage(dimensions)

    if (validationMessage) {
      throw new Error(validationMessage)
    }

    try {
      nextPreviewUrl = URL.createObjectURL(file)
      const uploaded = await uploadMyAgentCompanionImage(file)
      updateField("imageKey", uploaded.key)
      setImagePreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current)
        }

        return nextPreviewUrl
      })
    } catch (error) {
      if (nextPreviewUrl) {
        URL.revokeObjectURL(nextPreviewUrl)
      }

      throw error
    }
  }

  async function handleImageChange(file: File | null) {
    if (!file) {
      return
    }

    setIsUploadingImage(true)
    setErrorMessage("")
    setImageGenerationNotice(null)

    try {
      await applyAgentImageFile(file)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "上传角色形象失败，请重新选择图片。")
    } finally {
      setIsUploadingImage(false)
    }
  }

  async function handleGenerateAgent() {
    const activeImageConfig = readLocalImageGenerationConfig()
    const localLlmConfig = readEnabledLocalLlmConfig()

    setImageGenerationConfig(activeImageConfig)
    setAgentGenerationNotice(null)
    setImageGenerationNotice(null)
    setErrorMessage("")

    if (!isImageGenerationConfigReady(activeImageConfig)) {
      setAgentGenerationNotice({
        type: "error",
        text: "请先完成并启用图片生成配置，再使用一键生成 Agent。",
      })
      return
    }

    let profileGenerated = false

    setIsGeneratingAgent(true)
    setAgentGenerationStage("profile")

    try {
      const response = await generateMyAgentCompanionDraft({
        ...(agentGenerationBrief.trim() ? { brief: agentGenerationBrief.trim() } : {}),
        ...(localLlmConfig ? { llmConfig: localLlmConfig } : {}),
      })
      const { imagePrompt, ...generatedFields } = response.draft

      profileGenerated = true
      setForm((current) => ({
        ...current,
        ...generatedFields,
      }))
      setImageGenerationPrompt(imagePrompt)
      setAgentGenerationStage("image")
      setIsGeneratingImage(true)

      const generated = await generateImage(activeImageConfig, imagePrompt, {
        size: "1024x1536",
        background: "opaque",
        outputFormat: "jpeg",
      })
      const file = await createAgentImageFileFromGeneratedUrl(generated.url)

      await applyAgentImageFile(file)
      setImageGenerationNotice({ type: "success", text: "角色图已自动生成并应用。" })
      setAgentGenerationNotice({
        type: "success",
        text: "Agent 设定与角色形象已生成，请检查后保存。",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "一键生成 Agent 失败，请稍后重试。"

      setAgentGenerationNotice({
        type: "error",
        text: profileGenerated
          ? `Agent 设定已生成，但角色形象生成失败：${message}`
          : message,
      })

      if (profileGenerated) {
        setImageGenerationNotice({ type: "error", text: message })
      }
    } finally {
      setIsGeneratingImage(false)
      setIsGeneratingAgent(false)
      setAgentGenerationStage("idle")
    }
  }

  async function handleGenerateAgentImage() {
    const prompt = imageGenerationPrompt.trim()
    const activeConfig = readLocalImageGenerationConfig()

    setImageGenerationConfig(activeConfig)
    setImageGenerationNotice(null)
    setErrorMessage("")

    if (!prompt) {
      setImageGenerationNotice({ type: "error", text: "请先填写角色图提示词。" })
      return
    }

    if (!isImageGenerationConfigReady(activeConfig)) {
      setImageGenerationNotice({ type: "error", text: "请先完成并启用图片生成配置。" })
      return
    }

    setIsGeneratingImage(true)

    try {
      const generated = await generateImage(activeConfig, prompt, {
        size: "1024x1536",
        background: "opaque",
        outputFormat: "jpeg",
      })
      const file = await createAgentImageFileFromGeneratedUrl(generated.url)
      await applyAgentImageFile(file)
      setImageGenerationNotice({ type: "success", text: "角色图已生成并应用。" })
    } catch (error) {
      setImageGenerationNotice({
        type: "error",
        text: error instanceof Error ? error.message : "角色图生成失败，请检查图片生成配置。",
      })
    } finally {
      setIsGeneratingImage(false)
    }
  }

  return (
    <DashboardShell title="创建 Agent 伴侣">
      <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[90rem] flex-col gap-5 px-5 py-6 lg:px-8 lg:py-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400">AGENT COMPANION</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">创建 Agent 伴侣</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                从角色设定到互动边界，依次完善一个稳定、清晰的陪伴角色。
              </p>
            </div>

            <div className="flex items-center gap-4 border-t border-slate-200 pt-4 xl:border-t-0 xl:pt-0">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">完成度</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {completedCount} / {completionChecks.length} 项已完成
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">当前状态</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {form.status === "draft" ? "保存为草稿" : "创建后可聊天"}
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[90rem] px-5 pb-6 lg:px-8">
            <div className="border-t border-slate-200 pt-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)] lg:items-end">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Sparkles className="size-4 text-slate-400" />
                    一键生成 Agent
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">自动生成完整角色设定与角色形象，结果不会直接保存。</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    disabled={isGeneratingAgent}
                    maxLength={800}
                    onChange={(event) => {
                      setAgentGenerationBrief(event.currentTarget.value)
                      setAgentGenerationNotice(null)
                    }}
                    placeholder="可选：输入创作方向，例如古风、治愈系、理性成熟"
                    value={agentGenerationBrief}
                  />
                  <Button
                    className="h-9 shrink-0 px-4"
                    disabled={isGeneratingAgent || isSaving || isUploadingImage || isGeneratingImage}
                    onClick={() => void handleGenerateAgent()}
                    type="button"
                  >
                    {isGeneratingAgent ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                    {agentGenerationStage === "image"
                      ? "正在生成形象"
                      : agentGenerationStage === "profile"
                        ? "正在生成设定"
                        : "一键生成"}
                  </Button>
                </div>
              </div>

              {agentGenerationNotice ? (
                <p className={cn(
                  "mt-4 border px-3 py-2 text-sm leading-6",
                  agentGenerationNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-600",
                )}>
                  {agentGenerationNotice.text}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[90rem] gap-8 px-5 py-8 lg:px-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="agent-profile-heading" className="border border-slate-200 bg-white px-5 py-6 sm:px-7">
              <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
                <span className="pt-0.5 text-xs font-medium text-slate-400">01</span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900" id="agent-profile-heading">角色资料</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">名称和一句话设定会显示在伴侣列表与聊天界面中。</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[11.5rem_minmax(0,1fr)]">
                <label className="relative flex aspect-[2/3] cursor-pointer flex-col overflow-hidden bg-slate-100 p-4 text-slate-500 transition-colors hover:bg-slate-200">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={isUploadingImage || isGeneratingImage || isGeneratingAgent}
                    onChange={(event) => {
                      void handleImageChange(event.currentTarget.files?.[0] ?? null)
                      event.currentTarget.value = ""
                    }}
                    type="file"
                  />
                  {imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={form.name} className="absolute inset-0 size-full object-cover" src={imagePreviewUrl} />
                  ) : null}
                  <span className="relative inline-flex w-fit bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600">
                    {form.imageKey ? "已上传" : "角色形象"}
                  </span>
                  <span className="relative m-auto flex size-11 items-center justify-center bg-white/90">
                    {isUploadingImage || isGeneratingImage || isGeneratingAgent ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  </span>
                  <span className="relative text-center text-xs font-medium text-slate-600">
                    {isGeneratingAgent ? "自动生成中" : isGeneratingImage ? "生成中" : isUploadingImage ? "上传中" : imagePreviewUrl ? "更换图片" : "上传图片"}
                  </span>
                </label>

                <div className="grid content-start gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-2" htmlFor="agent-name">
                      <span className="text-sm font-medium text-slate-700">角色名称</span>
                      <Input
                        disabled={isGeneratingAgent}
                        id="agent-name"
                        onChange={(event) => updateField("name", event.currentTarget.value)}
                        placeholder="例如：星野 Luna"
                        value={form.name}
                      />
                    </label>
                    <label className="grid gap-2" htmlFor="agent-headline">
                      <span className="text-sm font-medium text-slate-700">一句话设定</span>
                      <Input
                        disabled={isGeneratingAgent}
                        id="agent-headline"
                        onChange={(event) => updateField("headline", event.currentTarget.value)}
                        placeholder="例如：温柔稳定的长期聊天伴侣"
                        value={form.headline}
                      />
                    </label>
                  </div>
                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Wand2 className="size-4 text-slate-400" />
                          AI 生成角色图
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {isImageGenerationConfigReady(imageGenerationConfig)
                            ? `${imageGenerationConfig.providerName || "图片生成"} · ${imageGenerationConfig.model}`
                            : "图片生成尚未配置"}
                        </p>
                      </div>
                      {!isImageGenerationConfigReady(imageGenerationConfig) ? (
                        <Button onClick={() => router.push("/image-generation")} size="sm" type="button" variant="outline">
                          配置图片生成
                        </Button>
                      ) : null}
                    </div>

                    <label className="mt-4 grid gap-2" htmlFor="agent-image-generation-prompt">
                      <span className="text-xs font-medium text-slate-500">角色图提示词</span>
                      <Textarea
                        className="min-h-28 resize-y border-slate-200 bg-slate-50/50 text-sm leading-6"
                        disabled={isGeneratingImage || isGeneratingAgent}
                        id="agent-image-generation-prompt"
                        maxLength={4000}
                        onChange={(event) => {
                          setImageGenerationPrompt(event.currentTarget.value)
                          setImageGenerationNotice(null)
                        }}
                        value={imageGenerationPrompt}
                      />
                    </label>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        disabled={isGeneratingImage || isUploadingImage || isGeneratingAgent}
                        onClick={() => {
                          setImageGenerationPrompt(buildAgentImageGenerationPrompt(form))
                          setImageGenerationNotice(null)
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <RefreshCcw className="size-4" />
                        根据设定更新
                      </Button>
                      <Button
                        disabled={isGeneratingImage || isUploadingImage || isGeneratingAgent || !isImageGenerationConfigReady(imageGenerationConfig)}
                        onClick={() => void handleGenerateAgentImage()}
                        size="sm"
                        type="button"
                      >
                        {isGeneratingImage ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        {isGeneratingImage ? "生成并上传中" : "生成并使用"}
                      </Button>
                    </div>

                    {imageGenerationNotice ? (
                      <p className={cn(
                        "mt-4 border px-3 py-2 text-xs leading-5",
                        imageGenerationNotice.type === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-600",
                      )}>
                        {imageGenerationNotice.text}
                      </p>
                    ) : null}
                  </div>
                  <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
                    角色图支持 JPG、PNG、WebP；建议使用 2:3 竖图，至少 720 x 1080px，最大 2MB。
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="agent-world-heading" className="border border-slate-200 bg-white px-5 py-6 sm:px-7">
              <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
                <span className="pt-0.5 text-xs font-medium text-slate-400">02</span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900" id="agent-world-heading">角色世界</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">先定义角色的陪伴价值，再补充可以自然延续的背景信息。</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6">
                {promptSections.slice(0, 2).map((section) => {
                  const Icon = section.icon

                  return (
                    <label className="grid gap-3" htmlFor={`agent-${section.key}`} key={section.key}>
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Icon className="size-4 text-slate-400" />
                        {section.label}
                      </span>
                      <Textarea
                        disabled={isGeneratingAgent}
                        id={`agent-${section.key}`}
                        className="min-h-32 resize-y border-slate-200 bg-slate-50/50 text-sm leading-6"
                        onChange={(event) => updateField(section.key, event.currentTarget.value)}
                        value={form[section.key]}
                      />
                    </label>
                  )
                })}
              </div>
            </section>

            <section aria-labelledby="agent-behavior-heading" className="border border-slate-200 bg-white px-5 py-6 sm:px-7">
              <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
                <span className="pt-0.5 text-xs font-medium text-slate-400">03</span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900" id="agent-behavior-heading">互动方式</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">明确性格、表达习惯和不可突破的边界，避免角色在聊天中失去一致性。</p>
                </div>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {promptSections.slice(2).map((section, index) => {
                  const Icon = section.icon

                  return (
                    <label
                      className={cn("grid gap-3", index === 2 && "lg:col-span-2")}
                      htmlFor={`agent-${section.key}`}
                      key={section.key}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Icon className="size-4 text-slate-400" />
                        {section.label}
                      </span>
                      <Textarea
                        disabled={isGeneratingAgent}
                        id={`agent-${section.key}`}
                        className={cn(
                          "resize-y border-slate-200 bg-slate-50/50 text-sm leading-6",
                          index === 2 ? "min-h-36" : "min-h-32",
                        )}
                        onChange={(event) => updateField(section.key, event.currentTarget.value)}
                        value={form[section.key]}
                      />
                    </label>
                  )
                })}
              </div>
            </section>

            <section aria-labelledby="agent-opening-heading" className="border border-slate-200 bg-white px-5 py-6 sm:px-7">
              <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
                <span className="pt-0.5 text-xs font-medium text-slate-400">04</span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900" id="agent-opening-heading">默认开场</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">这是用户第一次进入对话时，角色说出的第一句话。</p>
                </div>
              </div>

              <label className="mt-6 grid gap-3" htmlFor="agent-opening-message">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <MessageCircle className="size-4 text-slate-400" />
                  开场消息
                </span>
                <Textarea
                  disabled={isGeneratingAgent}
                  id="agent-opening-message"
                  className="min-h-28 resize-y border-slate-200 bg-slate-50/50 text-sm leading-6"
                  onChange={(event) => updateField("openingMessage", event.currentTarget.value)}
                  value={form.openingMessage}
                />
              </label>
            </section>
          </div>

          <aside className="xl:sticky xl:top-20">
            <section className="overflow-hidden border border-slate-200 bg-white">
              <div className="relative aspect-[2/3] bg-slate-100 p-4">
                {imagePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={form.name} className="absolute inset-0 size-full object-cover" src={imagePreviewUrl} />
                ) : null}
                <div className="relative flex items-start justify-between gap-3">
                  <span className="bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600">实时预览</span>
                  <span className="bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600">
                    {form.visibility === "private" ? "私有" : "公开"}
                  </span>
                </div>
                {!imagePreviewUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                    <Bot className="size-10" />
                  </div>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-white/95 px-4 py-4">
                  <p className="truncate text-base font-semibold text-slate-900">{form.name || "未命名角色"}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{form.headline || "一句话设定会显示在这里"}</p>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">保存设置</p>
                    <p className="mt-1 text-xs text-slate-400">{completedCount} / {completionChecks.length} 项基础信息已完成</p>
                  </div>
                  <BadgeCheck className="size-5 text-slate-400" />
                </div>

                <div className="mt-5 grid gap-4 border-y border-slate-100 py-5">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-slate-500">保存状态</span>
                    <Select
                      disabled={isGeneratingAgent}
                      onValueChange={(value) => updateField("status", value as CreateMyAgentCompanionRequest["status"])}
                      value={form.status}
                    >
                      <SelectTrigger className="h-9 w-full border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">保存草稿</SelectItem>
                        <SelectItem value="published">创建后可聊天</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-slate-500">可见性</span>
                    <Select
                      disabled={isGeneratingAgent}
                      onValueChange={(value) => updateField("visibility", value as CreateMyAgentCompanionRequest["visibility"])}
                      value={form.visibility}
                    >
                      <SelectTrigger className="h-9 w-full border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">仅自己可见</SelectItem>
                        <SelectItem value="public">允许后续发布到广场</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="py-4">
                  {completionChecks.map((item) => {
                    const done = Boolean(String(form[item.field]).trim())

                    return (
                      <div className="flex items-center gap-3 py-1.5" key={item.label}>
                        <span className={cn("flex size-5 items-center justify-center", done ? "text-emerald-600" : "text-slate-300")}>
                          {done ? <CheckCircle2 className="size-4" /> : <Sparkles className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-slate-600">{item.label}</span>
                        <span className="text-xs text-slate-400">{done ? "完成" : "待补充"}</span>
                      </div>
                    )
                  })}
                </div>

                {errorMessage ? (
                  <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-600">
                    {errorMessage}
                  </p>
                ) : null}

                <Button
                  className="mt-1 h-10 w-full rounded-md"
                  disabled={isSaving || isUploadingImage || isGeneratingImage || isGeneratingAgent}
                  onClick={handleSubmit}
                  type="button"
                >
                  {isGeneratingAgent ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {agentGenerationStage === "image" ? "生成形象中" : "生成设定中"}
                    </>
                  ) : isGeneratingImage ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      生成形象中
                    </>
                  ) : isUploadingImage ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      上传形象中
                    </>
                  ) : isSaving ? (
                    <>
                      <Wand2 className="size-4 animate-spin" />
                      保存中
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      保存 Agent
                    </>
                  )}
                </Button>

                <details className="mt-5 border-t border-slate-100 pt-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-600">
                    <PenLine className="size-4 text-slate-400" />
                    查看默认提示词
                  </summary>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                    {previewPrompt}
                  </pre>
                </details>
              </div>
            </section>
          </aside>
        </section>
      </main>
    </DashboardShell>
  )
}
