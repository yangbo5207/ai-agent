import { z } from 'zod'

export const LlmConnectionWireApiSchema = z.enum(['chat_completions', 'responses'])

export const LlmTestConnectionRequestSchema = z.object({
  config: z.object({
    baseURL: z.string().trim().url().max(300),
    apiKey: z.string().trim().min(1).max(400),
    model: z.string().trim().min(1).max(120),
    wireApi: LlmConnectionWireApiSchema,
    reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  }),
})

export const LlmTestConnectionResponseSchema = z.object({
  protocol: LlmConnectionWireApiSchema,
  latencyMs: z.number().int().nonnegative(),
  upstreamStatus: z.number().int().positive(),
})

export type LlmConnectionWireApi = z.infer<typeof LlmConnectionWireApiSchema>
export type LlmTestConnectionRequest = z.infer<typeof LlmTestConnectionRequestSchema>
export type LlmTestConnectionResponse = z.infer<typeof LlmTestConnectionResponseSchema>
