import { z } from 'zod'
import { InboxChatLlmConfigSchema } from '../chat/inbox-chat.contract'

export const CreateMyAgentCompanionRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  headline: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1200),
  storyBackground: z.string().trim().min(1).max(2400),
  personalityPrompt: z.string().trim().min(1).max(1600),
  tonePrompt: z.string().trim().min(1).max(1200),
  guardrailsPrompt: z.string().trim().min(1).max(1200),
  openingMessage: z.string().trim().min(1).max(800),
  imageKey: z.string().trim().min(1).max(300).nullable().optional(),
  visibility: z.enum(['private', 'public']).default('private'),
  status: z.enum(['draft', 'published']).default('draft'),
})

export const CreateMyAgentCompanionResponseSchema = z.object({
  id: z.string().min(1),
  defaultPrompt: z.string().min(1),
})

export const GeneratedMyAgentCompanionDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  headline: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  storyBackground: z.string().trim().min(1).max(1200),
  personalityPrompt: z.string().trim().min(1).max(800),
  tonePrompt: z.string().trim().min(1).max(600),
  guardrailsPrompt: z.string().trim().min(1).max(800),
  openingMessage: z.string().trim().min(1).max(300),
  imagePrompt: z.string().trim().min(1).max(1800),
})

export const GenerateMyAgentCompanionDraftRequestSchema = z.object({
  brief: z.string().trim().min(1).max(800).optional(),
  llmConfig: InboxChatLlmConfigSchema.optional(),
})

export const GenerateMyAgentCompanionDraftResponseSchema = z.object({
  draft: GeneratedMyAgentCompanionDraftSchema,
})

export const UpdateMyAgentCompanionRequestSchema = CreateMyAgentCompanionRequestSchema

export const UploadMyAgentCompanionImageResponseSchema = z.object({
  key: z.string().min(1),
  updatedAtMs: z.number().int().nonnegative(),
})

export const MyAgentCompanionDetailResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  headline: z.string().max(200).nullable(),
  description: z.string().max(1200).nullable(),
  storyBackground: z.string().max(2400).nullable(),
  personalityPrompt: z.string().max(1600).nullable(),
  tonePrompt: z.string().max(1200).nullable(),
  guardrailsPrompt: z.string().max(1200).nullable(),
  openingMessage: z.string().max(800).nullable(),
  defaultPrompt: z.string().nullable(),
  imageKey: z.string().max(300).nullable(),
  visibility: z.enum(['private', 'public']).nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  lastAssistantMessage: z.string().nullable(),
  lastAssistantMessageAtMs: z.number().int().nonnegative().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  publishedAtMs: z.number().int().nonnegative().nullable(),
  archivedAtMs: z.number().int().nonnegative().nullable(),
})

export const UpdateMyAgentCompanionResponseSchema = MyAgentCompanionDetailResponseSchema

export const AgentCareSceneSchema = z.enum([
  'morning',
  'night',
  'long_absence',
  'stress_support',
  'relationship_warmup',
  'anniversary',
])

export const AgentCareFrequencySchema = z.enum(['daily', 'weekly', 'custom'])

export const AgentCareToneSchema = z.enum(['light', 'gentle', 'intimate'])

export const AgentCarePlanSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  enabled: z.boolean(),
  frequency: AgentCareFrequencySchema,
  preferredTime: z.string().max(20).nullable(),
  scenes: z.array(AgentCareSceneSchema).min(1).max(6),
  tone: AgentCareToneSchema,
  customPrompt: z.string().max(800).nullable(),
  nextRunAtMs: z.number().int().nonnegative().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
})

export const UpsertAgentCarePlanRequestSchema = z.object({
  enabled: z.boolean(),
  frequency: AgentCareFrequencySchema,
  preferredTime: z.string().trim().max(20).optional().nullable(),
  scenes: z.array(AgentCareSceneSchema).min(1).max(6),
  tone: AgentCareToneSchema,
  customPrompt: z.string().trim().max(800).optional().nullable(),
})

export const AgentCarePlanResponseSchema = z.object({
  plan: AgentCarePlanSchema,
})

export const AgentCareEventSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  carePlanId: z.string().nullable(),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  scene: AgentCareSceneSchema,
  status: z.enum(['generated', 'read']),
  message: z.string().min(1).max(2000),
  generatedAtMs: z.number().int().nonnegative(),
  readAtMs: z.number().int().nonnegative().nullable(),
})

export const AgentCareEventsResponseSchema = z.object({
  items: z.array(AgentCareEventSchema),
})

export const GenerateAgentCareEventRequestSchema = z.object({
  scene: AgentCareSceneSchema.optional(),
})

export const GenerateAgentCareEventResponseSchema = z.object({
  event: AgentCareEventSchema,
})

export const MyAgentInboxItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  handle: z.string().min(1).max(120),
  headline: z.string().min(1).max(200),
  lastActive: z.string().min(1).max(80),
  status: z.string().min(1).max(80),
  agentStatus: z.enum(['draft', 'published', 'archived']),
  relationship: z.string().min(1).max(120),
  topic: z.string().min(1).max(120),
  chemistry: z.string().min(1).max(80),
  chemistryLabel: z.string().min(1).max(80),
  chemistryLevel: z.enum(['High', 'Normal', 'Low']),
  rhythm: z.string().min(1).max(80),
  profileNote: z.string().min(1).max(2000),
  lastAssistantMessage: z.string().nullable(),
  lastAssistantMessageAtMs: z.number().int().nonnegative().nullable(),
  unread: z.boolean(),
  pinned: z.boolean(),
  imageKey: z.string().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
})

export const MyAgentSummaryResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
})

export const MyAgentInboxResponseSchema = MyAgentSummaryResponseSchema.extend({
  items: z.array(MyAgentInboxItemSchema),
})

export const AgentMemorySchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  type: z.string().min(1).max(80),
  content: z.string().min(1).max(2000),
  importance: z.number().int().min(1).max(5),
  status: z.enum(['active', 'disabled', 'deleted']),
  sourceMessageId: z.string().nullable(),
  sourceMessage: z.object({
    id: z.string().min(1),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAtMs: z.number().int().nonnegative(),
  }).nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
})

export const MyAgentMemoriesResponseSchema = z.object({
  items: z.array(AgentMemorySchema),
})

export const UpdateAgentMemoryRequestSchema = z.object({
  type: z.string().trim().min(1).max(80).optional(),
  content: z.string().trim().min(1).max(2000).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

export const UpdateAgentMemoryResponseSchema = AgentMemorySchema

export type MyAgentInboxItem = z.infer<typeof MyAgentInboxItemSchema>
export type MyAgentCompanionDetailResponse = z.infer<typeof MyAgentCompanionDetailResponseSchema>
export type MyAgentSummaryResponse = z.infer<typeof MyAgentSummaryResponseSchema>
export type MyAgentInboxResponse = z.infer<typeof MyAgentInboxResponseSchema>
export type AgentCareScene = z.infer<typeof AgentCareSceneSchema>
export type AgentCareFrequency = z.infer<typeof AgentCareFrequencySchema>
export type AgentCareTone = z.infer<typeof AgentCareToneSchema>
export type AgentCarePlan = z.infer<typeof AgentCarePlanSchema>
export type UpsertAgentCarePlanRequest = z.infer<typeof UpsertAgentCarePlanRequestSchema>
export type AgentCarePlanResponse = z.infer<typeof AgentCarePlanResponseSchema>
export type AgentCareEvent = z.infer<typeof AgentCareEventSchema>
export type AgentCareEventsResponse = z.infer<typeof AgentCareEventsResponseSchema>
export type GenerateAgentCareEventRequest = z.infer<typeof GenerateAgentCareEventRequestSchema>
export type GenerateAgentCareEventResponse = z.infer<typeof GenerateAgentCareEventResponseSchema>
export type AgentMemory = z.infer<typeof AgentMemorySchema>
export type MyAgentMemoriesResponse = z.infer<typeof MyAgentMemoriesResponseSchema>
export type UpdateAgentMemoryRequest = z.infer<typeof UpdateAgentMemoryRequestSchema>
export type UpdateAgentMemoryResponse = z.infer<typeof UpdateAgentMemoryResponseSchema>
export type CreateMyAgentCompanionRequest = z.infer<typeof CreateMyAgentCompanionRequestSchema>
export type CreateMyAgentCompanionResponse = z.infer<typeof CreateMyAgentCompanionResponseSchema>
export type GeneratedMyAgentCompanionDraft = z.infer<typeof GeneratedMyAgentCompanionDraftSchema>
export type GenerateMyAgentCompanionDraftRequest = z.infer<typeof GenerateMyAgentCompanionDraftRequestSchema>
export type GenerateMyAgentCompanionDraftResponse = z.infer<typeof GenerateMyAgentCompanionDraftResponseSchema>
export type UpdateMyAgentCompanionRequest = z.infer<typeof UpdateMyAgentCompanionRequestSchema>
export type UpdateMyAgentCompanionResponse = z.infer<typeof UpdateMyAgentCompanionResponseSchema>
export type UploadMyAgentCompanionImageResponse = z.infer<typeof UploadMyAgentCompanionImageResponseSchema>
