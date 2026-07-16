import type {
  ImageGenerationProxyRequest,
  ImageGenerationProxyResponse,
  ImageGenerationUploadResponse,
} from "@repo/contracts"

import {
  normalizeLocalImageGenerationConfig,
  type LocalImageGenerationConfig,
} from "./local-image-generation-config"
import { http } from "@/lib/http"

export type GeneratedImageResult = {
  url: string
  mimeType: string
}

function buildImageUrl(value: string, mimeType = "image/png") {
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value
  }

  return `data:${mimeType};base64,${value}`
}

export function isImageGenerationConfigReady(config: LocalImageGenerationConfig) {
  return Boolean(
    config.enabled
    && config.baseURL.trim()
    && config.model.trim()
    && config.apiKey.trim(),
  )
}

export async function generateImage(
  config: LocalImageGenerationConfig,
  prompt: string,
  overrides: Partial<Pick<LocalImageGenerationConfig, "size" | "quality" | "background" | "outputFormat">> = {},
): Promise<GeneratedImageResult> {
  const activeConfig = normalizeLocalImageGenerationConfig({ ...config, ...overrides })
  const proxyConfig: ImageGenerationProxyRequest["config"] = {
    baseURL: activeConfig.baseURL.trim(),
    apiKey: activeConfig.apiKey.trim(),
    ...(activeConfig.actorAuthorization.trim()
      ? { actorAuthorization: activeConfig.actorAuthorization.trim() }
      : {}),
    model: activeConfig.model.trim(),
    providerApi: activeConfig.providerApi,
    ...(activeConfig.providerApi === "responses"
      ? { reasoningEffort: activeConfig.reasoningEffort }
      : {}),
    size: activeConfig.size,
    quality: activeConfig.quality,
    background: activeConfig.background,
    outputFormat: activeConfig.outputFormat,
    ...(activeConfig.providerName.trim() ? { providerName: activeConfig.providerName.trim() } : {}),
  }
  const response = await http.post<ImageGenerationProxyResponse, ImageGenerationProxyRequest>(
    "/rpc/image-generation/generate",
    { prompt, config: proxyConfig },
  )

  if (!response.image) {
    throw new Error("未能从 API 代理响应中解析到图片结果。")
  }

  return {
    url: buildImageUrl(response.image, response.mimeType),
    mimeType: response.mimeType,
  }
}

export function uploadGeneratedImage(file: File) {
  const formData = new FormData()
  formData.set("file", file)

  return http.post<ImageGenerationUploadResponse, FormData>("/rpc/image-generation/upload", formData)
}
