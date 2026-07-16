import { z } from 'zod'

export const ImageGenerationProviderApiSchema = z.enum(['images_generations', 'responses'])
export const ImageGenerationReasoningEffortSchema = z.enum(['none', 'low', 'medium', 'high', 'xhigh'])

export const ImageGenerationProxyConfigSchema = z.object({
  providerName: z.string().trim().min(1).max(80).optional(),
  baseURL: z.string().trim().url().max(300),
  apiKey: z.string().trim().min(1).max(400),
  actorAuthorization: z.string().trim().min(1).max(200).optional(),
  model: z.string().trim().min(1).max(120),
  providerApi: ImageGenerationProviderApiSchema,
  reasoningEffort: ImageGenerationReasoningEffortSchema.optional(),
  size: z.string().trim().min(1).max(40),
  quality: z.string().trim().min(1).max(40),
  background: z.string().trim().min(1).max(40),
  outputFormat: z.string().trim().min(1).max(20),
})

export const ImageGenerationProxyRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  config: ImageGenerationProxyConfigSchema,
})

export const ImageGenerationProxyResponseSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().min(1),
})

export const ImageGenerationUploadResponseSchema = z.object({
  key: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  uploadedAtMs: z.number().int().nonnegative(),
})

export type ImageGenerationProviderApi = z.infer<typeof ImageGenerationProviderApiSchema>
export type ImageGenerationReasoningEffort = z.infer<typeof ImageGenerationReasoningEffortSchema>
export type ImageGenerationProxyConfig = z.infer<typeof ImageGenerationProxyConfigSchema>
export type ImageGenerationProxyRequest = z.infer<typeof ImageGenerationProxyRequestSchema>
export type ImageGenerationProxyResponse = z.infer<typeof ImageGenerationProxyResponseSchema>
export type ImageGenerationUploadResponse = z.infer<typeof ImageGenerationUploadResponseSchema>
