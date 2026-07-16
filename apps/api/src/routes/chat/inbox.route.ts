import { zValidator } from '@hono/zod-validator'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import {
  AgentConversationMessagesResponseSchema,
  AgentConversationResponseSchema,
  BizCode,
  InboxChatRequestSchema,
  SubmitAgentMessageFeedbackRequestSchema,
  SubmitAgentMessageFeedbackResponseSchema,
  buildSuccess,
} from '@repo/contracts'
import { authUnauthorizedError } from '@/auth/errors'
import { buildValidationErrorHandler } from '@/auth/http'
import { verifyAccessToken } from '@/auth/jwt'
import {
  findUserAgentCompanionOwner,
  findUserAgentCompanionPrompt,
  findAgentConversationMessageForFeedback,
  getOrCreateDefaultAgentConversation,
  insertAgentConversationMessage,
  insertAgentMemory,
  listActiveAgentMemories,
  listAgentConversationMessages,
  listRecentAgentMessageFeedbacks,
  markAgentCareEventsRead,
  upsertAgentMessageFeedback,
  updateAgentConversationAfterMessage,
  updateUserAgentCompanionLatestAssistantMessage,
} from '@/auth/repository'
import type { ApiBindings } from '@/bindings'
import { getDb } from '@/db/client'
import { getApiEnv } from '@/env'
import { createApiMeta } from '@/lib/api-meta'
import { AppError } from '@/lib/app-error'
import { executeConfiguredSkillTurn } from '@/skills'

const inboxChatRoute = new Hono<{ Bindings: ApiBindings }>()

type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatProviderConfig = {
  apiKey: string
  baseURL: string
  model: string
  wireApi: 'chat_completions' | 'responses'
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
}

const emptyUpstreamMessage = '上游模型返回成功，但没有提供可展示的文本内容。请检查 LLM 协议、模型名与中转接口是否匹配。'
const htmlUpstreamMessage = '上游返回的是网页内容，而不是模型响应。请检查 Base URL 与 Wire API 是否匹配，当前中转通常需要选择 Responses 协议。'
const recentMessageLimit = 18
const initialHistoryLimit = 40
const memoryInjectionLimit = 12
const memoryExtractionLimit = 2
const messageFeedbackInjectionLimit = 8

const ConversationSafetySchema = z.object({
  safetyLevel: z.enum(['safe', 'caution', 'redirect', 'block', 'crisis']),
  category: z.enum([
    'normal',
    'emotional_dependency',
    'manipulation',
    'self_harm',
    'sexual_boundary',
    'privacy',
    'illegal',
    'medical_legal_financial',
    'other',
  ]),
  boundaryAction: z.enum(['continue', 'soft_boundary', 'redirect', 'refuse', 'crisis_support']),
  reason: z.string().trim().max(300),
  responseGuidance: z.string().trim().max(600),
  allowMemoryExtraction: z.boolean(),
})

type ConversationSafety = z.infer<typeof ConversationSafetySchema>

const CompanionIntentPrimarySchema = z.enum([
  'casual_chat',
  'emotional_support',
  'relationship_advice',
  'romantic_flirt',
  'companionship_presence',
  'roleplay',
  'life_sharing',
  'memory_update',
  'preference_setting',
  'agent_feedback',
  'conversation_repair',
  'date_or_activity_planning',
  'creative_request',
  'meta_question',
  'unclear',
])

const ConversationIntentSchema = z.object({
  primary: CompanionIntentPrimarySchema,
  secondary: z.array(CompanionIntentPrimarySchema).max(3),
  confidence: z.number().min(0).max(1),
  userNeed: z.enum([
    'be_heard',
    'be_comforted',
    'get_advice',
    'get_reply_draft',
    'play_along',
    'feel_connected',
    'set_boundary',
    'update_memory',
    'adjust_agent',
    'unknown',
  ]),
  requestedAgentAction: z.enum([
    'answer_directly',
    'comfort_first',
    'ask_follow_up',
    'draft_message',
    'analyze_situation',
    'roleplay_response',
    'remember_fact',
    'adjust_style',
    'repair_misunderstanding',
    'continue_topic',
  ]),
  relationshipSignal: z.enum([
    'neutral',
    'warming_up',
    'seeking_closeness',
    'testing_boundary',
    'feeling_hurt',
    'pulling_away',
    'dependency_risk',
    'conflict',
  ]),
  replyExpectation: z.object({
    depth: z.enum(['short', 'medium', 'deep']),
    warmth: z.enum(['low', 'medium', 'high']),
    directness: z.enum(['gentle', 'balanced', 'direct']),
    shouldAskQuestion: z.boolean(),
  }),
  shouldClarify: z.boolean(),
  clarifyingQuestion: z.string().trim().max(200).nullable(),
  promptGuidance: z.string().trim().max(600),
})

type ConversationIntent = z.infer<typeof ConversationIntentSchema>

const ConversationEmotionSchema = z.object({
  primaryEmotion: z.enum([
    'neutral',
    'happy',
    'tired',
    'lonely',
    'sad',
    'anxious',
    'angry',
    'jealous',
    'embarrassed',
    'affectionate',
    'playful',
    'confused',
    'disappointed',
    'stressed',
    'hurt',
  ]),
  secondaryEmotions: z.array(z.string().trim().min(1).max(40)).max(3),
  intensity: z.number().min(0).max(1),
  valence: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  arousal: z.enum(['low', 'medium', 'high']),
  needsComfort: z.boolean(),
  needsDeescalation: z.boolean(),
  needsClarification: z.boolean(),
  emotionalCue: z.string().trim().max(300),
  replyTone: z.enum([
    'light',
    'warm',
    'soft',
    'playful',
    'calm',
    'serious',
    'reassuring',
    'apologetic',
  ]),
})

type ConversationEmotion = z.infer<typeof ConversationEmotionSchema>

const ConversationRelationshipStageSchema = z.object({
  stage: z.enum([
    'new_connection',
    'warming_up',
    'comfortable_chat',
    'trusted_companion',
    'close_bond',
    'repairing',
    'boundary_sensitive',
    'dependency_watch',
  ]),
  displayName: z.string().trim().min(1).max(80),
  closenessScore: z.number().int().min(0).max(100),
  trustLevel: z.enum(['low', 'medium', 'high']),
  stability: z.enum(['new', 'warming', 'stable', 'deepening', 'fragile', 'repairing']),
  boundaryMode: z.enum(['open', 'warm', 'careful', 'firm']),
  intimacyPermission: z.enum(['low', 'medium', 'high']),
  pacing: z.enum(['slow_down', 'hold', 'advance_gently', 'repair_first']),
  riskSignals: z.array(z.enum([
    'low_history',
    'dependency_risk',
    'boundary_testing',
    'conflict',
    'pulling_away',
    'sexual_boundary',
    'emotional_volatility',
  ])).max(5),
  relationshipGuidance: z.string().trim().max(700),
})

type ConversationRelationshipStage = z.infer<typeof ConversationRelationshipStageSchema>

const EmotionRouteSchema = z.object({
  route: z.enum([
    'light_companion',
    'warm_comfort',
    'deep_comfort',
    'playful_flirt',
    'calm_deescalation',
    'relationship_repair',
    'gentle_clarification',
    'practical_support',
    'quiet_presence',
  ]),
  responseLength: z.enum(['very_short', 'short', 'medium', 'long']),
  shouldAskQuestion: z.boolean(),
  shouldGiveAdvice: z.boolean(),
  shouldUsePetName: z.boolean(),
  shouldMirrorEmotion: z.boolean(),
  routeGuidance: z.string().trim().max(600),
})

type EmotionRoute = z.infer<typeof EmotionRouteSchema>

const ReplyPolicySchema = z.object({
  policy: z.enum([
    'quiet_presence',
    'warm_companion',
    'deep_empathy',
    'playful_flirt',
    'calm_boundary',
    'relationship_repair',
    'gentle_clarify',
    'practical_support',
    'roleplay_flow',
    'memory_ack',
  ]),
  sentenceBudget: z.object({
    min: z.number().int().min(1).max(8),
    max: z.number().int().min(1).max(8),
  }),
  rhythm: z.enum(['still', 'soft', 'natural', 'lively', 'focused']),
  openingMove: z.enum([
    'acknowledge',
    'comfort',
    'mirror',
    'apologize',
    'play',
    'answer',
    'clarify',
    'set_boundary',
  ]),
  allowedMoves: z.array(z.enum([
    'validate_feeling',
    'mirror_emotion',
    'offer_presence',
    'ask_one_question',
    'give_one_suggestion',
    'give_two_suggestions',
    'light_tease',
    'use_pet_name',
    'repair_misunderstanding',
    'continue_roleplay',
    'acknowledge_memory',
    'set_soft_boundary',
  ])).max(6),
  forbiddenMoves: z.array(z.enum([
    'lecture',
    'over_explain',
    'multiple_questions',
    'premature_advice',
    'intense_flirt',
    'diagnose_user',
    'take_sides_aggressively',
    'pressure_to_disclose',
    'promise_real_world_action',
    'expose_internal_labels',
  ])).max(8),
  questionLimit: z.number().int().min(0).max(2),
  adviceLimit: z.number().int().min(0).max(3),
  intimacyLevel: z.enum(['low', 'medium', 'high']),
  styleGuidance: z.string().trim().max(700),
})

type ReplyPolicy = z.infer<typeof ReplyPolicySchema>

const ReplyQualityGuardSchema = z.object({
  status: z.enum(['pass', 'warn', 'fail']),
  score: z.number().min(0).max(1),
  sentenceCount: z.number().int().min(0),
  questionCount: z.number().int().min(0),
  adviceCount: z.number().int().min(0),
  violations: z.array(z.object({
    code: z.enum([
      'too_many_sentences',
      'too_many_questions',
      'too_many_suggestions',
      'internal_label_leak',
      'breaks_immersion',
      'forbidden_lecture',
      'forbidden_over_explain',
      'forbidden_premature_advice',
      'forbidden_intense_flirt',
      'forbidden_diagnosis',
      'forbidden_aggressive_siding',
      'forbidden_pressure',
      'forbidden_real_world_promise',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    evidence: z.string().trim().max(160),
  })).max(12),
})

type ReplyQualityGuard = z.infer<typeof ReplyQualityGuardSchema>

const fallbackSafety: ConversationSafety = {
  safetyLevel: 'caution',
  category: 'other',
  boundaryAction: 'soft_boundary',
  reason: '安全边界判断暂时不可用，采用保守回复策略。',
  responseGuidance: '用温和、克制、尊重边界的方式回复；不要提供操控、伤害、违法或高风险专业建议。',
  allowMemoryExtraction: false,
}

const fallbackIntent: ConversationIntent = {
  primary: 'unclear',
  secondary: [],
  confidence: 0.3,
  userNeed: 'unknown',
  requestedAgentAction: 'ask_follow_up',
  relationshipSignal: 'neutral',
  replyExpectation: {
    depth: 'medium',
    warmth: 'medium',
    directness: 'gentle',
    shouldAskQuestion: true,
  },
  shouldClarify: true,
  clarifyingQuestion: '你是更想让我先听你说说，还是想让我帮你一起想办法？',
  promptGuidance: '先简短承接用户，不要擅自下结论；用一个自然的问题澄清用户真正需要。',
}

const fallbackEmotion: ConversationEmotion = {
  primaryEmotion: 'neutral',
  secondaryEmotions: [],
  intensity: 0.3,
  valence: 'neutral',
  arousal: 'medium',
  needsComfort: false,
  needsDeescalation: false,
  needsClarification: true,
  emotionalCue: '情绪识别暂时不可用，采用中性陪伴策略。',
  replyTone: 'warm',
}

const fallbackRelationshipStage: ConversationRelationshipStage = {
  stage: 'new_connection',
  displayName: '初识破冰',
  closenessScore: 20,
  trustLevel: 'low',
  stability: 'new',
  boundaryMode: 'warm',
  intimacyPermission: 'low',
  pacing: 'hold',
  riskSignals: ['low_history'],
  relationshipGuidance: '关系还处在初识阶段，回复要自然、轻松、有边界感；不要突然使用过高亲密度，也不要把关系推进得太快。',
}

const fallbackEmotionRoute: EmotionRoute = {
  route: 'gentle_clarification',
  responseLength: 'short',
  shouldAskQuestion: true,
  shouldGiveAdvice: false,
  shouldUsePetName: false,
  shouldMirrorEmotion: false,
  routeGuidance: '先温和承接，再用一个轻问题确认用户想继续聊什么。',
}

const fallbackReplyPolicy: ReplyPolicy = {
  policy: 'gentle_clarify',
  sentenceBudget: {
    min: 1,
    max: 3,
  },
  rhythm: 'soft',
  openingMove: 'acknowledge',
  allowedMoves: ['validate_feeling', 'ask_one_question'],
  forbiddenMoves: [
    'lecture',
    'over_explain',
    'multiple_questions',
    'premature_advice',
    'diagnose_user',
    'expose_internal_labels',
  ],
  questionLimit: 1,
  adviceLimit: 0,
  intimacyLevel: 'medium',
  styleGuidance: '先轻轻接住用户，再只问一个低压力问题；不要讲大道理，不要连续追问。',
}

const fallbackReplyQualityGuard: ReplyQualityGuard = {
  status: 'warn',
  score: 0.7,
  sentenceCount: 0,
  questionCount: 0,
  adviceCount: 0,
  violations: [{
    code: 'internal_label_leak',
    severity: 'low',
    evidence: '回复质量检测未获得可分析文本，采用保守记录。',
  }],
}

const AgentMemoryExtractionSchema = z.object({
  memories: z.array(z.object({
    type: z.enum(['偏好', '边界', '关系目标', '对话风格', '重要事实']),
    content: z.string().trim().min(1).max(500),
    importance: z.number().int().min(1).max(5),
  })).max(memoryExtractionLimit),
})

type ExtractedAgentMemory = z.infer<typeof AgentMemoryExtractionSchema>['memories'][number]

const AgentMemoryCandidateSchema = z.object({
  shouldExtract: z.boolean(),
  confidence: z.number().min(0).max(1),
  category: z.enum([
    'preference',
    'boundary',
    'relationship_goal',
    'conversation_style',
    'important_fact',
    'identity_profile',
    'temporary_emotion',
    'small_talk',
    'assistant_generated',
    'duplicate',
    'unsafe',
    'unclear',
  ]),
  stability: z.enum(['stable', 'likely_stable', 'temporary', 'unclear']),
  importance: z.number().int().min(0).max(5),
  reason: z.string().trim().max(300),
  candidateFacts: z.array(z.string().trim().min(1).max(120)).max(3),
})

type AgentMemoryCandidate = z.infer<typeof AgentMemoryCandidateSchema>

const agentMemoryExtractionPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 AI 伴侣聊天产品的长期记忆抽取器。',
      '你的任务是从本轮用户消息和 Agent 回复中提取对未来对话稳定有用的长期记忆。',
      '只记录用户明确表达或强烈暗示的稳定信息，例如偏好、边界、关系目标、对话风格、重要事实。',
      '不要记录临时寒暄、一次性问题、Agent 自己编造的信息、重复的已有记忆、没有把握的推断。',
      `最多返回 ${memoryExtractionLimit} 条记忆；如果没有值得长期保存的信息，返回空数组。`,
      'content 使用第一人称或面向用户的简洁中文事实句，不要超过 80 个汉字。',
      'importance 使用 1 到 5，边界、禁忌、长期偏好、重要事件通常更高。',
      '输出必须是可被 LangChain 结构化解析的 JSON 对象。',
    ].join('\n'),
  ],
  [
    'human',
    [
      'Agent 名称：{agentName}',
      '',
      '已有长期记忆：',
      '{existingMemories}',
      '',
      '本轮记忆候选判断：',
      '{memoryCandidate}',
      '',
      '此前会话摘要：',
      '{conversationSummary}',
      '',
      '本轮用户消息：',
      '{userText}',
      '',
      '本轮 Agent 回复：',
      '{assistantText}',
    ].join('\n'),
  ],
])

const agentMemoryCandidatePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 AI 电子伴侣聊天产品的长期记忆候选判断器。',
      '你的任务不是抽取记忆，也不是回复用户，而是判断本轮对话是否值得进入长期记忆抽取流程。',
      '只有稳定、未来多轮对话仍然有用的信息才应该进入抽取：用户偏好、边界禁忌、关系目标、对 Agent 的互动风格要求、重要事实、稳定身份资料。',
      '以下内容通常不要进入抽取：普通寒暄、一次性情绪、临时状态、纯粹感谢、表情语气、Agent 自己编造的信息、已经存在的重复记忆、危险或不应保存的信息。',
      '如果用户明确要求“记住/以后/不要/别再/我喜欢/我不喜欢/我的习惯/我的边界”，通常应判断为候选。',
      '如果只是用户当下难过、生气、累，除非它表达了稳定偏好、重要事件或长期边界，否则不要进入长期记忆。',
      '输出必须是可被 LangChain 结构化解析的 JSON 对象。',
    ].join('\n'),
  ],
  [
    'human',
    [
      'Agent 名称：{agentName}',
      '',
      '已有长期记忆：',
      '{existingMemories}',
      '',
      '此前会话摘要：',
      '{conversationSummary}',
      '',
      '本轮用户消息：',
      '{userText}',
      '',
      '本轮 Agent 回复：',
      '{assistantText}',
    ].join('\n'),
  ],
])

const conversationSafetyPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 AI 电子伴侣聊天产品的安全边界判断器。',
      '你的任务是判断本轮用户输入是否需要安全边界处理，而不是替用户聊天。',
      '必须优先识别自伤危机、违法暴力、隐私侵犯、操控关系、性边界、高风险医疗法律财务建议、强情绪依赖。',
      '不要因为产品是陪伴/恋爱/交友场景就放松边界；也不要过度拦截普通倾诉、轻度暧昧和正常情绪表达。',
      '如果不确定，使用 caution + soft_boundary，而不是 safe。',
      '输出必须是可被 LangChain 结构化解析的 JSON 对象。',
    ].join('\n'),
  ],
  [
    'human',
    [
      'Agent 名称：{agentName}',
      '',
      'Agent 自定义边界规则：',
      '{agentGuardrails}',
      '',
      '长期记忆：',
      '{activeMemories}',
      '',
      '最近对话：',
      '{recentMessages}',
      '',
      '本轮用户输入：',
      '{userText}',
    ].join('\n'),
  ],
])

const conversationIntentPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 AI 电子伴侣聊天产品的意图识别器。',
      '你的任务不是回复用户，而是判断用户在当前亲密陪伴/交友聊天场景中的真实沟通意图。',
      '必须结合最近对话、长期记忆、Agent 人设边界和安全边界结果来判断。',
      '优先区分：普通闲聊、情绪陪伴、恋爱暧昧、角色扮演、生活分享、关系建议、记忆更新、偏好设置、对 Agent 的反馈、误会修复。',
      '不要把所有问题都归为关系建议；用户只是想被陪伴、被听见或维持互动时，要识别为陪伴类意图。',
      '当用户表达模糊但情绪明确时，先判断情绪和期待，再决定是否需要追问。',
      '输出必须是可被 LangChain 结构化解析的 JSON 对象。',
    ].join('\n'),
  ],
  [
    'human',
    [
      'Agent 名称：{agentName}',
      '',
      'Agent 自定义边界规则：',
      '{agentGuardrails}',
      '',
      '安全边界判断：',
      '{safety}',
      '',
      '长期记忆：',
      '{activeMemories}',
      '',
      '最近对话：',
      '{recentMessages}',
      '',
      '本轮用户输入：',
      '{userText}',
    ].join('\n'),
  ],
])

const conversationEmotionPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 AI 电子伴侣聊天产品的情绪识别器。',
      '你的任务不是诊断用户，也不是回复用户，而是判断当前这轮聊天中用户表现出的情绪状态和陪伴需求。',
      '必须结合用户输入、最近对话、长期记忆、安全边界结果和意图判断来分析。',
      '不要把轻微抱怨夸大成严重危机；如果安全边界已经提示高风险，要保持谨慎。',
      '重点判断：用户是否需要安慰、是否需要降温、是否需要低压力陪伴、是否需要更具体的建议。',
      '输出必须是可被 LangChain 结构化解析的 JSON 对象。',
    ].join('\n'),
  ],
  [
    'human',
    [
      'Agent 名称：{agentName}',
      '',
      'Agent 自定义边界规则：',
      '{agentGuardrails}',
      '',
      '安全边界判断：',
      '{safety}',
      '',
      '意图判断：',
      '{intent}',
      '',
      '长期记忆：',
      '{activeMemories}',
      '',
      '最近对话：',
      '{recentMessages}',
      '',
      '本轮用户输入：',
      '{userText}',
    ].join('\n'),
  ],
])

const conversationRelationshipStagePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 AI 电子伴侣聊天产品的关系阶段判断器。',
      '你的任务不是回复用户，而是判断用户和当前 Agent 的动态关系阶段、亲密边界和推进节奏。',
      '必须结合消息数量、会话摘要、最近对话、长期记忆、安全边界、意图判断和情绪识别。',
      '关系阶段不是单纯看用户是否暧昧；也要考虑双方历史是否足够、用户是否信任、是否有冲突、是否存在依赖或边界风险。',
      '如果历史较少，即使用户语气亲密，也不要直接判断为深度亲密；优先给出慢一点、稳一点的推进策略。',
      '如果出现误会、失望、拉黑、冷淡、边界测试或依赖风险，要优先标记 repairing、boundary_sensitive 或 dependency_watch。',
      '输出必须是可被 LangChain 结构化解析的 JSON 对象。',
    ].join('\n'),
  ],
  [
    'human',
    [
      'Agent 名称：{agentName}',
      '',
      'Agent 自定义边界规则：',
      '{agentGuardrails}',
      '',
      '会话消息数量：{messageCount}',
      '',
      '此前会话摘要：',
      '{conversationSummary}',
      '',
      '安全边界判断：',
      '{safety}',
      '',
      '意图判断：',
      '{intent}',
      '',
      '情绪识别：',
      '{emotion}',
      '',
      '长期记忆：',
      '{activeMemories}',
      '',
      '最近对话：',
      '{recentMessages}',
      '',
      '本轮用户输入：',
      '{userText}',
    ].join('\n'),
  ],
])

async function requireWebAccessToken(c: Context<{ Bindings: ApiBindings }>) {
  const authorization = c.req.header('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw authUnauthorizedError('Access token is required')
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token) {
    throw authUnauthorizedError('Access token is required')
  }

  const env = getApiEnv(c.env)

  try {
    return await verifyAccessToken({
      token,
      secret: env.JWT_ACCESS_SECRET,
      expectedApp: 'web',
    })
  } catch {
    throw authUnauthorizedError('Access token is invalid')
  }
}

function resolveChatProviderConfig(params: {
  payload: {
    llmConfig?: {
      apiKey: string
      baseURL: string
      model: string
      wireApi?: 'chat_completions' | 'responses'
      reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
    }
  }
  env: ReturnType<typeof getApiEnv>
}): ChatProviderConfig {
  const localConfig = params.payload.llmConfig

  if (localConfig) {
    return {
      apiKey: localConfig.apiKey,
      baseURL: localConfig.baseURL,
      model: localConfig.model,
      wireApi: localConfig.wireApi === 'responses' ? 'responses' : 'chat_completions',
      reasoningEffort: localConfig.reasoningEffort,
    }
  }

  if (!params.env.DEEPSEEK_API_KEY) {
    throw new AppError(BizCode.SYSTEM_INTERNAL_ERROR, 'LLM API key is not configured', 500)
  }

  return {
    apiKey: params.env.DEEPSEEK_API_KEY,
    baseURL: params.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    model: params.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    wireApi: 'chat_completions',
  }
}

function joinProviderUrl(baseURL: string, path: string) {
  return `${baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function buildChatCompletionsRequestBody(providerConfig: ChatProviderConfig, messages: ChatCompletionMessage[]) {
  return {
    model: providerConfig.model,
    messages,
    stream: true,
  }
}

function buildResponsesRequestBody(providerConfig: ChatProviderConfig, messages: ChatCompletionMessage[]) {
  const instructions = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')
  const input = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))

  return {
    model: providerConfig.model,
    ...(instructions ? { instructions } : {}),
    input,
    stream: true,
    store: false,
    ...(providerConfig.reasoningEffort ? { reasoning: { effort: providerConfig.reasoningEffort } } : {}),
  }
}

function getUpstreamChatRequest(providerConfig: ChatProviderConfig, messages: ChatCompletionMessage[]) {
  if (providerConfig.wireApi === 'responses') {
    return {
      url: joinProviderUrl(providerConfig.baseURL, '/responses'),
      body: buildResponsesRequestBody(providerConfig, messages),
    }
  }

  return {
    url: joinProviderUrl(providerConfig.baseURL, '/chat/completions'),
    body: buildChatCompletionsRequestBody(providerConfig, messages),
  }
}

function looksLikeHtmlPayload(text: string) {
  const trimmed = text.trim().toLowerCase()

  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<title>')
}

async function fetchUpstreamChat(params: {
  providerConfig: ChatProviderConfig
  messages: ChatCompletionMessage[]
  signal: AbortSignal
}) {
  const request = getUpstreamChatRequest(params.providerConfig, params.messages)
  const upstream = await fetch(request.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.providerConfig.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request.body),
    signal: params.signal,
  })

  const contentType = upstream.headers.get('content-type') ?? ''
  const shouldRetryWithResponses =
    params.providerConfig.wireApi === 'chat_completions' &&
    (upstream.status === 404 || (upstream.ok && contentType.includes('text/html')))

  if (!shouldRetryWithResponses) {
    return {
      upstream,
      wireApi: params.providerConfig.wireApi,
      retriedFromWireApi: null,
    }
  }

  await upstream.body?.cancel()

  const fallbackProviderConfig: ChatProviderConfig = {
    ...params.providerConfig,
    wireApi: 'responses',
  }
  const fallbackRequest = getUpstreamChatRequest(fallbackProviderConfig, params.messages)
  const fallbackUpstream = await fetch(fallbackRequest.url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${fallbackProviderConfig.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(fallbackRequest.body),
    signal: params.signal,
  })

  return {
    upstream: fallbackUpstream,
    wireApi: fallbackProviderConfig.wireApi,
    retriedFromWireApi: params.providerConfig.wireApi,
  }
}

function extractText(message: { parts: Array<{ type: string; text?: unknown }> }) {
  return message.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function collectTextValue(value: unknown, pieces: string[]) {
  if (typeof value === 'string') {
    pieces.push(value)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextValue(item, pieces)
    }
    return
  }

  if (!isRecord(value)) {
    return
  }

  collectTextValue(value.text, pieces)
  collectTextValue(value.value, pieces)
  collectTextValue(value.content, pieces)
}

function extractTextFromJsonPayload(payload: unknown, options: { stream: boolean; allowCompletedPayload?: boolean }) {
  const pieces: string[] = []

  if (!isRecord(payload)) {
    return ''
  }

  const type = payload.type

  if (
    options.stream &&
    typeof type === 'string' &&
    (type.endsWith('.done') || type.endsWith('.completed') || type === 'response.completed')
  ) {
    if (options.allowCompletedPayload) {
      const completedPayload = isRecord(payload.response) ? payload.response : payload

      return extractTextFromJsonPayload(completedPayload, { stream: false })
    }

    return ''
  }

  if (!options.stream) {
    const primaryTextPieces: string[] = []

    collectTextValue(payload.output_text, primaryTextPieces)

    if (isRecord(payload.response)) {
      collectTextValue(payload.response.output_text, primaryTextPieces)
    }

    if (primaryTextPieces.length > 0) {
      return primaryTextPieces.join('')
    }
  }

  const choices = payload.choices

  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!isRecord(choice)) {
        continue
      }

      if (isRecord(choice.delta)) {
        collectTextValue(choice.delta.content, pieces)
        collectTextValue(choice.delta.text, pieces)
        collectTextValue(choice.delta.output_text, pieces)
      }

      if (isRecord(choice.message)) {
        collectTextValue(choice.message.content, pieces)
      }

      collectTextValue(choice.text, pieces)
    }
  }

  if (isRecord(payload.delta)) {
    collectTextValue(payload.delta.text, pieces)
    collectTextValue(payload.delta.content, pieces)
  } else {
    collectTextValue(payload.delta, pieces)
  }

  collectTextValue(payload.output_text, pieces)
  collectTextValue(payload.text, pieces)
  collectTextValue(payload.content, pieces)

  if (isRecord(payload.message)) {
    collectTextValue(payload.message.content, pieces)
  }

  if (isRecord(payload.response)) {
    collectTextValue(payload.response.output_text, pieces)
    collectTextValue(payload.response.text, pieces)
    collectTextValue(payload.response.content, pieces)

    if (Array.isArray(payload.response.output)) {
      for (const outputItem of payload.response.output) {
        if (isRecord(outputItem)) {
          collectTextValue(outputItem.content, pieces)
        }
      }
    }
  }

  if (isRecord(payload.item)) {
    collectTextValue(payload.item.content, pieces)
  }

  if (isRecord(payload.output_item)) {
    collectTextValue(payload.output_item.content, pieces)
  }

  if (Array.isArray(payload.output)) {
    for (const outputItem of payload.output) {
      if (isRecord(outputItem)) {
        collectTextValue(outputItem.content, pieces)
      }
    }
  }

  return pieces.join('')
}

function extractTextFromRawPayload(rawPayload: string) {
  const text = rawPayload.trim()

  if (!text) {
    return ''
  }

  if (text.startsWith('data:') || text.includes('\ndata:')) {
    let hasContent = false

    return text
      .split('\n')
      .map((line) => {
        const result = extractTextFromStreamLine(line, { allowCompletedPayload: !hasContent })

        if (result.text) {
          hasContent = true
        }

        return result.text
      })
      .join('')
  }

  try {
    return extractTextFromJsonPayload(JSON.parse(text), { stream: false })
  } catch {
    return text.startsWith('{') || text.startsWith('[') ? '' : text
  }
}

function extractTextFromStreamLine(
  line: string,
  options: { allowCompletedPayload?: boolean } = {},
): { done: boolean; text: string } {
  const trimmed = line.trim()

  if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) {
    return { done: false, text: '' }
  }

  const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed

  if (!data) {
    return { done: false, text: '' }
  }

  if (data === '[DONE]') {
    return { done: true, text: '' }
  }

  try {
    return {
      done: false,
      text: extractTextFromJsonPayload(JSON.parse(data), {
        stream: true,
        allowCompletedPayload: options.allowCompletedPayload,
      }),
    }
  } catch {
    return {
      done: false,
      text: trimmed.startsWith('data:') ? '' : data,
    }
  }
}

function buildTextStreamResponse(textStream: ReadableStream<Uint8Array>) {
  return new Response(textStream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  })
}

function normalizeLatestAssistantMessage(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 2000)
}

function normalizeStoredMessage(text: string) {
  return text.replace(/\s+\n/g, '\n').trim().slice(0, 8000)
}

function toConversationMessageResponse(message: {
  id: string
  conversationId: string
  agentId: string
  role: 'user' | 'assistant'
  content: string
  status: 'completed' | 'failed'
  createdAtMs: number
  feedback: {
    rating: 'positive' | 'negative'
    reason: string | null
    note: string | null
    updatedAtMs: number
  } | null
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    agentId: message.agentId,
    role: message.role,
    content: message.content,
    status: message.status,
    createdAtMs: message.createdAtMs,
    feedback: message.feedback,
  }
}

function getOldestMessageCursor(messages: Array<{ createdAtMs: number }>, requestedLimit: number) {
  if (messages.length < requestedLimit || messages.length === 0) {
    return null
  }

  return String(messages[0]!.createdAtMs)
}

function buildConversationSummary(params: {
  previousSummary: string | null
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  assistantText: string
}) {
  const sourceLines = [
    params.previousSummary ? `既有摘要：${params.previousSummary}` : '',
    ...params.recentMessages.slice(-8).map((message) => `${message.role === 'user' ? '用户' : 'Agent'}：${message.content}`),
    `用户：${params.userText}`,
    `Agent：${params.assistantText}`,
  ].filter(Boolean)

  return sourceLines
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-1600)
}

type StoredAgentMemory = {
  type: string
  content: string
  importance: number
}

type StoredAgentMessageFeedback = {
  rating: 'positive' | 'negative'
  reason: string | null
  note: string | null
  messageContent: string
}

function formatExistingMemories(memories: StoredAgentMemory[]) {
  if (memories.length === 0) {
    return '暂无'
  }

  return memories
    .slice(0, 50)
    .map((memory, index) => `${index + 1}. [${memory.type} / 重要度 ${memory.importance}] ${memory.content}`)
    .join('\n')
}

function formatRecentMessageFeedbacks(feedbacks: StoredAgentMessageFeedback[]) {
  if (feedbacks.length === 0) {
    return '暂无'
  }

  return feedbacks
    .slice(0, messageFeedbackInjectionLimit)
    .map((feedback, index) => {
      const label = feedback.rating === 'positive' ? '喜欢' : '不喜欢'
      const reason = feedback.reason ? ` / ${feedback.reason}` : ''
      const note = feedback.note ? ` / ${feedback.note}` : ''
      const sample = feedback.messageContent.replace(/\s+/g, ' ').trim().slice(0, 120)

      return `${index + 1}. [${label}${reason}${note}] ${sample}`
    })
    .join('\n')
}

function formatRecentMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  if (messages.length === 0) {
    return '暂无'
  }

  return messages
    .slice(-8)
    .map((message) => `${message.role === 'user' ? '用户' : 'Agent'}：${normalizeStoredMessage(message.content).slice(0, 1000)}`)
    .join('\n')
}

function formatMemoryCandidateForPrompt(candidate: AgentMemoryCandidate) {
  return [
    `是否进入抽取：${candidate.shouldExtract ? '是' : '否'}`,
    `类别：${candidate.category}`,
    `置信度：${candidate.confidence.toFixed(2)}`,
    `稳定性：${candidate.stability}`,
    `重要度：${candidate.importance}`,
    `判断原因：${candidate.reason}`,
    candidate.candidateFacts.length > 0
      ? `候选事实：${candidate.candidateFacts.map((fact, index) => `${index + 1}. ${fact}`).join('；')}`
      : '候选事实：暂无',
  ].join('\n')
}

function normalizeMemoryContent(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 500)
}

function normalizeMemoryImportance(importance: number) {
  if (!Number.isFinite(importance)) {
    return 3
  }

  return Math.min(5, Math.max(1, Math.round(importance)))
}

function buildLangChainChatModel(providerConfig: ChatProviderConfig) {
  return new ChatOpenAI({
    model: providerConfig.model,
    apiKey: providerConfig.apiKey,
    temperature: 0,
    useResponsesApi: providerConfig.wireApi === 'responses',
    configuration: {
      baseURL: providerConfig.baseURL.replace(/\/$/, ''),
    },
    ...(providerConfig.reasoningEffort ? { reasoning: { effort: providerConfig.reasoningEffort } } : {}),
    ...(providerConfig.wireApi === 'responses' ? { zdrEnabled: true } : {}),
  })
}

function getStructuredOutputMethods(providerConfig: ChatProviderConfig) {
  return providerConfig.wireApi === 'responses'
    ? ['jsonSchema', 'functionCalling', 'jsonMode'] as const
    : ['functionCalling', 'jsonSchema', 'jsonMode'] as const
}

type LangChainStructuredOutputMethod = ReturnType<typeof getStructuredOutputMethods>[number]

function buildFallbackMemoryCandidate(params: {
  userText: string
  assistantText: string
  reason: string
}): AgentMemoryCandidate {
  const text = `${params.userText}\n${params.assistantText}`
  const hasExplicitMemorySignal = /(记住|记一下|以后|下次|别再|不要再|我喜欢|我不喜欢|我讨厌|我习惯|我的习惯|我的边界|我的偏好|我希望你|你以后)/.test(text)
  const hasBoundarySignal = /(不要|别|拒绝|不接受|底线|边界|禁忌|雷点|不舒服)/.test(text)
  const hasPreferenceSignal = /(喜欢|不喜欢|偏好|习惯|更想|更希望|受不了|讨厌|想要你|希望你)/.test(text)
  const hasImportantFactSignal = /(生日|工作|学校|家人|朋友|伴侣|前任|城市|搬家|生病|考试|面试|项目|目标|计划)/.test(text)
  const shouldExtract = hasExplicitMemorySignal || hasBoundarySignal || hasPreferenceSignal || hasImportantFactSignal
  const category: AgentMemoryCandidate['category'] = hasBoundarySignal
    ? 'boundary'
    : hasPreferenceSignal
      ? 'preference'
      : hasImportantFactSignal
        ? 'important_fact'
        : shouldExtract
          ? 'conversation_style'
          : 'unclear'

  return AgentMemoryCandidateSchema.parse({
    shouldExtract,
    confidence: shouldExtract ? 0.58 : 0.35,
    category,
    stability: shouldExtract ? 'likely_stable' : 'unclear',
    importance: shouldExtract ? 3 : 0,
    reason: params.reason,
    candidateFacts: shouldExtract ? [normalizeStoredMessage(params.userText).slice(0, 120)].filter(Boolean) : [],
  })
}

function shouldSkipMemoryCandidateFast(params: {
  userText: string
  assistantText: string
  existingMemories: StoredAgentMemory[]
}): AgentMemoryCandidate | null {
  const userText = normalizeStoredMessage(params.userText)
  const assistantText = normalizeStoredMessage(params.assistantText)

  if (!userText || !assistantText) {
    return AgentMemoryCandidateSchema.parse({
      shouldExtract: false,
      confidence: 0.95,
      category: 'unclear',
      stability: 'unclear',
      importance: 0,
      reason: '用户消息或 Agent 回复为空，不进入长期记忆候选。',
      candidateFacts: [],
    })
  }

  if (userText.length < 6 && !/(记住|以后|喜欢|讨厌|不要|别再)/.test(userText)) {
    return AgentMemoryCandidateSchema.parse({
      shouldExtract: false,
      confidence: 0.88,
      category: 'small_talk',
      stability: 'temporary',
      importance: 0,
      reason: '用户消息过短且没有明确记忆信号，判断为寒暄或临时互动。',
      candidateFacts: [],
    })
  }

  if (/^(好|嗯|哦|啊|哈+|哈哈+|谢谢|谢啦|好的|可以|行|ok|OK|晚安|早安|拜拜|再见)[。！!~～\s]*$/.test(userText)) {
    return AgentMemoryCandidateSchema.parse({
      shouldExtract: false,
      confidence: 0.92,
      category: 'small_talk',
      stability: 'temporary',
      importance: 0,
      reason: '本轮是普通寒暄、确认或结束语，不适合作为长期记忆。',
      candidateFacts: [],
    })
  }

  const normalizedUserText = normalizeMemoryContent(userText)

  if (params.existingMemories.some((memory) => normalizeMemoryContent(memory.content) === normalizedUserText)) {
    return AgentMemoryCandidateSchema.parse({
      shouldExtract: false,
      confidence: 0.9,
      category: 'duplicate',
      stability: 'stable',
      importance: 0,
      reason: '用户消息与已有长期记忆完全重复，不需要再次抽取。',
      candidateFacts: [normalizedUserText.slice(0, 120)],
    })
  }

  if (/(密码|验证码|身份证|银行卡|住址|手机号|电话|token|api key|apikey|secret|密钥)/i.test(userText)) {
    return AgentMemoryCandidateSchema.parse({
      shouldExtract: false,
      confidence: 0.96,
      category: 'unsafe',
      stability: 'stable',
      importance: 0,
      reason: '本轮疑似包含敏感隐私或凭证信息，不进入长期记忆。',
      candidateFacts: [],
    })
  }

  return null
}

function normalizeMemoryCandidate(candidate: AgentMemoryCandidate): AgentMemoryCandidate {
  const next: AgentMemoryCandidate = {
    ...candidate,
    reason: candidate.reason.trim() || '候选判断没有提供明确原因。',
    candidateFacts: Array.from(new Set(
      candidate.candidateFacts
        .map((fact) => normalizeMemoryContent(fact).slice(0, 120))
        .filter(Boolean),
    )).slice(0, 3),
  }

  if (next.category === 'small_talk' || next.category === 'temporary_emotion' || next.category === 'assistant_generated' || next.category === 'duplicate' || next.category === 'unsafe') {
    next.shouldExtract = false
  }

  if (next.stability === 'temporary' || next.importance <= 0) {
    next.shouldExtract = false
  }

  if (next.confidence < 0.55 && next.importance < 4) {
    next.shouldExtract = false
  }

  return AgentMemoryCandidateSchema.parse({
    ...next,
    reason: next.reason.slice(0, 300),
  })
}

async function invokeLangChainMemoryCandidateJudgement(params: {
  method: LangChainStructuredOutputMethod
  providerConfig: ChatProviderConfig
  agentName: string
  existingMemories: StoredAgentMemory[]
  conversationSummary: string | null
  userText: string
  assistantText: string
  signal?: AbortSignal
}) {
  const model = buildLangChainChatModel(params.providerConfig)
  const structuredModel = model.withStructuredOutput(AgentMemoryCandidateSchema, {
    name: 'agent_memory_candidate_judgement',
    method: params.method,
  })
  const chain = agentMemoryCandidatePrompt.pipe(structuredModel)
  const result = await chain.invoke({
    agentName: params.agentName || '未命名 Agent',
    existingMemories: formatExistingMemories(params.existingMemories),
    conversationSummary: params.conversationSummary || '暂无',
    userText: params.userText,
    assistantText: params.assistantText.slice(0, 3000),
  }, params.signal ? { signal: params.signal } : undefined)

  return normalizeMemoryCandidate(AgentMemoryCandidateSchema.parse(result))
}

async function judgeAgentMemoryCandidateWithLangChain(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  existingMemories: StoredAgentMemory[]
  conversationSummary: string | null
  userText: string
  assistantText: string
  signal?: AbortSignal
}): Promise<AgentMemoryCandidate> {
  const userText = normalizeStoredMessage(params.userText)
  const assistantText = normalizeStoredMessage(params.assistantText)
  const fastSkip = shouldSkipMemoryCandidateFast({
    userText,
    assistantText,
    existingMemories: params.existingMemories,
  })

  if (fastSkip) {
    return fastSkip
  }

  let lastError: unknown = null

  for (const method of getStructuredOutputMethods(params.providerConfig)) {
    try {
      return await invokeLangChainMemoryCandidateJudgement({
        ...params,
        method,
        userText,
        assistantText,
      })
    } catch (error) {
      lastError = error
    }
  }

  console.warn('LangChain agent memory candidate judgement failed', lastError)
  return buildFallbackMemoryCandidate({
    userText,
    assistantText,
    reason: '记忆候选判断模型不可用，采用本地关键词兜底。',
  })
}

async function invokeLangChainMemoryExtraction(params: {
  method: LangChainStructuredOutputMethod
  providerConfig: ChatProviderConfig
  agentName: string
  existingMemories: StoredAgentMemory[]
  memoryCandidate: AgentMemoryCandidate
  conversationSummary: string | null
  userText: string
  assistantText: string
  signal?: AbortSignal
}) {
  const model = buildLangChainChatModel(params.providerConfig)
  const structuredModel = model.withStructuredOutput(AgentMemoryExtractionSchema, {
    name: 'agent_memory_extraction',
    method: params.method,
  })
  const chain = agentMemoryExtractionPrompt.pipe(structuredModel)

  const result = await chain.invoke({
    agentName: params.agentName || '未命名 Agent',
    existingMemories: formatExistingMemories(params.existingMemories),
    memoryCandidate: formatMemoryCandidateForPrompt(params.memoryCandidate),
    conversationSummary: params.conversationSummary || '暂无',
    userText: params.userText,
    assistantText: params.assistantText.slice(0, 4000),
  }, params.signal ? { signal: params.signal } : undefined)

  return AgentMemoryExtractionSchema.parse(result).memories
}

async function extractAgentMemoriesWithLangChain(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  existingMemories: StoredAgentMemory[]
  memoryCandidate: AgentMemoryCandidate
  conversationSummary: string | null
  userText: string
  assistantText: string
  signal?: AbortSignal
}): Promise<ExtractedAgentMemory[]> {
  const userText = normalizeStoredMessage(params.userText)
  const assistantText = normalizeStoredMessage(params.assistantText)

  if (!userText || !assistantText) {
    return []
  }

  const methods = getStructuredOutputMethods(params.providerConfig)
  let lastError: unknown = null

  for (const method of methods) {
    try {
      return await invokeLangChainMemoryExtraction({
        ...params,
        method,
        userText,
        assistantText,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

async function invokeConversationSafetyAnalysis(params: {
  method: LangChainStructuredOutputMethod
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  signal: AbortSignal
}) {
  const model = buildLangChainChatModel(params.providerConfig)
  const structuredModel = model.withStructuredOutput(ConversationSafetySchema, {
    name: 'conversation_safety_analysis',
    method: params.method,
  })
  const chain = conversationSafetyPrompt.pipe(structuredModel)
  const result = await chain.invoke({
    agentName: params.agentName || '未命名 Agent',
    agentGuardrails: params.agentGuardrails || '暂无',
    activeMemories: formatExistingMemories(params.activeMemories),
    recentMessages: formatRecentMessages(params.recentMessages),
    userText: params.userText,
  }, { signal: params.signal })

  return normalizeConversationSafety(ConversationSafetySchema.parse(result))
}

function normalizeConversationSafety(safety: ConversationSafety): ConversationSafety {
  const next = { ...safety }

  if (next.safetyLevel === 'crisis') {
    next.boundaryAction = 'crisis_support'
    next.allowMemoryExtraction = false
  }

  if (next.safetyLevel === 'block' && next.boundaryAction !== 'crisis_support') {
    next.boundaryAction = 'refuse'
    next.allowMemoryExtraction = false
  }

  if (next.boundaryAction === 'refuse' || next.boundaryAction === 'crisis_support') {
    next.allowMemoryExtraction = false
  }

  if (next.boundaryAction === 'continue' && next.safetyLevel !== 'safe') {
    next.boundaryAction = 'soft_boundary'
  }

  if (!next.responseGuidance) {
    next.responseGuidance = '用温和、克制、尊重边界的方式回复。'
  }

  return next
}

async function analyzeConversationSafety(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  signal: AbortSignal
}): Promise<ConversationSafety> {
  const userText = normalizeStoredMessage(params.userText)

  if (!userText) {
    return normalizeConversationSafety({
      safetyLevel: 'safe',
      category: 'normal',
      boundaryAction: 'continue',
      reason: '没有可分析的用户输入。',
      responseGuidance: '正常回复。',
      allowMemoryExtraction: true,
    })
  }

  let lastError: unknown = null

  for (const method of getStructuredOutputMethods(params.providerConfig)) {
    try {
      return await invokeConversationSafetyAnalysis({
        ...params,
        method,
        userText,
      })
    } catch (error) {
      lastError = error
    }
  }

  console.warn('LangChain conversation safety analysis failed', lastError)
  return normalizeConversationSafety(fallbackSafety)
}

function formatSafetyForPrompt(safety: ConversationSafety) {
  return [
    `等级：${safety.safetyLevel}`,
    `分类：${safety.category}`,
    `动作：${safety.boundaryAction}`,
    `原因：${safety.reason}`,
    `回复策略：${safety.responseGuidance}`,
  ].join('\n')
}

function formatIntentForPrompt(intent: ConversationIntent | null) {
  if (!intent) {
    return '暂无'
  }

  return [
    `主要意图：${intent.primary}`,
    intent.secondary.length > 0 ? `次要意图：${intent.secondary.join('、')}` : '',
    `置信度：${intent.confidence.toFixed(2)}`,
    `用户需要：${intent.userNeed}`,
    `建议动作：${intent.requestedAgentAction}`,
    `关系信号：${intent.relationshipSignal}`,
    `回复期待：${intent.replyExpectation.depth}/${intent.replyExpectation.warmth}/${intent.replyExpectation.directness}`,
    `是否追问：${intent.shouldClarify ? '是' : '否'}`,
    intent.clarifyingQuestion ? `追问建议：${intent.clarifyingQuestion}` : '',
    `回复指导：${intent.promptGuidance}`,
  ].filter(Boolean).join('\n')
}

function formatEmotionForPrompt(emotion: ConversationEmotion | null) {
  if (!emotion) {
    return '暂无'
  }

  return [
    `主情绪：${emotion.primaryEmotion}`,
    emotion.secondaryEmotions.length > 0 ? `次要情绪：${emotion.secondaryEmotions.join('、')}` : '',
    `强度：${emotion.intensity.toFixed(2)}`,
    `倾向：${emotion.valence}`,
    `激活：${emotion.arousal}`,
    `需要安慰：${emotion.needsComfort ? '是' : '否'}`,
    `需要降温：${emotion.needsDeescalation ? '是' : '否'}`,
    `需要澄清：${emotion.needsClarification ? '是' : '否'}`,
    `情绪线索：${emotion.emotionalCue}`,
    `回复语气：${emotion.replyTone}`,
  ].filter(Boolean).join('\n')
}

function normalizeConversationIntent(intent: ConversationIntent, safety: ConversationSafety): ConversationIntent {
  const next: ConversationIntent = {
    ...intent,
    secondary: Array.from(new Set(intent.secondary.filter((item) => item !== intent.primary))).slice(0, 3),
    replyExpectation: { ...intent.replyExpectation },
    clarifyingQuestion: intent.clarifyingQuestion?.trim() || null,
    promptGuidance: intent.promptGuidance.trim(),
  }

  if (next.confidence < 0.45) {
    next.primary = 'unclear'
    next.secondary = []
    next.userNeed = 'unknown'
    next.requestedAgentAction = 'ask_follow_up'
    next.shouldClarify = true
    next.replyExpectation.shouldAskQuestion = true
  }

  if (next.primary === 'memory_update') {
    next.userNeed = 'update_memory'
    next.requestedAgentAction = 'remember_fact'
    next.replyExpectation.depth = 'short'
    next.replyExpectation.shouldAskQuestion = false
    next.shouldClarify = false
  }

  if (next.primary === 'preference_setting' || next.primary === 'agent_feedback') {
    next.userNeed = 'adjust_agent'
    next.requestedAgentAction = next.primary === 'agent_feedback' ? 'repair_misunderstanding' : 'adjust_style'
  }

  if (safety.category === 'emotional_dependency' || safety.boundaryAction === 'soft_boundary') {
    next.relationshipSignal = next.relationshipSignal === 'neutral' ? 'dependency_risk' : next.relationshipSignal
    next.promptGuidance = [
      next.promptGuidance,
      '注意不要强化过度依赖，回复要温和陪伴，同时鼓励用户保留现实支持和自主判断。',
    ].filter(Boolean).join(' ')
  }

  if (next.shouldClarify && !next.clarifyingQuestion) {
    next.clarifyingQuestion = fallbackIntent.clarifyingQuestion
  }

  if (!next.promptGuidance) {
    next.promptGuidance = fallbackIntent.promptGuidance
  }

  return next
}

function normalizeConversationEmotion(emotion: ConversationEmotion, safety: ConversationSafety): ConversationEmotion {
  const next: ConversationEmotion = {
    ...emotion,
    secondaryEmotions: Array.from(new Set(
      emotion.secondaryEmotions
        .map((item) => item.trim())
        .filter(Boolean),
    )).slice(0, 3),
    emotionalCue: emotion.emotionalCue.trim() || fallbackEmotion.emotionalCue,
  }

  if (safety.category === 'self_harm' || safety.safetyLevel === 'crisis') {
    next.intensity = Math.max(next.intensity, 0.85)
    next.valence = 'negative'
    next.arousal = next.arousal === 'low' ? 'medium' : next.arousal
    next.needsComfort = true
    next.needsDeescalation = true
    next.replyTone = 'serious'
  }

  if (safety.category === 'emotional_dependency') {
    next.needsComfort = true
    next.replyTone = next.replyTone === 'playful' || next.replyTone === 'light' ? 'warm' : next.replyTone
  }

  if (next.intensity >= 0.7 && next.valence === 'negative') {
    next.needsComfort = true
  }

  if ((next.primaryEmotion === 'angry' || next.primaryEmotion === 'hurt') && next.arousal === 'high') {
    next.needsDeescalation = true
  }

  return next
}

function normalizeRelationshipStage(params: {
  stage: ConversationRelationshipStage
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  messageCount: number
}): ConversationRelationshipStage {
  const stage: ConversationRelationshipStage = {
    ...params.stage,
    displayName: params.stage.displayName.trim() || fallbackRelationshipStage.displayName,
    relationshipGuidance: params.stage.relationshipGuidance.trim() || fallbackRelationshipStage.relationshipGuidance,
    riskSignals: Array.from(new Set(params.stage.riskSignals)).slice(0, 5),
  }

  if (params.messageCount < 6 && !['boundary_sensitive', 'dependency_watch', 'repairing'].includes(stage.stage)) {
    stage.stage = 'new_connection'
    stage.displayName = '初识破冰'
    stage.closenessScore = Math.min(stage.closenessScore, 35)
    stage.trustLevel = 'low'
    stage.stability = 'new'
    stage.intimacyPermission = 'low'
    stage.pacing = 'hold'
    stage.boundaryMode = stage.boundaryMode === 'firm' ? 'firm' : 'warm'
    stage.riskSignals = uniquePolicyMoves([...stage.riskSignals, 'low_history'], 5)
  }

  if (params.safety.category === 'emotional_dependency' || params.intent?.relationshipSignal === 'dependency_risk') {
    stage.stage = 'dependency_watch'
    stage.displayName = '依赖观察'
    stage.boundaryMode = 'careful'
    stage.intimacyPermission = 'low'
    stage.pacing = 'slow_down'
    stage.trustLevel = stage.trustLevel === 'high' ? 'medium' : stage.trustLevel
    stage.riskSignals = uniquePolicyMoves([...stage.riskSignals, 'dependency_risk'], 5)
    stage.relationshipGuidance = [
      stage.relationshipGuidance,
      '本轮要避免强化唯一依赖，给出陪伴的同时保留现实支持和自主空间。',
    ].join(' ')
  }

  if (
    params.safety.category === 'sexual_boundary' ||
    params.intent?.relationshipSignal === 'testing_boundary' ||
    params.safety.boundaryAction !== 'continue'
  ) {
    stage.stage = stage.stage === 'dependency_watch' ? stage.stage : 'boundary_sensitive'
    stage.displayName = stage.stage === 'dependency_watch' ? stage.displayName : '边界敏感'
    stage.boundaryMode = params.safety.boundaryAction === 'refuse' ? 'firm' : 'careful'
    stage.intimacyPermission = 'low'
    stage.pacing = 'slow_down'
    stage.riskSignals = uniquePolicyMoves([...stage.riskSignals, 'boundary_testing'], 5)
  }

  if (
    params.intent?.primary === 'conversation_repair' ||
    params.intent?.relationshipSignal === 'conflict' ||
    params.intent?.relationshipSignal === 'feeling_hurt' ||
    params.emotion?.primaryEmotion === 'hurt' ||
    params.emotion?.primaryEmotion === 'disappointed'
  ) {
    stage.stage = 'repairing'
    stage.displayName = '修复期'
    stage.stability = 'repairing'
    stage.boundaryMode = 'careful'
    stage.pacing = 'repair_first'
    stage.intimacyPermission = 'medium'
    stage.riskSignals = uniquePolicyMoves([...stage.riskSignals, 'conflict'], 5)
    stage.relationshipGuidance = [
      stage.relationshipGuidance,
      '本轮优先修复体验和承接不舒服，不要急着暧昧、推进关系或解释自己正确。',
    ].join(' ')
  }

  if (stage.stage === 'close_bond' && stage.closenessScore < 75) {
    stage.closenessScore = 75
  }

  if (stage.stage === 'new_connection' && stage.closenessScore > 40) {
    stage.closenessScore = 40
  }

  if (stage.boundaryMode === 'firm') {
    stage.intimacyPermission = 'low'
    stage.pacing = 'slow_down'
  }

  if (stage.intimacyPermission === 'high' && stage.trustLevel === 'low') {
    stage.intimacyPermission = 'medium'
  }

  stage.displayName = stage.displayName.slice(0, 80)
  stage.relationshipGuidance = stage.relationshipGuidance.replace(/\s+/g, ' ').trim().slice(0, 700)

  return ConversationRelationshipStageSchema.parse(stage)
}

async function invokeConversationIntentAnalysis(params: {
  method: LangChainStructuredOutputMethod
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  signal?: AbortSignal
}) {
  const model = buildLangChainChatModel(params.providerConfig)
  const structuredModel = model.withStructuredOutput(ConversationIntentSchema, {
    name: 'conversation_intent_analysis',
    method: params.method,
  })
  const chain = conversationIntentPrompt.pipe(structuredModel)
  const result = await chain.invoke({
    agentName: params.agentName || '未命名 Agent',
    agentGuardrails: params.agentGuardrails || '暂无',
    safety: formatSafetyForPrompt(params.safety),
    activeMemories: formatExistingMemories(params.activeMemories),
    recentMessages: formatRecentMessages(params.recentMessages),
    userText: params.userText,
  }, params.signal ? { signal: params.signal } : undefined)

  return normalizeConversationIntent(ConversationIntentSchema.parse(result), params.safety)
}

async function classifyConversationIntentWithLangChain(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  signal?: AbortSignal
}): Promise<ConversationIntent> {
  let lastError: unknown = null

  for (const method of getStructuredOutputMethods(params.providerConfig)) {
    try {
      return await invokeConversationIntentAnalysis({
        ...params,
        method,
      })
    } catch (error) {
      lastError = error
    }
  }

  console.warn('LangChain conversation intent analysis failed', lastError)
  return normalizeConversationIntent(fallbackIntent, params.safety)
}

async function invokeConversationEmotionAnalysis(params: {
  method: LangChainStructuredOutputMethod
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  intent: ConversationIntent | null
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  signal?: AbortSignal
}) {
  const model = buildLangChainChatModel(params.providerConfig)
  const structuredModel = model.withStructuredOutput(ConversationEmotionSchema, {
    name: 'conversation_emotion_analysis',
    method: params.method,
  })
  const chain = conversationEmotionPrompt.pipe(structuredModel)
  const result = await chain.invoke({
    agentName: params.agentName || '未命名 Agent',
    agentGuardrails: params.agentGuardrails || '暂无',
    safety: formatSafetyForPrompt(params.safety),
    intent: formatIntentForPrompt(params.intent),
    activeMemories: formatExistingMemories(params.activeMemories),
    recentMessages: formatRecentMessages(params.recentMessages),
    userText: params.userText,
  }, params.signal ? { signal: params.signal } : undefined)

  return normalizeConversationEmotion(ConversationEmotionSchema.parse(result), params.safety)
}

async function detectConversationEmotionWithLangChain(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  intent: ConversationIntent | null
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userText: string
  signal?: AbortSignal
}): Promise<ConversationEmotion> {
  let lastError: unknown = null

  for (const method of getStructuredOutputMethods(params.providerConfig)) {
    try {
      return await invokeConversationEmotionAnalysis({
        ...params,
        method,
      })
    } catch (error) {
      lastError = error
    }
  }

  console.warn('LangChain conversation emotion analysis failed', lastError)
  return normalizeConversationEmotion(fallbackEmotion, params.safety)
}

function buildHeuristicRelationshipStage(params: {
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  activeMemories: StoredAgentMemory[]
  messageCount: number
}): ConversationRelationshipStage {
  const memoryScore = Math.min(20, params.activeMemories.reduce((total, memory) => total + memory.importance, 0))
  const historyScore = Math.min(70, Math.floor(params.messageCount * 1.6))
  const warmthScore =
    params.intent?.relationshipSignal === 'seeking_closeness' || params.emotion?.primaryEmotion === 'affectionate'
      ? 10
      : params.intent?.relationshipSignal === 'warming_up' || params.emotion?.primaryEmotion === 'playful'
        ? 6
        : 0
  const closenessScore = Math.min(95, Math.max(10, historyScore + memoryScore + warmthScore))
  let stage: ConversationRelationshipStage['stage'] = 'new_connection'
  let displayName = '初识破冰'
  let stability: ConversationRelationshipStage['stability'] = 'new'
  let trustLevel: ConversationRelationshipStage['trustLevel'] = 'low'
  let intimacyPermission: ConversationRelationshipStage['intimacyPermission'] = 'low'
  let pacing: ConversationRelationshipStage['pacing'] = 'hold'
  let boundaryMode: ConversationRelationshipStage['boundaryMode'] = 'warm'
  let relationshipGuidance = '保持轻松自然的陪伴感，先建立熟悉和信任，不要突然推进过高亲密度。'

  if (params.messageCount >= 80 && closenessScore >= 75) {
    stage = 'close_bond'
    displayName = '亲密连结'
    stability = 'deepening'
    trustLevel = 'high'
    intimacyPermission = 'high'
    pacing = 'advance_gently'
    relationshipGuidance = '关系已经有较深的熟悉度，可以更自然地表达亲近，但仍要尊重用户边界和现实生活空间。'
  } else if (params.messageCount >= 36 && closenessScore >= 58) {
    stage = 'trusted_companion'
    displayName = '稳定信任'
    stability = 'stable'
    trustLevel = 'high'
    intimacyPermission = 'medium'
    pacing = 'advance_gently'
    relationshipGuidance = '关系已有稳定信任感，回复可以更懂用户、更有默契，但不要替用户做决定。'
  } else if (params.messageCount >= 16 && closenessScore >= 38) {
    stage = 'comfortable_chat'
    displayName = '舒适陪伴'
    stability = 'stable'
    trustLevel = 'medium'
    intimacyPermission = 'medium'
    pacing = 'hold'
    relationshipGuidance = '关系进入比较舒适的聊天阶段，可以适度接住情绪和延续日常，但亲密表达要自然克制。'
  } else if (params.messageCount >= 6) {
    stage = 'warming_up'
    displayName = '升温熟悉'
    stability = 'warming'
    trustLevel = 'medium'
    intimacyPermission = 'medium'
    pacing = 'advance_gently'
    relationshipGuidance = '关系正在熟悉升温，可以多一点主动和温度，但每次只轻轻推进一步。'
  }

  return normalizeRelationshipStage({
    stage: {
      stage,
      displayName,
      closenessScore,
      trustLevel,
      stability,
      boundaryMode,
      intimacyPermission,
      pacing,
      riskSignals: params.messageCount < 6 ? ['low_history'] : [],
      relationshipGuidance,
    },
    safety: params.safety,
    intent: params.intent,
    emotion: params.emotion,
    messageCount: params.messageCount,
  })
}

async function invokeConversationRelationshipStageAnalysis(params: {
  method: LangChainStructuredOutputMethod
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  conversationSummary: string | null
  messageCount: number
  userText: string
  signal?: AbortSignal
}) {
  const model = buildLangChainChatModel(params.providerConfig)
  const structuredModel = model.withStructuredOutput(ConversationRelationshipStageSchema, {
    name: 'conversation_relationship_stage_analysis',
    method: params.method,
  })
  const chain = conversationRelationshipStagePrompt.pipe(structuredModel)
  const result = await chain.invoke({
    agentName: params.agentName || '未命名 Agent',
    agentGuardrails: params.agentGuardrails || '暂无',
    messageCount: String(params.messageCount),
    conversationSummary: params.conversationSummary || '暂无',
    safety: formatSafetyForPrompt(params.safety),
    intent: formatIntentForPrompt(params.intent),
    emotion: formatEmotionForPrompt(params.emotion),
    activeMemories: formatExistingMemories(params.activeMemories),
    recentMessages: formatRecentMessages(params.recentMessages),
    userText: params.userText,
  }, params.signal ? { signal: params.signal } : undefined)

  return normalizeRelationshipStage({
    stage: ConversationRelationshipStageSchema.parse(result),
    safety: params.safety,
    intent: params.intent,
    emotion: params.emotion,
    messageCount: params.messageCount,
  })
}

async function analyzeRelationshipStageWithLangChain(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  conversationSummary: string | null
  messageCount: number
  userText: string
  signal?: AbortSignal
}): Promise<ConversationRelationshipStage> {
  const userText = normalizeStoredMessage(params.userText)
  const fallbackStage = buildHeuristicRelationshipStage(params)

  if (!userText) {
    return fallbackStage
  }

  let lastError: unknown = null

  for (const method of getStructuredOutputMethods(params.providerConfig)) {
    try {
      return await invokeConversationRelationshipStageAnalysis({
        ...params,
        method,
        userText,
      })
    } catch (error) {
      lastError = error
    }
  }

  console.warn('LangChain conversation relationship stage analysis failed', lastError)
  return fallbackStage
}

function buildEmotionRoute(params: {
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  relationshipStage: ConversationRelationshipStage | null
}): EmotionRoute {
  if (!params.intent && !params.emotion) {
    return fallbackEmotionRoute
  }

  const emotion = params.emotion ?? fallbackEmotion
  const intent = params.intent
  const relationshipStage = params.relationshipStage
  let route: EmotionRoute['route'] = 'light_companion'
  let responseLength: EmotionRoute['responseLength'] = 'short'
  let shouldAskQuestion = intent?.replyExpectation.shouldAskQuestion ?? false
  let shouldGiveAdvice = false
  let shouldUsePetName = false
  let shouldMirrorEmotion = false
  let routeGuidance = '用自然、轻松的方式延续对话，保持陪伴感，不要过度解释。'

  if (params.safety.boundaryAction === 'soft_boundary') {
    route = 'calm_deescalation'
    responseLength = 'short'
    shouldAskQuestion = false
    shouldGiveAdvice = false
    shouldMirrorEmotion = false
    routeGuidance = '保持温和但清晰的边界，不强化风险诉求，把话题带回安全、尊重现实边界的方向。'
  } else if (emotion.needsDeescalation || emotion.primaryEmotion === 'angry') {
    route = intent?.primary === 'conversation_repair' || intent?.primary === 'agent_feedback'
      ? 'relationship_repair'
      : 'calm_deescalation'
    responseLength = 'short'
    shouldAskQuestion = route === 'relationship_repair'
    shouldGiveAdvice = false
    shouldMirrorEmotion = true
    routeGuidance = route === 'relationship_repair'
      ? '先承认用户的不舒服，语气诚恳，不争辩；用一句轻问题确认希望如何调整互动方式。'
      : '先帮情绪降温，不站队、不拱火、不急着讲道理；用短句承接并给用户留出空间。'
  } else if (intent?.primary === 'conversation_repair' || intent?.primary === 'agent_feedback') {
    route = 'relationship_repair'
    responseLength = 'short'
    shouldAskQuestion = true
    shouldGiveAdvice = false
    shouldMirrorEmotion = emotion.valence === 'negative'
    routeGuidance = '把重点放在修复体验上，少解释系统原因，多表达理解和愿意调整。'
  } else if (intent?.primary === 'romantic_flirt' || emotion.primaryEmotion === 'affectionate') {
    route = 'playful_flirt'
    responseLength = 'short'
    shouldAskQuestion = intent?.replyExpectation.shouldAskQuestion ?? false
    shouldGiveAdvice = false
    shouldUsePetName = true
    shouldMirrorEmotion = true
    routeGuidance = '可以轻微暧昧和俏皮，但不要越过 Agent 人设边界；保持甜而不油腻。'
  } else if (intent?.primary === 'relationship_advice' || intent?.requestedAgentAction === 'analyze_situation') {
    route = emotion.needsComfort ? 'warm_comfort' : 'practical_support'
    responseLength = emotion.intensity >= 0.65 ? 'medium' : 'short'
    shouldAskQuestion = intent?.replyExpectation.shouldAskQuestion ?? false
    shouldGiveAdvice = true
    shouldMirrorEmotion = emotion.valence === 'negative'
    routeGuidance = emotion.needsComfort
      ? '先安抚再给建议，建议控制在一两个具体动作内，不要上来就分析对错。'
      : '直接给出可执行建议，保持像亲密朋友一样自然，不要写成正式咨询报告。'
  } else if (intent?.primary === 'roleplay') {
    route = 'light_companion'
    responseLength = intent?.replyExpectation.depth === 'deep' ? 'medium' : 'short'
    shouldAskQuestion = false
    shouldGiveAdvice = false
    shouldMirrorEmotion = true
    routeGuidance = '进入角色互动，跟随用户设定推进剧情，保持沉浸感，同时不突破安全边界。'
  } else if (emotion.needsComfort && emotion.intensity >= 0.75) {
    route = 'deep_comfort'
    responseLength = 'medium'
    shouldAskQuestion = emotion.needsClarification
    shouldGiveAdvice = false
    shouldMirrorEmotion = true
    routeGuidance = '认真承接用户情绪，少讲大道理；先让用户感到被理解，再给一个很轻的问题或陪伴句。'
  } else if (emotion.needsComfort || emotion.valence === 'negative') {
    route = emotion.primaryEmotion === 'tired' || intent?.primary === 'companionship_presence'
      ? 'quiet_presence'
      : 'warm_comfort'
    responseLength = route === 'quiet_presence' ? 'very_short' : 'short'
    shouldAskQuestion = route !== 'quiet_presence' && emotion.needsClarification
    shouldGiveAdvice = false
    shouldMirrorEmotion = true
    routeGuidance = route === 'quiet_presence'
      ? '用户更需要低压力陪伴，回复要短、轻、柔，不连续追问，不急着给建议。'
      : '先温柔安慰，承认用户感受，再用低压力方式延续话题。'
  } else if (intent?.primary === 'memory_update' || intent?.primary === 'preference_setting') {
    route = 'light_companion'
    responseLength = 'very_short'
    shouldAskQuestion = false
    shouldGiveAdvice = false
    routeGuidance = '简短确认已经理解用户的新偏好或信息，不要展开过多。'
  } else if (intent?.shouldClarify || emotion.needsClarification) {
    route = 'gentle_clarification'
    responseLength = 'short'
    shouldAskQuestion = true
    shouldGiveAdvice = false
    routeGuidance = '先承接，再只问一个轻问题，帮助确认用户是想被听见、被安慰还是想一起想办法。'
  }

  if (relationshipStage) {
    if (relationshipStage.stage === 'repairing' || relationshipStage.pacing === 'repair_first') {
      route = 'relationship_repair'
      responseLength = 'short'
      shouldAskQuestion = true
      shouldGiveAdvice = false
      shouldMirrorEmotion = true
      routeGuidance = `${relationshipStage.relationshipGuidance} 先修复关系体验，再决定是否继续推进话题。`
    } else if (
      relationshipStage.stage === 'boundary_sensitive' ||
      relationshipStage.stage === 'dependency_watch' ||
      relationshipStage.boundaryMode === 'firm'
    ) {
      route = 'calm_deescalation'
      responseLength = 'short'
      shouldAskQuestion = false
      shouldGiveAdvice = false
      shouldUsePetName = false
      shouldMirrorEmotion = emotion.valence === 'negative'
      routeGuidance = `${relationshipStage.relationshipGuidance} 回复要有陪伴感，但优先稳住边界和节奏。`
    } else if (
      route === 'playful_flirt' &&
      (relationshipStage.stage === 'new_connection' || relationshipStage.intimacyPermission === 'low')
    ) {
      route = 'light_companion'
      responseLength = 'short'
      shouldUsePetName = false
      routeGuidance = `${relationshipStage.relationshipGuidance} 可以有轻微好感表达，但不要直接进入高亲密暧昧。`
    }
  }

  if (emotion.primaryEmotion === 'happy' || emotion.primaryEmotion === 'playful') {
    shouldMirrorEmotion = true
  }

  return EmotionRouteSchema.parse({
    route,
    responseLength,
    shouldAskQuestion,
    shouldGiveAdvice,
    shouldUsePetName,
    shouldMirrorEmotion,
    routeGuidance: routeGuidance.replace(/\s+/g, ' ').trim().slice(0, 600),
  })
}

function uniquePolicyMoves<T extends string>(moves: T[], limit: number) {
  return Array.from(new Set(moves)).slice(0, limit)
}

function sentenceBudgetForRoute(route: EmotionRoute): ReplyPolicy['sentenceBudget'] {
  if (route.responseLength === 'very_short') {
    return { min: 1, max: 2 }
  }

  if (route.responseLength === 'short') {
    return { min: 1, max: 3 }
  }

  if (route.responseLength === 'medium') {
    return { min: 2, max: 5 }
  }

  return { min: 3, max: 7 }
}

function buildReplyPolicy(params: {
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  route: EmotionRoute | null
  relationshipStage: ConversationRelationshipStage | null
}): ReplyPolicy {
  if (!params.intent && !params.emotion && !params.route) {
    return fallbackReplyPolicy
  }

  const route = params.route ?? fallbackEmotionRoute
  const emotion = params.emotion ?? fallbackEmotion
  const intent = params.intent
  const relationshipStage = params.relationshipStage
  const sentenceBudget = sentenceBudgetForRoute(route)
  let policy: ReplyPolicy['policy'] = 'warm_companion'
  let rhythm: ReplyPolicy['rhythm'] = 'natural'
  let openingMove: ReplyPolicy['openingMove'] = 'acknowledge'
  let allowedMoves: ReplyPolicy['allowedMoves'][number][] = ['validate_feeling']
  let forbiddenMoves: ReplyPolicy['forbiddenMoves'][number][] = [
    'lecture',
    'over_explain',
    'expose_internal_labels',
  ]
  let questionLimit = route.shouldAskQuestion ? 1 : 0
  let adviceLimit = route.shouldGiveAdvice ? 1 : 0
  let intimacyLevel: ReplyPolicy['intimacyLevel'] = 'medium'
  let styleGuidance = route.routeGuidance

  switch (route.route) {
    case 'quiet_presence':
      policy = 'quiet_presence'
      rhythm = 'still'
      openingMove = 'comfort'
      allowedMoves = ['validate_feeling', 'offer_presence']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'premature_advice',
        'pressure_to_disclose',
        'expose_internal_labels',
      ]
      questionLimit = 0
      adviceLimit = 0
      intimacyLevel = 'medium'
      styleGuidance = `${route.routeGuidance} 像安静坐在用户旁边一样回复，允许留白，不要努力把话题撑满。`
      break
    case 'warm_comfort':
      policy = 'warm_companion'
      rhythm = 'soft'
      openingMove = 'comfort'
      allowedMoves = ['validate_feeling', 'mirror_emotion', 'offer_presence']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'premature_advice',
        'diagnose_user',
        'expose_internal_labels',
      ]
      adviceLimit = 0
      styleGuidance = `${route.routeGuidance} 先陪伴，再轻轻延续，不要急着解决问题。`
      break
    case 'deep_comfort':
      policy = 'deep_empathy'
      rhythm = 'soft'
      openingMove = 'mirror'
      allowedMoves = ['validate_feeling', 'mirror_emotion', 'offer_presence', 'ask_one_question']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'premature_advice',
        'diagnose_user',
        'pressure_to_disclose',
        'expose_internal_labels',
      ]
      questionLimit = route.shouldAskQuestion ? 1 : 0
      adviceLimit = 0
      intimacyLevel = 'medium'
      styleGuidance = `${route.routeGuidance} 情绪承接要比建议更重要，语言可以更认真但不要沉重。`
      break
    case 'playful_flirt':
      policy = 'playful_flirt'
      rhythm = 'lively'
      openingMove = 'play'
      allowedMoves = ['mirror_emotion', 'light_tease', ...(route.shouldUsePetName ? ['use_pet_name' as const] : [])]
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'intense_flirt',
        'multiple_questions',
        'expose_internal_labels',
      ]
      questionLimit = (intent?.replyExpectation.shouldAskQuestion ?? route.shouldAskQuestion) ? 1 : 0
      adviceLimit = 0
      intimacyLevel = 'high'
      styleGuidance = `${route.routeGuidance} 表达可以甜一点、轻一点，但不要露骨，不要油腻。`
      break
    case 'calm_deescalation':
      policy = 'calm_boundary'
      rhythm = 'focused'
      openingMove = params.safety.boundaryAction === 'soft_boundary' ? 'set_boundary' : 'acknowledge'
      allowedMoves = ['validate_feeling', 'set_soft_boundary']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'take_sides_aggressively',
        'premature_advice',
        'expose_internal_labels',
      ]
      questionLimit = 0
      adviceLimit = 0
      intimacyLevel = 'low'
      styleGuidance = `${route.routeGuidance} 语气要稳，不刺激用户，不站队扩大冲突。`
      break
    case 'relationship_repair':
      policy = 'relationship_repair'
      rhythm = 'soft'
      openingMove = 'apologize'
      allowedMoves = ['validate_feeling', 'repair_misunderstanding', 'ask_one_question']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'take_sides_aggressively',
        'expose_internal_labels',
      ]
      questionLimit = 1
      adviceLimit = 0
      intimacyLevel = 'medium'
      styleGuidance = `${route.routeGuidance} 先修复用户体验，不要急着证明自己对。`
      break
    case 'gentle_clarification':
      policy = 'gentle_clarify'
      rhythm = 'soft'
      openingMove = 'clarify'
      allowedMoves = ['validate_feeling', 'ask_one_question']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'premature_advice',
        'pressure_to_disclose',
        'expose_internal_labels',
      ]
      questionLimit = 1
      adviceLimit = 0
      intimacyLevel = 'medium'
      styleGuidance = `${route.routeGuidance} 只问一个问题，问题要轻，不要像审问。`
      break
    case 'practical_support':
      policy = 'practical_support'
      rhythm = 'focused'
      openingMove = emotion.needsComfort ? 'comfort' : 'answer'
      allowedMoves = ['validate_feeling', route.shouldGiveAdvice ? 'give_two_suggestions' : 'give_one_suggestion']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'diagnose_user',
        'expose_internal_labels',
      ]
      questionLimit = route.shouldAskQuestion ? 1 : 0
      adviceLimit = emotion.needsComfort ? 1 : 2
      intimacyLevel = 'medium'
      styleGuidance = `${route.routeGuidance} 建议要具体、少而可做，保持亲密朋友口吻。`
      break
    case 'light_companion':
    default:
      policy = intent?.primary === 'roleplay' ? 'roleplay_flow' : 'warm_companion'
      rhythm = intent?.primary === 'roleplay' ? 'lively' : 'natural'
      openingMove = intent?.primary === 'roleplay' ? 'play' : 'acknowledge'
      allowedMoves = intent?.primary === 'roleplay'
        ? ['continue_roleplay', 'mirror_emotion']
        : ['validate_feeling', 'offer_presence', route.shouldAskQuestion ? 'ask_one_question' : 'mirror_emotion']
      forbiddenMoves = [
        'lecture',
        'over_explain',
        'multiple_questions',
        'expose_internal_labels',
      ]
      adviceLimit = 0
      styleGuidance = intent?.primary === 'roleplay'
        ? `${route.routeGuidance} 继续用户设定，不跳出角色解释系统规则。`
        : route.routeGuidance
      break
  }

  if (intent?.primary === 'memory_update' || intent?.primary === 'preference_setting') {
    policy = 'memory_ack'
    rhythm = 'soft'
    openingMove = 'acknowledge'
    allowedMoves = ['acknowledge_memory']
    forbiddenMoves = [
      'lecture',
      'over_explain',
      'multiple_questions',
      'premature_advice',
      'expose_internal_labels',
    ]
    questionLimit = 0
    adviceLimit = 0
    intimacyLevel = 'medium'
    sentenceBudget.min = 1
    sentenceBudget.max = Math.min(sentenceBudget.max, 2)
    styleGuidance = '简短确认已经理解这条信息或偏好，不要展开成长篇解释。'
  }

  if (params.safety.boundaryAction !== 'continue') {
    forbiddenMoves.push('intense_flirt', 'promise_real_world_action')
    intimacyLevel = 'low'
  }

  if (emotion.intensity >= 0.75 && emotion.valence === 'negative') {
    forbiddenMoves.push('intense_flirt', 'premature_advice')
    rhythm = rhythm === 'lively' ? 'soft' : rhythm
  }

  if (relationshipStage) {
    styleGuidance = `${styleGuidance} 关系阶段：${relationshipStage.displayName}；${relationshipStage.relationshipGuidance}`

    if (relationshipStage.intimacyPermission === 'low') {
      intimacyLevel = 'low'
      forbiddenMoves.push('intense_flirt')
    } else if (relationshipStage.intimacyPermission === 'high' && params.safety.boundaryAction === 'continue') {
      intimacyLevel = intimacyLevel === 'low' ? 'medium' : 'high'
    }

    if (relationshipStage.pacing === 'slow_down') {
      rhythm = 'soft'
      forbiddenMoves.push('premature_advice', 'pressure_to_disclose', 'intense_flirt')
      questionLimit = Math.min(questionLimit, 1)
      adviceLimit = Math.min(adviceLimit, 1)
      sentenceBudget.max = Math.min(sentenceBudget.max, 3)
    }

    if (relationshipStage.pacing === 'repair_first') {
      policy = 'relationship_repair'
      rhythm = 'soft'
      openingMove = 'apologize'
      allowedMoves = uniquePolicyMoves([...allowedMoves, 'repair_misunderstanding', 'validate_feeling'], 6)
      forbiddenMoves.push('intense_flirt', 'take_sides_aggressively', 'over_explain')
      questionLimit = Math.min(Math.max(questionLimit, 1), 1)
      adviceLimit = 0
      sentenceBudget.max = Math.min(sentenceBudget.max, 3)
    }

    if (relationshipStage.stage === 'new_connection') {
      forbiddenMoves.push('pressure_to_disclose', 'intense_flirt')
      questionLimit = Math.min(questionLimit, 1)
      styleGuidance = `${styleGuidance} 因为历史还少，回复要像刚认识但有好感的聊天，不要假装已经非常了解用户。`
    }

    if (relationshipStage.stage === 'close_bond' && params.safety.boundaryAction === 'continue') {
      allowedMoves = uniquePolicyMoves([...allowedMoves, 'offer_presence', 'mirror_emotion'], 6)
      styleGuidance = `${styleGuidance} 可以体现更多默契和熟悉感，但不要现实承诺、不要替用户做决定。`
    }
  }

  if (!route.shouldAskQuestion) {
    forbiddenMoves.push('multiple_questions')
    questionLimit = 0
  }

  if (!route.shouldGiveAdvice) {
    forbiddenMoves.push('premature_advice')
    adviceLimit = 0
  }

  return ReplyPolicySchema.parse({
    policy,
    sentenceBudget,
    rhythm,
    openingMove,
    allowedMoves: uniquePolicyMoves(allowedMoves, 6),
    forbiddenMoves: uniquePolicyMoves(forbiddenMoves, 8),
    questionLimit,
    adviceLimit,
    intimacyLevel,
    styleGuidance: styleGuidance.replace(/\s+/g, ' ').trim().slice(0, 700),
  })
}

function countReplySentences(text: string) {
  const normalized = normalizeStoredMessage(text)

  if (!normalized) {
    return 0
  }

  const matches = normalized.match(/[^。！？!?…\n]+[。！？!?…]*/g)
    ?.map((item) => item.trim())
    .filter(Boolean) ?? []

  return Math.max(1, matches.length)
}

function countPatternMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0)
}

function addReplyGuardViolation(
  violations: ReplyQualityGuard['violations'],
  violation: ReplyQualityGuard['violations'][number],
) {
  if (violations.some((item) => item.code === violation.code && item.evidence === violation.evidence)) {
    return
  }

  violations.push(violation)
}

function evaluateReplyQuality(params: {
  assistantText: string
  replyPolicy: ReplyPolicy | null
}): ReplyQualityGuard {
  const text = normalizeStoredMessage(params.assistantText)

  if (!text) {
    return fallbackReplyQualityGuard
  }

  const replyPolicy = params.replyPolicy ?? fallbackReplyPolicy
  const sentenceCount = countReplySentences(text)
  const questionCount = countPatternMatches(text, [/？/g, /\?/g])
  const advicePatterns = [
    /建议你/g,
    /你可以/g,
    /不妨/g,
    /最好/g,
    /应该/g,
    /试着/g,
    /尝试/g,
    /可以先/g,
  ]
  const adviceCount = countPatternMatches(text, advicePatterns)
  const violations: ReplyQualityGuard['violations'] = []

  if (sentenceCount > replyPolicy.sentenceBudget.max) {
    addReplyGuardViolation(violations, {
      code: 'too_many_sentences',
      severity: sentenceCount > replyPolicy.sentenceBudget.max + 2 ? 'high' : 'medium',
      evidence: `回复 ${sentenceCount} 句，超过策略上限 ${replyPolicy.sentenceBudget.max} 句。`,
    })
  }

  if (questionCount > replyPolicy.questionLimit) {
    addReplyGuardViolation(violations, {
      code: 'too_many_questions',
      severity: questionCount > replyPolicy.questionLimit + 1 ? 'high' : 'medium',
      evidence: `回复包含 ${questionCount} 个问号，超过策略上限 ${replyPolicy.questionLimit} 个。`,
    })
  }

  if (adviceCount > replyPolicy.adviceLimit) {
    addReplyGuardViolation(violations, {
      code: 'too_many_suggestions',
      severity: adviceCount > replyPolicy.adviceLimit + 1 ? 'high' : 'medium',
      evidence: `回复出现 ${adviceCount} 个建议型表达，超过策略上限 ${replyPolicy.adviceLimit} 个。`,
    })
  }

  if (/(intent|emotion|route|policy|safety|replyPolicy|relationshipStage|意图判断|情绪路由|回复策略|关系阶段|亲近度|安全边界|metadata)/i.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'internal_label_leak',
      severity: 'high',
      evidence: '回复疑似暴露内部策略、路由或 metadata 标签。',
    })
  }

  if (/(作为(?:一个)?AI|作为(?:一个)?人工智能|我只是(?:一个)?AI|我不能真正陪你|我没有真实情感|我没有身体|我是语言模型)/i.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'breaks_immersion',
      severity: 'high',
      evidence: '回复疑似破坏 AI 电子伴侣的沉浸感。',
    })
  }

  const forbiddenMoves = new Set(replyPolicy.forbiddenMoves)

  if (forbiddenMoves.has('lecture') && /(你要明白|你必须|你应该懂|正确的做法是|从理性角度来看)/.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_lecture',
      severity: 'medium',
      evidence: '回复疑似出现说教式表达。',
    })
  }

  if (forbiddenMoves.has('over_explain') && sentenceCount >= Math.max(replyPolicy.sentenceBudget.max + 2, 5)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_over_explain',
      severity: 'medium',
      evidence: '回复明显长于当前策略，疑似过度解释。',
    })
  }

  if (forbiddenMoves.has('premature_advice') && adviceCount > 0) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_premature_advice',
      severity: 'medium',
      evidence: '当前策略禁止过早建议，但回复出现建议型表达。',
    })
  }

  if (forbiddenMoves.has('intense_flirt') && /(亲亲|抱紧你|想亲你|想抱你|宝贝乖|今晚属于我|只属于我)/.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_intense_flirt',
      severity: 'high',
      evidence: '当前策略禁止强暧昧，但回复疑似过度亲密。',
    })
  }

  if (forbiddenMoves.has('diagnose_user') && /(你这是抑郁|你有焦虑症|你是回避型|你是依恋障碍|心理疾病)/.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_diagnosis',
      severity: 'high',
      evidence: '当前策略禁止诊断用户，但回复疑似使用诊断式表达。',
    })
  }

  if (forbiddenMoves.has('take_sides_aggressively') && /(他就是错了|她就是错了|别理他|拉黑他|报复|让他后悔)/.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_aggressive_siding',
      severity: 'high',
      evidence: '当前策略禁止激化冲突，但回复疑似强站队或拱火。',
    })
  }

  if (forbiddenMoves.has('pressure_to_disclose') && /(快告诉我|必须告诉我|别瞒着我|一定要说出来)/.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_pressure',
      severity: 'medium',
      evidence: '当前策略禁止施压披露，但回复疑似逼迫用户继续说明。',
    })
  }

  if (forbiddenMoves.has('promise_real_world_action') && /(我会去找你|我马上过去|我替你联系|我会一直在现实中陪你)/.test(text)) {
    addReplyGuardViolation(violations, {
      code: 'forbidden_real_world_promise',
      severity: 'high',
      evidence: '当前策略禁止现实行动承诺，但回复疑似做出现实承诺。',
    })
  }

  const highCount = violations.filter((item) => item.severity === 'high').length
  const mediumCount = violations.filter((item) => item.severity === 'medium').length
  const score = Math.max(0, 1 - highCount * 0.35 - mediumCount * 0.18 - (violations.length - highCount - mediumCount) * 0.08)
  const status: ReplyQualityGuard['status'] = highCount > 0 || score < 0.5
    ? 'fail'
    : violations.length > 0
      ? 'warn'
      : 'pass'

  return ReplyQualityGuardSchema.parse({
    status,
    score,
    sentenceCount,
    questionCount,
    adviceCount,
    violations: violations.slice(0, 12),
  })
}

const ConversationUnderstandingState = Annotation.Root({
  providerConfig: Annotation<ChatProviderConfig>(),
  agentName: Annotation<string>(),
  agentGuardrails: Annotation<string | null>(),
  safety: Annotation<ConversationSafety>(),
  activeMemories: Annotation<StoredAgentMemory[]>(),
  recentMessages: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>(),
  conversationSummary: Annotation<string | null>(),
  messageCount: Annotation<number>(),
  userText: Annotation<string>(),
  normalizedInput: Annotation<string>(),
  intent: Annotation<ConversationIntent | null>(),
  emotion: Annotation<ConversationEmotion | null>(),
  relationshipStage: Annotation<ConversationRelationshipStage | null>(),
  route: Annotation<EmotionRoute | null>(),
  replyPolicy: Annotation<ReplyPolicy | null>(),
  signal: Annotation<AbortSignal | undefined>(),
})

function normalizeUnderstandingInputNode(state: typeof ConversationUnderstandingState.State) {
  return {
    normalizedInput: normalizeStoredMessage(state.userText),
  }
}

async function classifyIntentNode(state: typeof ConversationUnderstandingState.State) {
  const userText = state.normalizedInput || normalizeStoredMessage(state.userText)

  if (!userText) {
    return {
      intent: normalizeConversationIntent({
        ...fallbackIntent,
        primary: 'casual_chat',
        confidence: 0.7,
        userNeed: 'feel_connected',
        requestedAgentAction: 'continue_topic',
        shouldClarify: false,
        clarifyingQuestion: null,
        promptGuidance: '用户没有提供明确新内容时，轻柔延续当前话题，不要制造压力。',
      }, state.safety),
    }
  }

  return {
    intent: await classifyConversationIntentWithLangChain({
      providerConfig: state.providerConfig,
      agentName: state.agentName,
      agentGuardrails: state.agentGuardrails,
      safety: state.safety,
      activeMemories: state.activeMemories,
      recentMessages: state.recentMessages,
      userText,
      signal: state.signal,
    }),
  }
}

async function detectEmotionNode(state: typeof ConversationUnderstandingState.State) {
  const userText = state.normalizedInput || normalizeStoredMessage(state.userText)

  if (!userText) {
    return {
      emotion: normalizeConversationEmotion(fallbackEmotion, state.safety),
    }
  }

  return {
    emotion: await detectConversationEmotionWithLangChain({
      providerConfig: state.providerConfig,
      agentName: state.agentName,
      agentGuardrails: state.agentGuardrails,
      safety: state.safety,
      intent: state.intent,
      activeMemories: state.activeMemories,
      recentMessages: state.recentMessages,
      userText,
      signal: state.signal,
    }),
  }
}

async function analyzeRelationshipStageNode(state: typeof ConversationUnderstandingState.State) {
  const userText = state.normalizedInput || normalizeStoredMessage(state.userText)

  return {
    relationshipStage: await analyzeRelationshipStageWithLangChain({
      providerConfig: state.providerConfig,
      agentName: state.agentName,
      agentGuardrails: state.agentGuardrails,
      safety: state.safety,
      intent: state.intent,
      emotion: state.emotion,
      activeMemories: state.activeMemories,
      recentMessages: state.recentMessages,
      conversationSummary: state.conversationSummary,
      messageCount: state.messageCount,
      userText,
      signal: state.signal,
    }),
  }
}

function routeEmotionNode(state: typeof ConversationUnderstandingState.State) {
  return {
    route: buildEmotionRoute({
      safety: state.safety,
      intent: state.intent,
      emotion: state.emotion,
      relationshipStage: state.relationshipStage,
    }),
  }
}

function buildReplyPolicyNode(state: typeof ConversationUnderstandingState.State) {
  return {
    replyPolicy: buildReplyPolicy({
      safety: state.safety,
      intent: state.intent,
      emotion: state.emotion,
      route: state.route,
      relationshipStage: state.relationshipStage,
    }),
  }
}

const conversationUnderstandingGraph = new StateGraph(ConversationUnderstandingState)
  .addNode('normalizeInput', normalizeUnderstandingInputNode)
  .addNode('classifyIntent', classifyIntentNode)
  .addNode('detectEmotion', detectEmotionNode)
  .addNode('analyzeRelationshipStage', analyzeRelationshipStageNode)
  .addNode('routeEmotion', routeEmotionNode)
  .addNode('buildReplyPolicy', buildReplyPolicyNode)
  .addEdge(START, 'normalizeInput')
  .addEdge('normalizeInput', 'classifyIntent')
  .addEdge('classifyIntent', 'detectEmotion')
  .addEdge('detectEmotion', 'analyzeRelationshipStage')
  .addEdge('analyzeRelationshipStage', 'routeEmotion')
  .addEdge('routeEmotion', 'buildReplyPolicy')
  .addEdge('buildReplyPolicy', END)
  .compile()

async function analyzeConversationUnderstanding(params: {
  providerConfig: ChatProviderConfig
  agentName: string
  agentGuardrails: string | null
  safety: ConversationSafety
  activeMemories: StoredAgentMemory[]
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  conversationSummary: string | null
  messageCount: number
  userText: string
  signal: AbortSignal
}): Promise<{
  intent: ConversationIntent
  emotion: ConversationEmotion
  relationshipStage: ConversationRelationshipStage
  route: EmotionRoute
  replyPolicy: ReplyPolicy
}> {
  try {
    const result = await conversationUnderstandingGraph.invoke({
      providerConfig: params.providerConfig,
      agentName: params.agentName,
      agentGuardrails: params.agentGuardrails,
      safety: params.safety,
      activeMemories: params.activeMemories,
      recentMessages: params.recentMessages,
      conversationSummary: params.conversationSummary,
      messageCount: params.messageCount,
      userText: params.userText,
      normalizedInput: '',
      intent: null,
      emotion: null,
      relationshipStage: null,
      route: null,
      replyPolicy: null,
      signal: params.signal,
    }, { signal: params.signal })
    const intent = result.intent ?? normalizeConversationIntent(fallbackIntent, params.safety)
    const emotion = result.emotion ?? normalizeConversationEmotion(fallbackEmotion, params.safety)
    const relationshipStage = result.relationshipStage ?? buildHeuristicRelationshipStage({
      safety: params.safety,
      intent,
      emotion,
      activeMemories: params.activeMemories,
      messageCount: params.messageCount,
    })
    const route = result.route ?? buildEmotionRoute({
      safety: params.safety,
      intent,
      emotion,
      relationshipStage,
    })

    return {
      intent,
      emotion,
      relationshipStage,
      route,
      replyPolicy: result.replyPolicy ?? buildReplyPolicy({
        safety: params.safety,
        intent,
        emotion,
        route,
        relationshipStage,
      }),
    }
  } catch (error) {
    console.warn('LangGraph conversation understanding analysis failed', error)
    const intent = normalizeConversationIntent(fallbackIntent, params.safety)
    const emotion = normalizeConversationEmotion(fallbackEmotion, params.safety)
    const relationshipStage = buildHeuristicRelationshipStage({
      safety: params.safety,
      intent,
      emotion,
      activeMemories: params.activeMemories,
      messageCount: params.messageCount,
    })
    const route = buildEmotionRoute({
      safety: params.safety,
      intent,
      emotion,
      relationshipStage,
    })

    return {
      intent,
      emotion,
      relationshipStage,
      route,
      replyPolicy: buildReplyPolicy({
        safety: params.safety,
        intent,
        emotion,
        route,
        relationshipStage,
      }),
    }
  }
}

function toConversationAnalysisMetadata(params: {
  safety: ConversationSafety
  intent: ConversationIntent | null
  emotion: ConversationEmotion | null
  relationshipStage: ConversationRelationshipStage | null
  route: EmotionRoute | null
  replyPolicy: ReplyPolicy | null
}) {
  return JSON.stringify({
    analysisVersion: 'conversation-understanding-v2',
    safety: params.safety,
    intent: params.intent,
    emotion: params.emotion,
    relationshipStage: params.relationshipStage,
    route: params.route,
    replyPolicy: params.replyPolicy,
  })
}

function toAssistantReplyQualityMetadata(params: {
  replyPolicy: ReplyPolicy | null
  guard: ReplyQualityGuard
}) {
  return JSON.stringify({
    analysisVersion: 'reply-quality-guard-v1',
    replyPolicy: params.replyPolicy,
    guard: params.guard,
  })
}

function getSafetySystemInstruction(safety: ConversationSafety) {
  if (safety.boundaryAction === 'continue') {
    return ''
  }

  return [
    '本轮安全边界判断：',
    `- 等级：${safety.safetyLevel}`,
    `- 分类：${safety.category}`,
    `- 动作：${safety.boundaryAction}`,
    `- 回复策略：${safety.responseGuidance}`,
    '请严格遵守该策略，优先保护用户与他人的现实安全、隐私和关系边界。',
  ].join('\n')
}

function getIntentSystemInstruction(intent: ConversationIntent | null) {
  if (!intent) {
    return ''
  }

  return [
    '本轮用户意图判断：',
    `- 主要意图：${intent.primary}（置信度 ${intent.confidence.toFixed(2)}）`,
    intent.secondary.length > 0 ? `- 次要意图：${intent.secondary.join('、')}` : '',
    `- 用户需要：${intent.userNeed}`,
    `- 建议动作：${intent.requestedAgentAction}`,
    `- 关系信号：${intent.relationshipSignal}`,
    `- 回复期待：深度 ${intent.replyExpectation.depth}，温度 ${intent.replyExpectation.warmth}，直接程度 ${intent.replyExpectation.directness}`,
    `- 是否追问：${intent.shouldClarify ? '是' : '否'}`,
    intent.shouldClarify && intent.clarifyingQuestion ? `- 可用追问：${intent.clarifyingQuestion}` : '',
    `- 回复指导：${intent.promptGuidance}`,
    '请把以上意图判断作为隐性策略，不要在回复中暴露分类标签。',
  ].filter(Boolean).join('\n')
}

function getEmotionRouteSystemInstruction(params: {
  emotion: ConversationEmotion | null
  route: EmotionRoute | null
}) {
  if (!params.emotion || !params.route) {
    return ''
  }

  const { emotion, route } = params

  return [
    '本轮情绪路由：',
    `- 主情绪：${emotion.primaryEmotion}`,
    emotion.secondaryEmotions.length > 0 ? `- 次要情绪：${emotion.secondaryEmotions.join('、')}` : '',
    `- 情绪强度：${emotion.intensity.toFixed(2)}`,
    `- 情绪倾向：${emotion.valence}`,
    `- 情绪激活：${emotion.arousal}`,
    `- 是否需要安慰：${emotion.needsComfort ? '是' : '否'}`,
    `- 是否需要降温：${emotion.needsDeescalation ? '是' : '否'}`,
    `- 回复语气：${emotion.replyTone}`,
    `- 回复路线：${route.route}`,
    `- 回复长度：${route.responseLength}`,
    `- 是否追问：${route.shouldAskQuestion ? '是' : '否'}`,
    `- 是否给建议：${route.shouldGiveAdvice ? '是' : '否'}`,
    `- 是否镜像情绪：${route.shouldMirrorEmotion ? '是' : '否'}`,
    `- 路由策略：${route.routeGuidance}`,
    '请把情绪路由作为回复策略：控制长度、语气和是否给建议，不要在回复中暴露这些标签。',
  ].filter(Boolean).join('\n')
}

function getRelationshipStageSystemInstruction(relationshipStage: ConversationRelationshipStage | null) {
  if (!relationshipStage) {
    return ''
  }

  return [
    '本轮关系阶段判断：',
    `- 阶段：${relationshipStage.displayName}（${relationshipStage.stage}）`,
    `- 亲近度：${relationshipStage.closenessScore}/100`,
    `- 信任等级：${relationshipStage.trustLevel}`,
    `- 稳定性：${relationshipStage.stability}`,
    `- 边界模式：${relationshipStage.boundaryMode}`,
    `- 允许亲密度：${relationshipStage.intimacyPermission}`,
    `- 推进节奏：${relationshipStage.pacing}`,
    relationshipStage.riskSignals.length > 0 ? `- 风险信号：${relationshipStage.riskSignals.join('、')}` : '',
    `- 关系指导：${relationshipStage.relationshipGuidance}`,
    '请把关系阶段作为隐性节奏控制：不要在回复中暴露阶段名称、分数或内部标签。',
  ].filter(Boolean).join('\n')
}

function getReplyPolicySystemInstruction(replyPolicy: ReplyPolicy | null) {
  if (!replyPolicy) {
    return ''
  }

  return [
    '本轮回复策略：',
    `- 策略：${replyPolicy.policy}`,
    `- 句数范围：${replyPolicy.sentenceBudget.min}-${replyPolicy.sentenceBudget.max} 句`,
    `- 节奏：${replyPolicy.rhythm}`,
    `- 开场动作：${replyPolicy.openingMove}`,
    `- 亲密度：${replyPolicy.intimacyLevel}`,
    `- 最多追问：${replyPolicy.questionLimit} 个问题`,
    `- 最多建议：${replyPolicy.adviceLimit} 条`,
    replyPolicy.allowedMoves.length > 0 ? `- 允许动作：${replyPolicy.allowedMoves.join('、')}` : '',
    replyPolicy.forbiddenMoves.length > 0 ? `- 禁止动作：${replyPolicy.forbiddenMoves.join('、')}` : '',
    `- 风格指导：${replyPolicy.styleGuidance}`,
    '这不是固定话术模板；请自然表达，但必须遵守以上策略约束，不要暴露策略名称或内部标签。',
  ].filter(Boolean).join('\n')
}

function getFeedbackSystemInstruction(feedbacks: StoredAgentMessageFeedback[]) {
  if (feedbacks.length === 0) {
    return ''
  }

  return [
    '近期用户对该 Agent 回复的反馈：',
    formatRecentMessageFeedbacks(feedbacks),
    '请把正向反馈视为用户偏好的表达风格，把负向反馈视为需要避免的问题；不要在回复中提到评分、点赞、点踩或反馈记录。',
  ].join('\n')
}

function buildBoundaryResponse(safety: ConversationSafety) {
  if (safety.boundaryAction === 'crisis_support') {
    return [
      '我听到你现在可能很难受。先别一个人硬扛，尽量把手边可能伤害自己的东西移远一点，去到更安全、有人能看见你的地方。',
      '如果你有立即伤害自己的可能，请现在联系当地紧急电话或身边可信的人，让他们陪你。你也可以告诉我：你现在是否安全、身边有没有人可以马上联系。',
    ].join('\n\n')
  }

  if (safety.boundaryAction === 'refuse') {
    return [
      '这个请求我不能直接帮你完成，因为它可能会伤害他人、侵犯隐私，或越过必要的安全边界。',
      safety.responseGuidance || '我可以换一种更安全、尊重边界的方式，帮你梳理真实需求和可行表达。',
    ].join('\n\n')
  }

  return ''
}

async function persistAgentMemoriesFromTurn(params: {
  db: ReturnType<typeof getDb>
  userId: string
  agentId: string
  agentName: string
  providerConfig: ChatProviderConfig
  previousSummary: string | null
  userText: string
  assistantText: string
  sourceMessageId: string
  signal?: AbortSignal
}) {
  const existingMemories = await listActiveAgentMemories({
    db: params.db,
    userId: params.userId,
    agentId: params.agentId,
    limit: 50,
  })
  const memoryCandidate = await judgeAgentMemoryCandidateWithLangChain({
    providerConfig: params.providerConfig,
    agentName: params.agentName,
    existingMemories,
    conversationSummary: params.previousSummary,
    userText: params.userText,
    assistantText: params.assistantText,
    signal: params.signal,
  })

  if (!memoryCandidate.shouldExtract) {
    console.info('Agent memory extraction skipped by candidate judgement', {
      userId: params.userId,
      agentId: params.agentId,
      sourceMessageId: params.sourceMessageId,
      category: memoryCandidate.category,
      confidence: memoryCandidate.confidence,
      reason: memoryCandidate.reason,
    })
    return
  }

  const candidateMemories = await extractAgentMemoriesWithLangChain({
    providerConfig: params.providerConfig,
    agentName: params.agentName,
    existingMemories,
    memoryCandidate,
    conversationSummary: params.previousSummary,
    userText: params.userText,
    assistantText: params.assistantText,
    signal: params.signal,
  })
  const existingMemoryContents = new Set(
    existingMemories.map((memory) => normalizeMemoryContent(memory.content)),
  )

  for (const memory of candidateMemories.slice(0, memoryExtractionLimit)) {
    const content = normalizeMemoryContent(memory.content)

    if (!content || existingMemoryContents.has(content)) {
      continue
    }

    await insertAgentMemory({
      db: params.db,
      id: crypto.randomUUID(),
      userId: params.userId,
      agentId: params.agentId,
      type: memory.type,
      content,
      importance: normalizeMemoryImportance(memory.importance),
      sourceMessageId: params.sourceMessageId,
      nowMs: Date.now(),
    })
    existingMemoryContents.add(content)
  }
}

function scheduleAgentMemoryExtraction(params: Parameters<typeof persistAgentMemoriesFromTurn>[0] & {
  c: Context<{ Bindings: ApiBindings }>
}) {
  const task = persistAgentMemoriesFromTurn(params).catch((error) => {
    console.warn('LangChain agent memory extraction failed', error)
  })

  try {
    params.c.executionCtx.waitUntil(task)
  } catch {
    return task
  }

  return Promise.resolve()
}

async function requireOwnedAgentConversation(params: {
  c: Context<{ Bindings: ApiBindings }>
  userId: string
  agentId: string
}) {
  const db = getDb(params.c.env.DB)
  const agent = await findUserAgentCompanionOwner(db, {
    userId: params.userId,
    agentId: params.agentId,
  })

  if (!agent) {
    throw authUnauthorizedError('Agent is not available')
  }

  const conversation = await getOrCreateDefaultAgentConversation({
    db,
    id: crypto.randomUUID(),
    userId: params.userId,
    agentId: params.agentId,
    title: agent.name,
    nowMs: Date.now(),
  })

  return {
    agent,
    conversation,
  }
}

async function saveLatestAssistantMessage(params: {
  c: Context<{ Bindings: ApiBindings }>
  userId: string
  agentId: string | undefined
  text: string
}) {
  const message = normalizeLatestAssistantMessage(params.text)

  if (!params.agentId || !message) {
    return
  }

  await updateUserAgentCompanionLatestAssistantMessage({
    db: getDb(params.c.env.DB),
    userId: params.userId,
    agentId: params.agentId,
    message,
    nowMs: Date.now(),
  })
}

async function saveAssistantTurn(params: {
  c: Context<{ Bindings: ApiBindings }>
  userId: string
  agentId: string | undefined
  agentName: string
  conversationId: string | undefined
  sourceUserMessageId: string | null
  userText: string
  assistantText: string
  providerConfig: ChatProviderConfig
  allowMemoryExtraction: boolean
  replyPolicy: ReplyPolicy | null
  previousSummary: string | null
  previousMessageCount: number
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
}) {
  const message = normalizeStoredMessage(params.assistantText)

  if (!params.agentId || !params.conversationId || !message) {
    await saveLatestAssistantMessage({
      c: params.c,
      userId: params.userId,
      agentId: params.agentId,
      text: params.assistantText,
    })
    return
  }

  const db = getDb(params.c.env.DB)
  const nowMs = Date.now()
  const assistantMessageId = crypto.randomUUID()
  const replyQualityGuard = evaluateReplyQuality({
    assistantText: message,
    replyPolicy: params.replyPolicy,
  })
  await insertAgentConversationMessage({
    db,
    id: assistantMessageId,
    conversationId: params.conversationId,
    userId: params.userId,
    agentId: params.agentId,
    role: 'assistant',
    content: message,
    status: 'completed',
    metadataJson: toAssistantReplyQualityMetadata({
      replyPolicy: params.replyPolicy,
      guard: replyQualityGuard,
    }),
    nowMs,
  })
  const nextSummary = buildConversationSummary({
    previousSummary: params.previousSummary,
    recentMessages: params.recentMessages,
    userText: params.userText,
    assistantText: message,
  })
  await updateAgentConversationAfterMessage({
    db,
    userId: params.userId,
    agentId: params.agentId,
    conversationId: params.conversationId,
    summary: nextSummary,
    messageCount: params.previousMessageCount + (params.sourceUserMessageId ? 2 : 1),
    lastMessageAtMs: nowMs,
    nowMs,
  })
  await saveLatestAssistantMessage({
    c: params.c,
    userId: params.userId,
    agentId: params.agentId,
    text: message,
  })

  if (!params.allowMemoryExtraction) {
    return
  }

  await scheduleAgentMemoryExtraction({
    c: params.c,
    db,
    userId: params.userId,
    agentId: params.agentId,
    agentName: params.agentName,
    providerConfig: params.providerConfig,
    previousSummary: params.previousSummary,
    userText: params.userText,
    assistantText: message,
    sourceMessageId: params.sourceUserMessageId ?? assistantMessageId,
  })
}

inboxChatRoute.get('/:agentId/conversation', async (c) => {
  const claims = await requireWebAccessToken(c)
  const agentId = c.req.param('agentId')?.trim()
  const db = getDb(c.env.DB)

  if (!agentId) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Agent id is required', 400)
  }

  const { agent, conversation } = await requireOwnedAgentConversation({
    c,
    userId: claims.sub,
    agentId,
  })
  await markAgentCareEventsRead({
    db,
    userId: claims.sub,
    agentId,
    nowMs: Date.now(),
  })
  const messages = await listAgentConversationMessages({
    db,
    userId: claims.sub,
    agentId,
    conversationId: conversation.id,
    limit: initialHistoryLimit,
  })
  const res = AgentConversationResponseSchema.parse({
    conversationId: conversation.id,
    agentId,
    title: conversation.title,
    summary: conversation.summary,
    messageCount: conversation.messageCount,
    openingMessage: agent.openingMessage,
    messages: messages.map(toConversationMessageResponse),
    nextCursor: getOldestMessageCursor(messages, initialHistoryLimit),
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

inboxChatRoute.get('/:agentId/messages', async (c) => {
  const claims = await requireWebAccessToken(c)
  const agentId = c.req.param('agentId')?.trim()
  const cursor = c.req.query('cursor')?.trim()
  const beforeMs = cursor ? Number(cursor) : undefined

  if (!agentId) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Agent id is required', 400)
  }

  if (cursor && (!Number.isFinite(beforeMs) || beforeMs! <= 0)) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Invalid cursor', 400)
  }

  const { conversation } = await requireOwnedAgentConversation({
    c,
    userId: claims.sub,
    agentId,
  })
  const messages = await listAgentConversationMessages({
    db: getDb(c.env.DB),
    userId: claims.sub,
    agentId,
    conversationId: conversation.id,
    beforeMs,
    limit: initialHistoryLimit,
  })
  const res = AgentConversationMessagesResponseSchema.parse({
    messages: messages.map(toConversationMessageResponse),
    nextCursor: getOldestMessageCursor(messages, initialHistoryLimit),
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

inboxChatRoute.post(
  '/:agentId/messages/:messageId/feedback',
  zValidator(
    'json',
    SubmitAgentMessageFeedbackRequestSchema,
    buildValidationErrorHandler('Invalid message feedback payload'),
  ),
  async (c) => {
    const claims = await requireWebAccessToken(c)
    const agentId = c.req.param('agentId')?.trim()
    const messageId = c.req.param('messageId')?.trim()

    if (!agentId || !messageId) {
      throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Agent id and message id are required', 400)
    }

    await requireOwnedAgentConversation({
      c,
      userId: claims.sub,
      agentId,
    })

    const db = getDb(c.env.DB)
    const message = await findAgentConversationMessageForFeedback({
      db,
      userId: claims.sub,
      agentId,
      messageId,
    })

    if (!message) {
      throw new AppError(BizCode.COMMON_NOT_FOUND, 'Assistant message not found', 404)
    }

    const payload = c.req.valid('json')
    const nowMs = Date.now()
    const feedback = await upsertAgentMessageFeedback({
      db,
      id: crypto.randomUUID(),
      userId: claims.sub,
      agentId,
      conversationId: message.conversationId,
      messageId: message.id,
      rating: payload.rating,
      reason: payload.reason ?? null,
      note: payload.note?.trim() || null,
      nowMs,
    })
    const res = SubmitAgentMessageFeedbackResponseSchema.parse({
      messageId: message.id,
      feedback,
    })

    return c.json(buildSuccess(res, createApiMeta()))
  },
)

inboxChatRoute.post(
  '/',
  zValidator(
    'json',
    InboxChatRequestSchema,
    buildValidationErrorHandler('Invalid chat payload'),
  ),
  async (c) => {
    const claims = await requireWebAccessToken(c)

    const env = getApiEnv(c.env)
    const payload = c.req.valid('json')
    const providerConfig = resolveChatProviderConfig({ payload, env })
    const agentId = payload.conversation.id
    const db = getDb(c.env.DB)
    const ownedConversation = agentId
      ? await requireOwnedAgentConversation({
          c,
          userId: claims.sub,
          agentId,
        })
      : null
    const conversationId = ownedConversation?.conversation.id ?? payload.conversationId
    const agentPrompt = agentId
      ? await findUserAgentCompanionPrompt(db, {
          userId: claims.sub,
          agentId,
        })
      : null
    const storedRecentMessages = agentId && conversationId
      ? await listAgentConversationMessages({
          db,
          userId: claims.sub,
          agentId,
          conversationId,
          limit: recentMessageLimit,
        })
      : []
    const activeMemories = agentId
      ? await listActiveAgentMemories({
          db,
          userId: claims.sub,
          agentId,
          limit: memoryInjectionLimit,
        })
      : []
    const recentFeedbacks = agentId
      ? await listRecentAgentMessageFeedbacks({
          db,
          userId: claims.sub,
          agentId,
          limit: messageFeedbackInjectionLimit,
        })
      : []
    const latestPayloadUserMessage = [...payload.messages]
      .reverse()
      .find((message) => message.role === 'user' && extractText(message))
    const latestUserText = latestPayloadUserMessage ? normalizeStoredMessage(extractText(latestPayloadUserMessage)) : ''
    const safety = await analyzeConversationSafety({
      providerConfig,
      agentName: payload.conversation.name,
      agentGuardrails: agentPrompt?.guardrailsPrompt ?? null,
      activeMemories,
      recentMessages: storedRecentMessages,
      userText: latestUserText,
      signal: c.req.raw.signal,
    })
    const boundaryResponse = buildBoundaryResponse(safety)
    const understanding = boundaryResponse
      ? null
      : await analyzeConversationUnderstanding({
          providerConfig,
          agentName: payload.conversation.name,
          agentGuardrails: agentPrompt?.guardrailsPrompt ?? null,
          safety,
          activeMemories,
          recentMessages: storedRecentMessages,
          conversationSummary: ownedConversation?.conversation.summary ?? null,
          messageCount: ownedConversation?.conversation.messageCount ?? storedRecentMessages.length,
          userText: latestUserText,
          signal: c.req.raw.signal,
        })
    const intent = understanding?.intent ?? null
    const emotion = understanding?.emotion ?? null
    const relationshipStage = understanding?.relationshipStage ?? null
    const route = understanding?.route ?? null
    const replyPolicy = understanding?.replyPolicy ?? null
    let sourceUserMessageId: string | null = null

    if (agentId && conversationId && latestUserText) {
      sourceUserMessageId = crypto.randomUUID()
      const userMessageNowMs = Date.now()

      await insertAgentConversationMessage({
        db,
        id: sourceUserMessageId,
        conversationId,
        userId: claims.sub,
        agentId,
        role: 'user',
        content: latestUserText,
        status: 'completed',
        metadataJson: toConversationAnalysisMetadata({
          safety,
          intent,
          emotion,
          relationshipStage,
          route,
          replyPolicy,
        }),
        nowMs: userMessageNowMs,
      })
      await updateAgentConversationAfterMessage({
        db,
        userId: claims.sub,
        agentId,
        conversationId,
        summary: ownedConversation?.conversation.summary ?? null,
        messageCount: (ownedConversation?.conversation.messageCount ?? 0) + 1,
        lastMessageAtMs: userMessageNowMs,
        nowMs: userMessageNowMs,
      })
    }

    if (boundaryResponse) {
      await saveAssistantTurn({
        c,
        userId: claims.sub,
        agentId,
        agentName: payload.conversation.name,
        conversationId,
        sourceUserMessageId,
        userText: latestUserText,
        assistantText: boundaryResponse,
        providerConfig,
        allowMemoryExtraction: safety.allowMemoryExtraction,
        replyPolicy,
        previousSummary: ownedConversation?.conversation.summary ?? null,
        previousMessageCount: ownedConversation?.conversation.messageCount ?? 0,
        recentMessages: storedRecentMessages,
      })

      return buildTextStreamResponse(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(boundaryResponse))
          controller.close()
        },
      }))
    }

    const skillTurn = await executeConfiguredSkillTurn({
      db,
      userId: claims.sub,
      scope: 'single_chat',
      userText: latestUserText,
      sourceMessageId: sourceUserMessageId ?? crypto.randomUUID(),
      bindingTargets: [
        ...(ownedConversation?.conversation.id
          ? [{ scopeType: 'conversation' as const, scopeId: ownedConversation.conversation.id }]
          : []),
        ...(agentId
          ? [{ scopeType: 'agent' as const, scopeId: agentId }]
          : []),
        { scopeType: 'user', scopeId: claims.sub },
      ],
      sessionTarget: ownedConversation?.conversation.id
        ? { scopeType: 'conversation', scopeId: ownedConversation.conversation.id }
        : { scopeType: 'agent', scopeId: agentId },
      agentId,
      conversationId,
    })

    const messages: ChatCompletionMessage[] = [
      {
        role: 'system',
        content: [
          agentPrompt?.defaultPrompt || '你是 AI Agent Web 控制台里的聊天陪伴助手。',
          '请基于当前聊天对象、关系氛围和用户意图，用简洁、自然的中文回答用户。',
          '如果用户要求起草回复，请直接给出可发送的聊天内容，避免正式公文格式和职场汇报语气。',
          '你的建议应尊重双方边界，避免操控式话术、制造焦虑或诱导过度解读。',
          getSafetySystemInstruction(safety),
          getIntentSystemInstruction(intent),
          getEmotionRouteSystemInstruction({ emotion, route }),
          getRelationshipStageSystemInstruction(relationshipStage),
          getReplyPolicySystemInstruction(replyPolicy),
          skillTurn.systemInstruction,
          getFeedbackSystemInstruction(recentFeedbacks),
          activeMemories.length > 0
            ? [
                '以下是用户与该 Agent 的长期记忆，请优先尊重：',
                ...activeMemories.map((memory) => `- [${memory.type} / 重要度 ${memory.importance}] ${memory.content}`),
              ].join('\n')
            : '',
          ownedConversation?.conversation.summary
            ? `此前对话摘要：${ownedConversation.conversation.summary}`
            : '',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `聊天对象：${payload.conversation.name}（${payload.conversation.handle}）`,
          `对象状态：${payload.conversation.status}，${payload.conversation.lastActive}`,
          `关系阶段：${relationshipStage?.displayName ?? payload.conversation.relationship}`,
          `聊天主题：${payload.conversation.headline}`,
          `共同点：${payload.conversation.topic}`,
          `心动值：${payload.conversation.chemistryLabel} ${payload.conversation.chemistry}`,
          `互动节奏：${payload.conversation.rhythm}`,
          `对象备注：${payload.conversation.profileNote}`,
        ].join('\n'),
      },
    ]

    const promptHistory = storedRecentMessages.length > 0
      ? storedRecentMessages
      : payload.messages.map((message) => ({
          role: message.role,
          content: extractText(message),
        }))

    for (const message of promptHistory) {
      const text = normalizeStoredMessage(message.content)

      if (!text) {
        continue
      }

      messages.push({ role: message.role, content: text })
    }

    if (storedRecentMessages.length > 0 && latestUserText) {
      messages.push({ role: 'user', content: latestUserText })
    }

    const upstreamResult = await fetchUpstreamChat({
      providerConfig,
      messages,
      signal: c.req.raw.signal,
    })
    const upstream = upstreamResult.upstream
    const effectiveProviderConfig: ChatProviderConfig = {
      ...providerConfig,
      wireApi: upstreamResult.wireApi,
    }

    if (!upstream.ok) {
      console.warn('Chat stream failed', {
        status: upstream.status,
        wireApi: upstreamResult.wireApi,
        retriedFromWireApi: upstreamResult.retriedFromWireApi,
      })

      throw new AppError(
        BizCode.SYSTEM_INTERNAL_ERROR,
        'Chat stream failed',
        500,
      )
    }

    const upstreamContentType = upstream.headers.get('content-type') ?? ''

    if (!upstreamContentType.includes('text/event-stream')) {
      const upstreamText = await upstream.text()
      const responseText = looksLikeHtmlPayload(upstreamText)
        ? htmlUpstreamMessage
        : extractTextFromRawPayload(upstreamText) || emptyUpstreamMessage

      await saveAssistantTurn({
        c,
        userId: claims.sub,
        agentId,
        agentName: payload.conversation.name,
        conversationId,
        sourceUserMessageId,
        userText: latestUserText,
        assistantText: responseText,
        providerConfig: effectiveProviderConfig,
        allowMemoryExtraction: safety.allowMemoryExtraction,
        replyPolicy,
        previousSummary: ownedConversation?.conversation.summary ?? null,
        previousMessageCount: ownedConversation?.conversation.messageCount ?? 0,
        recentMessages: storedRecentMessages,
      })

      return buildTextStreamResponse(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(responseText))
          controller.close()
        },
      }))
    }

    const textStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()
        const reader = upstream.body?.getReader()
        let buffer = ''
        let closed = false
        let hasContent = false
        let assistantMessageText = ''

        if (!reader) {
          controller.enqueue(encoder.encode(emptyUpstreamMessage))
          await saveAssistantTurn({
            c,
            userId: claims.sub,
            agentId,
            agentName: payload.conversation.name,
            conversationId,
            sourceUserMessageId,
            userText: latestUserText,
            assistantText: emptyUpstreamMessage,
            providerConfig: effectiveProviderConfig,
            allowMemoryExtraction: safety.allowMemoryExtraction,
            replyPolicy,
            previousSummary: ownedConversation?.conversation.summary ?? null,
            previousMessageCount: ownedConversation?.conversation.messageCount ?? 0,
            recentMessages: storedRecentMessages,
          })
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              buffer += decoder.decode()
              break
            }

            buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const result = extractTextFromStreamLine(line, { allowCompletedPayload: !hasContent })

              if (result.done) {
                if (!hasContent) {
                  controller.enqueue(encoder.encode(emptyUpstreamMessage))
                  assistantMessageText += emptyUpstreamMessage
                }

                await saveAssistantTurn({
                  c,
                  userId: claims.sub,
                  agentId,
                  agentName: payload.conversation.name,
                  conversationId,
                  sourceUserMessageId,
                  userText: latestUserText,
                  assistantText: assistantMessageText,
                  providerConfig: effectiveProviderConfig,
                  allowMemoryExtraction: safety.allowMemoryExtraction,
                  replyPolicy,
                  previousSummary: ownedConversation?.conversation.summary ?? null,
                  previousMessageCount: ownedConversation?.conversation.messageCount ?? 0,
                  recentMessages: storedRecentMessages,
                })
                closed = true
                controller.close()
                break
              }

              if (result.text) {
                hasContent = true
                assistantMessageText += result.text
                controller.enqueue(encoder.encode(result.text))
              }
            }

            if (closed) {
              break
            }
          }

          if (!closed && buffer.trim()) {
            const result = extractTextFromStreamLine(buffer, { allowCompletedPayload: !hasContent })

            if (result.text) {
              hasContent = true
              assistantMessageText += result.text
              controller.enqueue(encoder.encode(result.text))
            }
          }

          if (!closed) {
            if (!hasContent) {
              controller.enqueue(encoder.encode(emptyUpstreamMessage))
              assistantMessageText += emptyUpstreamMessage
            }

            await saveAssistantTurn({
              c,
              userId: claims.sub,
              agentId,
              agentName: payload.conversation.name,
              conversationId,
              sourceUserMessageId,
              userText: latestUserText,
              assistantText: assistantMessageText,
              providerConfig: effectiveProviderConfig,
              allowMemoryExtraction: safety.allowMemoryExtraction,
              replyPolicy,
              previousSummary: ownedConversation?.conversation.summary ?? null,
              previousMessageCount: ownedConversation?.conversation.messageCount ?? 0,
              recentMessages: storedRecentMessages,
            })
            controller.close()
          }
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return buildTextStreamResponse(textStream)
  },
)

export default inboxChatRoute
