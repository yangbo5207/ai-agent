import { uuidv7 } from 'uuidv7'
import type {
  CompanionSkillBindingSource,
  CompanionSkillScope,
  CompanionSkillSelection,
  CompanionSkillSessionScopeType,
} from '@repo/contracts'
import { BizCode } from '@repo/contracts'
import type { ApiDb } from '@/db/client'
import { AppError } from '@/lib/app-error'
import {
  cancelSkillSession,
  createSkillSession,
  failSkillSession,
  findActiveSkillSession,
  findProcessedSkillSessionTurn,
  insertSkillRun,
  listSkillBindingsForUser,
  updateSkillSessionTurn,
  type SkillSessionRecord,
} from '../repository'
import {
  resolvePromptSkillAvailability,
  resolveToolSkillAvailability,
  resolveWorkflowSkillAvailability,
  type ResolvedSkillBindingTarget,
} from './bindings'
import { promptSkillRunner, toolSkillRunner, workflowSkillRunner } from './runners'
import type { ResolvedPromptSkill, WorkflowSkillDefinition } from './types'
import { getWorkflowSkill } from './workflow-registry'
import { selectWorkflowSkill } from './workflow-selector'
import { selectToolSkill } from './tool-selector'

const cancellationInstruction = [
  '用户已经取消当前的长期目标规划任务。',
  '请用当前 Agent 的自然语气简短确认已经停止，不要继续追问规划信息，也不要提及 Workflow、Session 或内部状态。',
].join('\n')

function isWorkflowCancellationRequest(userText: string) {
  const normalized = userText.trim().toLowerCase()
  return /(?:^|\s)\/(?:cancel-skill|cancel-workflow)(?=\s|$)/i.test(normalized)
    || /^(?:取消|停止|结束)(?:当前|这次|这个)?(?:长期)?(?:目标)?规划[。！!]?$/i.test(normalized)
}

function buildSessionSelection(params: {
  session: SkillSessionRecord
  reason: string
}): CompanionSkillSelection {
  return {
    skillId: params.session.skillId,
    skillVersion: params.session.skillVersion,
    skillKind: 'workflow',
    trigger: 'session',
    score: 100,
    reason: params.reason,
  }
}

async function recordSkillRun(params: {
  db: ApiDb
  userId: string
  selection: CompanionSkillSelection
  bindingSource: CompanionSkillBindingSource
  sessionId: string | null
  scope: CompanionSkillScope
  status: 'waiting_user' | 'completed' | 'denied' | 'cancelled' | 'failed'
  agentId?: string | null
  groupChatId?: string | null
  conversationId?: string | null
  startedAtMs: number
}) {
  const runId = uuidv7()
  const completedAtMs = Date.now()

  try {
    await insertSkillRun({
      db: params.db,
      id: runId,
      userId: params.userId,
      skillId: params.selection.skillId,
      skillVersion: params.selection.skillVersion,
      skillKind: params.selection.skillKind,
      sessionId: params.sessionId,
      chatScope: params.scope,
      bindingSource: params.bindingSource,
      trigger: params.selection.trigger,
      score: params.selection.score,
      reason: params.selection.reason,
      status: params.status,
      agentId: params.agentId ?? null,
      groupChatId: params.groupChatId ?? null,
      conversationId: params.conversationId ?? null,
      latencyMs: completedAtMs - params.startedAtMs,
      createdAtMs: params.startedAtMs,
      completedAtMs,
    })
    return runId
  } catch (error) {
    console.error('Failed to record Skill run', error)
    return null
  }
}

export type ResolvedSkillTurn = ResolvedPromptSkill & {
  session: SkillSessionRecord | null
}

export async function executeConfiguredSkillTurn(params: {
  db: ApiDb
  userId: string
  scope: CompanionSkillScope
  userText: string
  sourceMessageId: string
  bindingTargets: readonly ResolvedSkillBindingTarget[]
  sessionTarget: {
    scopeType: CompanionSkillSessionScopeType
    scopeId: string
  }
  agentId?: string | null
  groupChatId?: string | null
  conversationId?: string | null
}): Promise<ResolvedSkillTurn> {
  const startedAtMs = Date.now()

  const buildReplayResult = (session: SkillSessionRecord): ResolvedSkillTurn => ({
    selection: buildSessionSelection({
      session,
      reason: '重复消息复用已完成的 Workflow Session 步骤',
    }),
    bindingSource: session.bindingSource,
    runId: null,
    systemInstruction: session.lastSystemInstruction ?? '',
    session,
  })

  const processedSession = await findProcessedSkillSessionTurn({
    db: params.db,
    userId: params.userId,
    scopeType: params.sessionTarget.scopeType,
    scopeId: params.sessionTarget.scopeId,
    sourceMessageId: params.sourceMessageId,
  })

  if (processedSession?.lastSystemInstruction) {
    return buildReplayResult(processedSession)
  }

  const runExistingSession = async (
    session: SkillSessionRecord,
    definition: WorkflowSkillDefinition,
  ): Promise<ResolvedSkillTurn> => {
    if (session.lastSourceMessageId === params.sourceMessageId && session.lastSystemInstruction) {
      return buildReplayResult(session)
    }

    if (isWorkflowCancellationRequest(params.userText)) {
      const cancelledSession = await cancelSkillSession({
        db: params.db,
        userId: params.userId,
        sessionId: session.id,
        expectedRevision: session.revision,
        sourceMessageId: params.sourceMessageId,
        systemInstruction: cancellationInstruction,
        nowMs: Date.now(),
      })

      if (!cancelledSession) {
        throw new AppError(BizCode.BIZ_CONFLICT, 'Skill session was updated by another request', 409)
      }

      const selection = buildSessionSelection({
        session: cancelledSession,
        reason: '用户取消活动 Workflow Session',
      })
      const runId = await recordSkillRun({
        ...params,
        selection,
        bindingSource: cancelledSession.bindingSource,
        sessionId: cancelledSession.id,
        status: 'cancelled',
        startedAtMs,
      })

      return {
        selection,
        bindingSource: cancelledSession.bindingSource,
        runId,
        systemInstruction: cancellationInstruction,
        session: cancelledSession,
      }
    }

    let output

    try {
      output = await workflowSkillRunner.run({
        definition,
        state: JSON.parse(session.stateJson) as unknown,
        userText: params.userText,
        isNewSession: false,
      })
    } catch (error) {
      await failSkillSession({
        db: params.db,
        userId: params.userId,
        sessionId: session.id,
        expectedRevision: session.revision,
        nowMs: Date.now(),
      })
      await recordSkillRun({
        ...params,
        selection: buildSessionSelection({
          session,
          reason: 'Workflow Session 状态解析或执行失败',
        }),
        bindingSource: session.bindingSource,
        sessionId: session.id,
        status: 'failed',
        startedAtMs,
      })
      throw error
    }

    const updatedSession = await updateSkillSessionTurn({
      db: params.db,
      userId: params.userId,
      sessionId: session.id,
      expectedRevision: session.revision,
      status: output.status,
      currentStep: output.currentStep,
      stateJson: JSON.stringify(output.state),
      pendingQuestion: output.pendingQuestion,
      sourceMessageId: params.sourceMessageId,
      systemInstruction: output.systemInstruction,
      expiresAtMs: Date.now() + definition.sessionTtlMs,
      nowMs: Date.now(),
    })

    if (!updatedSession) {
      const replayedSession = await findProcessedSkillSessionTurn({
        db: params.db,
        userId: params.userId,
        scopeType: params.sessionTarget.scopeType,
        scopeId: params.sessionTarget.scopeId,
        sourceMessageId: params.sourceMessageId,
      })

      if (replayedSession?.lastSystemInstruction) {
        return buildReplayResult(replayedSession)
      }

      throw new AppError(BizCode.BIZ_CONFLICT, 'Skill session was updated by another request', 409)
    }

    const selection = buildSessionSelection({
      session: updatedSession,
      reason: `继续 Workflow Session：${updatedSession.currentStep}`,
    })
    const runId = await recordSkillRun({
      ...params,
      selection,
      bindingSource: updatedSession.bindingSource,
      sessionId: updatedSession.id,
      status: output.status,
      startedAtMs,
    })

    return {
      selection,
      bindingSource: updatedSession.bindingSource,
      runId,
      systemInstruction: output.systemInstruction,
      session: updatedSession,
    }
  }

  const activeSession = await findActiveSkillSession({
    db: params.db,
    userId: params.userId,
    scopeType: params.sessionTarget.scopeType,
    scopeId: params.sessionTarget.scopeId,
    nowMs: Date.now(),
  })

  if (activeSession) {
    const definition = getWorkflowSkill(activeSession.skillId, activeSession.skillVersion)

    if (!definition) {
      await failSkillSession({
        db: params.db,
        userId: params.userId,
        sessionId: activeSession.id,
        expectedRevision: activeSession.revision,
        nowMs: Date.now(),
      })
      await recordSkillRun({
        ...params,
        selection: buildSessionSelection({
          session: activeSession,
          reason: 'Workflow Skill 固定版本不可用',
        }),
        bindingSource: activeSession.bindingSource,
        sessionId: activeSession.id,
        status: 'failed',
        startedAtMs,
      })
      throw new AppError(BizCode.SYSTEM_INTERNAL_ERROR, 'Workflow Skill version is unavailable', 500)
    }

    return runExistingSession(activeSession, definition)
  }

  const bindings = await listSkillBindingsForUser(params.db, params.userId)
  const workflowAvailability = resolveWorkflowSkillAvailability({
    scope: params.scope,
    bindings,
    targets: params.bindingTargets,
  })
  const selectedWorkflow = selectWorkflowSkill({
    scope: params.scope,
    userText: params.userText,
    availableSkillIds: workflowAvailability.availableSkillIds,
    availableSkillVersions: workflowAvailability.availableSkillVersions,
  })

  if (selectedWorkflow) {
    const output = await workflowSkillRunner.run({
      definition: selectedWorkflow.definition,
      state: selectedWorkflow.definition.createInitialState(),
      userText: params.userText,
      isNewSession: true,
    })
    const bindingSource = workflowAvailability.bindingSources[selectedWorkflow.selection.skillId] ?? 'default'
    const sessionId = uuidv7()
    let session: SkillSessionRecord | null = null

    try {
      session = await createSkillSession({
        db: params.db,
        id: sessionId,
        userId: params.userId,
        skillId: selectedWorkflow.selection.skillId,
        skillVersion: selectedWorkflow.selection.skillVersion,
        chatScope: params.scope,
        bindingSource,
        scopeType: params.sessionTarget.scopeType,
        scopeId: params.sessionTarget.scopeId,
        status: output.status,
        currentStep: output.currentStep,
        stateJson: JSON.stringify(output.state),
        pendingQuestion: output.pendingQuestion,
        lastSourceMessageId: params.sourceMessageId,
        lastSystemInstruction: output.systemInstruction,
        expiresAtMs: Date.now() + selectedWorkflow.definition.sessionTtlMs,
        nowMs: Date.now(),
      })
    } catch (error) {
      const concurrentSession = await findActiveSkillSession({
        db: params.db,
        userId: params.userId,
        scopeType: params.sessionTarget.scopeType,
        scopeId: params.sessionTarget.scopeId,
        nowMs: Date.now(),
      })

      if (!concurrentSession) {
        throw error
      }

      const concurrentDefinition = getWorkflowSkill(
        concurrentSession.skillId,
        concurrentSession.skillVersion,
      )

      if (!concurrentDefinition) {
        throw error
      }

      return runExistingSession(concurrentSession, concurrentDefinition)
    }

    if (!session) {
      throw new AppError(BizCode.SYSTEM_INTERNAL_ERROR, 'Failed to create Skill session', 500)
    }

    const runId = await recordSkillRun({
      ...params,
      selection: selectedWorkflow.selection,
      bindingSource,
      sessionId: session.id,
      status: output.status,
      startedAtMs,
    })

    return {
      selection: selectedWorkflow.selection,
      bindingSource,
      runId,
      systemInstruction: output.systemInstruction,
      session,
    }
  }

  const toolAvailability = resolveToolSkillAvailability({
    scope: params.scope,
    bindings,
    targets: params.bindingTargets,
  })
  const selectedTool = selectToolSkill({
    scope: params.scope,
    userText: params.userText,
    availableSkillIds: toolAvailability.availableSkillIds,
    availableSkillVersions: toolAvailability.availableSkillVersions,
  })

  if (selectedTool) {
    const bindingSource = toolAvailability.bindingSources[selectedTool.selection.skillId] ?? 'default'
    const toolOutput = await toolSkillRunner.run({
      db: params.db,
      userId: params.userId,
      agentId: params.agentId ?? null,
      userText: params.userText,
      sourceMessageId: params.sourceMessageId,
      definition: selectedTool.definition,
      policyTargets: [
        ...(params.agentId ? [{ scopeType: 'agent' as const, scopeId: params.agentId }] : []),
        { scopeType: 'user' as const, scopeId: params.userId },
      ],
    })
    const runId = await recordSkillRun({
      ...params,
      selection: selectedTool.selection,
      bindingSource,
      sessionId: null,
      status: toolOutput.status,
      startedAtMs,
    })

    return {
      selection: selectedTool.selection,
      bindingSource,
      runId,
      systemInstruction: toolOutput.systemInstruction,
      session: null,
    }
  }

  const promptAvailability = resolvePromptSkillAvailability({
    scope: params.scope,
    bindings,
    targets: params.bindingTargets,
  })
  const resolvedPrompt = promptSkillRunner.run({
    scope: params.scope,
    userText: params.userText,
    availableSkillIds: promptAvailability.availableSkillIds,
    availableSkillVersions: promptAvailability.availableSkillVersions,
    bindingSources: promptAvailability.bindingSources,
  })

  if (!resolvedPrompt.selection || !resolvedPrompt.bindingSource) {
    return {
      ...resolvedPrompt,
      session: null,
    }
  }

  const runId = await recordSkillRun({
    ...params,
    selection: resolvedPrompt.selection,
    bindingSource: resolvedPrompt.bindingSource,
    sessionId: null,
    status: 'completed',
    startedAtMs,
  })

  return {
    ...resolvedPrompt,
    runId,
    session: null,
  }
}
