import type {
  CompanionSkillBindingSource,
  CompanionSkillManifest,
  CompanionSkillSelection,
  CompanionSkillSessionStatus,
} from '@repo/contracts'
import type { z } from 'zod'
import type { ApiDb } from '@/db/client'

export type PromptSkillDefinition = {
  manifest: CompanionSkillManifest & { kind: 'prompt' }
  instructions: string
  matchers: {
    keywords: readonly string[]
    patterns: readonly RegExp[]
  }
}

export type SelectedPromptSkill = {
  definition: PromptSkillDefinition
  selection: CompanionSkillSelection
}

export type WorkflowSkillTurnOutput = {
  state: unknown
  currentStep: string
  status: Extract<CompanionSkillSessionStatus, 'waiting_user' | 'completed'>
  pendingQuestion: string | null
  systemInstruction: string
}

export type WorkflowSkillDefinition = {
  manifest: CompanionSkillManifest & { kind: 'workflow' }
  sessionTtlMs: number
  initialStep: string
  matchers: {
    keywords: readonly string[]
    patterns: readonly RegExp[]
  }
  createInitialState: () => unknown
  parseState: (value: unknown) => unknown
  runTurn: (input: {
    state: unknown
    userText: string
    isNewSession: boolean
  }) => Promise<WorkflowSkillTurnOutput>
}

export type SelectedWorkflowSkill = {
  definition: WorkflowSkillDefinition
  selection: CompanionSkillSelection
}

export type ToolSkillDefinition = {
  manifest: CompanionSkillManifest & { kind: 'tool' }
  toolId: string
  timeoutMs: number
  maxCallsPerTurn: number
  inputSchema: z.ZodType
  outputSchema: z.ZodType
  matchers: {
    keywords: readonly string[]
    patterns: readonly RegExp[]
  }
  buildInput: (input: {
    userText: string
    agentId: string | null
  }) => unknown
  execute: (input: {
    db: ApiDb
    userId: string
    value: unknown
    signal: AbortSignal
  }) => Promise<unknown>
  buildSystemInstruction: (output: unknown) => string
}

export type SelectedToolSkill = {
  definition: ToolSkillDefinition
  selection: CompanionSkillSelection
}

export type ToolSkillExecutionOutput = {
  status: 'completed' | 'denied' | 'failed'
  systemInstruction: string
}

export type BackgroundSkillDefinition = {
  manifest: CompanionSkillManifest & { kind: 'background' }
  payloadSchema: z.ZodType
  maxAttempts: number
  execute: (input: {
    db: ApiDb
    userId: string
    jobId: string
    value: unknown
  }) => Promise<void>
}

export type ResolvedPromptSkill = {
  selection: CompanionSkillSelection | null
  bindingSource: CompanionSkillBindingSource | null
  runId: string | null
  systemInstruction: string
}
