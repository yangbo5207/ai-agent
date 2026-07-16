"use client"

const storageKey = "web:local-image-generation-config"
const localImageGenerationConfigChangedEventName = "web-local-image-generation-config-changed"

export type ImageGenerationProviderApi = "images_generations" | "responses"
export type ImageGenerationQuality = "low" | "medium" | "high"
export type ImageGenerationReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh"

export type LocalImageGenerationConfig = {
  enabled: boolean
  providerName: string
  baseURL: string
  model: string
  apiKey: string
  actorAuthorization: string
  providerApi: ImageGenerationProviderApi
  reasoningEffort: ImageGenerationReasoningEffort
  size: string
  quality: ImageGenerationQuality
  background: string
  outputFormat: string
  updatedAtMs: number
}

function canUseStorage() {
  return typeof window !== "undefined"
}

function notifyLocalImageGenerationConfigChanged() {
  if (canUseStorage()) {
    window.dispatchEvent(new Event(localImageGenerationConfigChangedEventName))
  }
}

function normalizeProviderApi(value: string | undefined): ImageGenerationProviderApi {
  return value === "responses" ? "responses" : "images_generations"
}

function normalizeQuality(value: string | undefined): ImageGenerationQuality {
  return value === "medium" || value === "high" ? value : "low"
}

function normalizeReasoningEffort(value: string | undefined): ImageGenerationReasoningEffort {
  if (value === "none" || value === "low" || value === "medium" || value === "xhigh") {
    return value
  }

  return "high"
}

export function isDirectGptImageModel(model: string) {
  return /^gpt-image-/i.test(model.trim())
}

export function isGptImage2Model(model: string) {
  return /^gpt-image-2(?:$|-)/i.test(model.trim())
}

export function isApiClubImageProvider(baseURL: string) {
  try {
    const hostname = new URL(baseURL).hostname.toLowerCase()

    return hostname === "apiclub.cc" || hostname.endsWith(".apiclub.cc")
  } catch {
    return false
  }
}

export function normalizeLocalImageGenerationConfig(input: LocalImageGenerationConfig): LocalImageGenerationConfig {
  const baseURL = input.baseURL?.trim().replace(/\/$/, "") || ""
  const usesApiClub = isApiClubImageProvider(baseURL)
  const model = usesApiClub ? "gpt-5.5" : input.model?.trim() || "gpt-image-2"
  const usesDirectImageApi = isDirectGptImageModel(model)
  const usesGptImage2 = isGptImage2Model(model)

  return {
    enabled: Boolean(input.enabled),
    providerName: usesApiClub ? "OpenAI" : input.providerName?.trim() || "GPT Image 2",
    baseURL,
    model,
    apiKey: input.apiKey?.trim() || "",
    actorAuthorization: input.actorAuthorization?.trim()
      || (usesApiClub ? "local-image-extension" : ""),
    providerApi: usesApiClub
      ? "responses"
      : usesDirectImageApi
        ? "images_generations"
        : normalizeProviderApi(input.providerApi),
    reasoningEffort: normalizeReasoningEffort(input.reasoningEffort),
    size: input.size?.trim() || "1024x1024",
    quality: normalizeQuality(input.quality),
    background: (usesApiClub || usesGptImage2) && input.background === "transparent"
      ? "opaque"
      : input.background?.trim() || "auto",
    outputFormat: usesApiClub || usesGptImage2 ? "jpeg" : input.outputFormat?.trim() || "png",
    updatedAtMs: input.updatedAtMs || Date.now(),
  }
}

export function createDefaultImageGenerationConfig(): LocalImageGenerationConfig {
  return {
    enabled: true,
    providerName: "OpenAI",
    baseURL: "https://apiclub.cc",
    model: "gpt-5.5",
    apiKey: "",
    actorAuthorization: "local-image-extension",
    providerApi: "responses",
    reasoningEffort: "high",
    size: "1024x1024",
    quality: "low",
    background: "auto",
    outputFormat: "jpeg",
    updatedAtMs: Date.now(),
  }
}

export function readLocalImageGenerationConfig(): LocalImageGenerationConfig {
  if (!canUseStorage()) {
    return createDefaultImageGenerationConfig()
  }

  const rawValue = window.localStorage.getItem(storageKey)

  if (!rawValue) {
    return createDefaultImageGenerationConfig()
  }

  try {
    return normalizeLocalImageGenerationConfig(JSON.parse(rawValue) as LocalImageGenerationConfig)
  } catch {
    window.localStorage.removeItem(storageKey)
    return createDefaultImageGenerationConfig()
  }
}

export function saveLocalImageGenerationConfig(input: LocalImageGenerationConfig) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(normalizeLocalImageGenerationConfig({
    ...input,
    updatedAtMs: Date.now(),
  })))
  notifyLocalImageGenerationConfigChanged()
}

export function clearLocalImageGenerationConfig() {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(storageKey)
  notifyLocalImageGenerationConfigChanged()
}

export { localImageGenerationConfigChangedEventName }
