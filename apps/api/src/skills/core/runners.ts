import type { CompanionSkillBindingSource, CompanionSkillScope } from '@repo/contracts'
import { uuidv7 } from 'uuidv7'
import {
  completeSkillToolExecution,
  createSkillToolExecution,
  insertSkillAuditEvent,
} from '../controlled-repository'
import { resolvePromptSkill } from './prompt'
import { evaluateSkillPolicy, type SkillPermissionTarget } from './policy-gate'
import type { ApiDb } from '@/db/client'
import type { ToolSkillDefinition, WorkflowSkillDefinition } from './types'
import type { ResolvedPromptSkill, ToolSkillExecutionOutput, WorkflowSkillTurnOutput } from './types'

export type SkillRunner<
  Kind extends 'prompt' | 'workflow' | 'tool',
  Input,
  Output,
> = {
  readonly kind: Kind
  run: (input: Input) => Output
}

type PromptSkillRunnerInput = {
  scope: CompanionSkillScope
  userText: string
  availableSkillIds: readonly string[]
  availableSkillVersions: Readonly<Record<string, string>>
  bindingSources: Readonly<Record<string, CompanionSkillBindingSource>>
}

type WorkflowSkillRunnerInput = {
  definition: WorkflowSkillDefinition
  state: unknown
  userText: string
  isNewSession: boolean
}

type ToolSkillRunnerInput = {
  db: ApiDb
  userId: string
  agentId: string | null
  userText: string
  sourceMessageId: string
  definition: ToolSkillDefinition
  policyTargets: readonly SkillPermissionTarget[]
}

export const promptSkillRunner: SkillRunner<'prompt', PromptSkillRunnerInput, ResolvedPromptSkill> = {
  kind: 'prompt' as const,
  run(input) {
    return resolvePromptSkill(input)
  },
}

export const workflowSkillRunner: SkillRunner<
  'workflow',
  WorkflowSkillRunnerInput,
  Promise<WorkflowSkillTurnOutput>
> = {
  kind: 'workflow' as const,
  run(input) {
    return input.definition.runTurn({
      state: input.definition.parseState(input.state),
      userText: input.userText,
      isNewSession: input.isNewSession,
    })
  },
}

async function digestInput(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const toolSkillRunner: SkillRunner<
  'tool',
  ToolSkillRunnerInput,
  Promise<ToolSkillExecutionOutput>
> = {
  kind: 'tool' as const,
  async run(input) {
    const { definition } = input
    const policy = await evaluateSkillPolicy({
      db: input.db,
      userId: input.userId,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      requirements: definition.manifest.permissions ?? [],
      targets: input.policyTargets,
      action: 'tool.execute',
      targetId: input.sourceMessageId,
    })

    if (!policy.allowed) {
      return {
        status: 'denied',
        systemInstruction: [
          `当前请求需要用户授权 ${policy.missing.map((item) => item.code).join('、')} 权限。`,
          '请自然地说明此能力尚未获授权，并提示用户可前往 Skills 页面开启；不要假装已经读取数据，也不要提及 PolicyGate 或内部实现。',
        ].join('\n'),
      }
    }

    const rawInput = definition.buildInput({ userText: input.userText, agentId: input.agentId })
    const parsedInput = definition.inputSchema.safeParse(rawInput)

    if (!parsedInput.success) {
      await insertSkillAuditEvent({
        db: input.db,
        id: uuidv7(),
        userId: input.userId,
        skillId: definition.manifest.id,
        skillVersion: definition.manifest.version,
        action: 'tool.execute',
        decision: 'failed',
        reason: 'Tool input validation failed',
        scopeType: input.policyTargets[0]?.scopeType ?? 'user',
        scopeId: input.policyTargets[0]?.scopeId ?? input.userId,
        targetId: input.sourceMessageId,
        nowMs: Date.now(),
      })
      return {
        status: 'failed',
        systemInstruction: '记忆检索的请求参数无效。请自然地向用户说明现在无法完成检索，并邀请用户换一种更明确的问法；不要暴露内部错误。',
      }
    }

    const executionId = uuidv7()
    const startedAtMs = Date.now()
    const created = await createSkillToolExecution({
      db: input.db,
      id: executionId,
      userId: input.userId,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      toolId: definition.toolId,
      sourceMessageId: input.sourceMessageId,
      idempotencyKey: `${input.userId}:${definition.toolId}:${input.sourceMessageId}`,
      inputDigest: await digestInput(parsedInput.data),
      nowMs: startedAtMs,
    })
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | null = null

    try {
      const output = await Promise.race([
        definition.execute({
          db: input.db,
          userId: input.userId,
          value: parsedInput.data,
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            controller.abort()
            reject(new Error('TOOL_TIMEOUT'))
          }, definition.timeoutMs)
        }),
      ])
      const parsedOutput = definition.outputSchema.parse(output)
      const nowMs = Date.now()

      if (created) {
        await completeSkillToolExecution({ db: input.db, id: executionId, status: 'completed', latencyMs: nowMs - startedAtMs, nowMs })
      }
      try {
        await insertSkillAuditEvent({
          db: input.db,
          id: uuidv7(),
          userId: input.userId,
          skillId: definition.manifest.id,
          skillVersion: definition.manifest.version,
          action: 'tool.execute',
          decision: 'succeeded',
          reason: 'Tool completed with validated output',
          scopeType: input.policyTargets[0]?.scopeType ?? 'user',
          scopeId: input.policyTargets[0]?.scopeId ?? input.userId,
          targetId: input.sourceMessageId,
          metadata: { toolId: definition.toolId, outputPersisted: false },
          nowMs,
        })
      } catch (error) {
        console.error('Failed to record successful Tool Skill audit', error)
      }
      return { status: 'completed', systemInstruction: definition.buildSystemInstruction(parsedOutput) }
    } catch (error) {
      const nowMs = Date.now()
      const timedOut = error instanceof Error && error.message === 'TOOL_TIMEOUT'
      if (created) {
        await completeSkillToolExecution({
          db: input.db,
          id: executionId,
          status: timedOut ? 'timed_out' : 'failed',
          latencyMs: nowMs - startedAtMs,
          errorCode: timedOut ? 'TIMEOUT' : 'EXECUTION_FAILED',
          nowMs,
        })
      }
      await insertSkillAuditEvent({
        db: input.db,
        id: uuidv7(),
        userId: input.userId,
        skillId: definition.manifest.id,
        skillVersion: definition.manifest.version,
        action: 'tool.execute',
        decision: 'failed',
        reason: timedOut ? 'Tool execution timed out' : 'Tool execution failed',
        scopeType: input.policyTargets[0]?.scopeType ?? 'user',
        scopeId: input.policyTargets[0]?.scopeId ?? input.userId,
        targetId: input.sourceMessageId,
        metadata: { toolId: definition.toolId },
        nowMs,
      })
      return {
        status: 'failed',
        systemInstruction: '记忆检索当前暂时不可用。请简短向用户说明无法完成这次检索，并建议稍后重试；不要编造结果或暴露内部错误。',
      }
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  },
}
