import { uuidv7 } from 'uuidv7'
import type {
  CompanionSkillBindingSource,
  CompanionSkillScope,
} from '@repo/contracts'
import type { ApiDb } from '@/db/client'
import { insertSkillRun, listSkillBindingsForUser } from '../repository'
import { resolvePromptSkillAvailability, type ResolvedSkillBindingTarget } from './bindings'
import { resolvePromptSkill } from './prompt'

export async function resolveConfiguredPromptSkill(params: {
  db: ApiDb
  userId: string
  scope: CompanionSkillScope
  userText: string
  targets: readonly ResolvedSkillBindingTarget[]
  agentId?: string | null
  groupChatId?: string | null
  conversationId?: string | null
}) {
  const startedAtMs = Date.now()
  const bindings = await listSkillBindingsForUser(params.db, params.userId)
  const availability = resolvePromptSkillAvailability({
    scope: params.scope,
    bindings,
    targets: params.targets,
  })
  const resolved = resolvePromptSkill({
    scope: params.scope,
    userText: params.userText,
    availableSkillIds: availability.availableSkillIds,
    availableSkillVersions: availability.availableSkillVersions,
    bindingSources: availability.bindingSources,
  })

  if (!resolved.selection || !resolved.bindingSource) {
    return resolved
  }

  const runId = uuidv7()
  const completedAtMs = Date.now()

  let recordedRunId: string | null = null

  try {
    await insertSkillRun({
      db: params.db,
      id: runId,
      userId: params.userId,
      skillId: resolved.selection.skillId,
      skillVersion: resolved.selection.skillVersion,
      skillKind: resolved.selection.skillKind,
      sessionId: null,
      chatScope: params.scope,
      bindingSource: resolved.bindingSource as CompanionSkillBindingSource,
      trigger: resolved.selection.trigger,
      score: resolved.selection.score,
      reason: resolved.selection.reason,
      status: 'completed',
      agentId: params.agentId ?? null,
      groupChatId: params.groupChatId ?? null,
      conversationId: params.conversationId ?? null,
      latencyMs: completedAtMs - startedAtMs,
      createdAtMs: startedAtMs,
      completedAtMs,
    })
    recordedRunId = runId
  } catch (error) {
    console.error('Failed to record Prompt Skill run', error)
  }

  return {
    ...resolved,
    runId: recordedRunId,
  }
}
