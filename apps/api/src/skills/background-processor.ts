import { uuidv7 } from 'uuidv7'
import type { CompanionSkillBindingSource, CompanionSkillRunStatus } from '@repo/contracts'
import type { ApiDb } from '@/db/client'
import { getDb } from '@/db/client'
import type { ApiBindings } from '@/bindings'
import { getBackgroundSkill } from './core/background-registry'
import { findEffectiveBinding } from './core/bindings'
import { evaluateSkillPolicy } from './core/policy-gate'
import {
  claimDueSkillBackgroundJobs,
  completeSkillBackgroundJob,
  failSkillBackgroundJob,
  insertSkillAuditEvent,
  type SkillBackgroundJobRecord,
} from './controlled-repository'
import { insertSkillRun, listSkillBindingsForUser } from './repository'

async function recordBackgroundRun(params: {
  db: ApiDb
  job: SkillBackgroundJobRecord
  bindingSource: CompanionSkillBindingSource
  status: CompanionSkillRunStatus
  reason: string
  startedAtMs: number
}) {
  const nowMs = Date.now()
  try {
    await insertSkillRun({
      db: params.db,
      id: uuidv7(),
      userId: params.job.userId,
      skillId: params.job.skillId,
      skillVersion: params.job.skillVersion,
      skillKind: 'background',
      sessionId: null,
      chatScope: 'background',
      bindingSource: params.bindingSource,
      trigger: 'schedule',
      score: 100,
      reason: params.reason,
      status: params.status,
      agentId: params.job.agentId,
      groupChatId: null,
      conversationId: params.job.conversationId,
      latencyMs: nowMs - params.startedAtMs,
      createdAtMs: params.startedAtMs,
      completedAtMs: nowMs,
    })
  } catch (error) {
    console.error('Failed to record Background Skill run', error)
  }
}

async function executeJob(db: ApiDb, job: SkillBackgroundJobRecord) {
  const startedAtMs = Date.now()
  const definition = getBackgroundSkill(job.skillId, job.skillVersion)

  if (!definition) {
    await failSkillBackgroundJob({ db, job, error: 'Pinned Background Skill version is unavailable', permanent: true, nowMs: Date.now() })
    return
  }

  const bindings = await listSkillBindingsForUser(db, job.userId)
  const targets = [
    { scopeType: 'agent' as const, scopeId: job.agentId },
    { scopeType: 'user' as const, scopeId: job.userId },
  ]
  const binding = findEffectiveBinding({ bindings, targets, skillId: job.skillId })
  const bindingSource: CompanionSkillBindingSource = binding?.scopeType ?? 'default'

  if (!(binding?.enabled ?? definition.manifest.enabledByDefault)) {
    await failSkillBackgroundJob({ db, job, error: 'Background Skill was disabled before execution', permanent: true, nowMs: Date.now() })
    await insertSkillAuditEvent({
      db,
      id: uuidv7(),
      userId: job.userId,
      skillId: job.skillId,
      skillVersion: job.skillVersion,
      action: 'background.execute',
      decision: 'denied',
      reason: 'Background Skill is disabled',
      scopeType: 'agent',
      scopeId: job.agentId,
      targetId: job.id,
      nowMs: Date.now(),
    })
    await recordBackgroundRun({ db, job, bindingSource, status: 'denied', reason: '后台任务执行前 Skill 已被停用', startedAtMs })
    return
  }

  const policy = await evaluateSkillPolicy({
    db,
    userId: job.userId,
    skillId: job.skillId,
    skillVersion: job.skillVersion,
    requirements: definition.manifest.permissions ?? [],
    targets,
    action: 'background.execute',
    targetId: job.id,
  })

  if (!policy.allowed) {
    await failSkillBackgroundJob({ db, job, error: policy.reason, permanent: true, nowMs: Date.now() })
    await recordBackgroundRun({ db, job, bindingSource, status: 'denied', reason: '后台任务执行前权限已被撤销', startedAtMs })
    return
  }

  try {
    const payload = definition.payloadSchema.parse(JSON.parse(job.payloadJson) as unknown)
    await definition.execute({ db, userId: job.userId, jobId: job.id, value: payload })
    const nowMs = Date.now()
    await completeSkillBackgroundJob({ db, job, nowMs })
    try {
      await insertSkillAuditEvent({
        db,
        id: uuidv7(),
        userId: job.userId,
        skillId: job.skillId,
        skillVersion: job.skillVersion,
        action: 'background.execute',
        decision: 'succeeded',
        reason: 'Background Skill completed',
        scopeType: 'agent',
        scopeId: job.agentId,
        targetId: job.id,
        metadata: { attempt: job.attempts },
        nowMs,
      })
    } catch (error) {
      console.error('Failed to record successful Background Skill audit', error)
    }
    await recordBackgroundRun({ db, job, bindingSource, status: 'completed', reason: '目标复盘提醒已按计划发送', startedAtMs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Background Skill error'
    const nowMs = Date.now()
    await failSkillBackgroundJob({ db, job, error: message, nowMs })
    await insertSkillAuditEvent({
      db,
      id: uuidv7(),
      userId: job.userId,
      skillId: job.skillId,
      skillVersion: job.skillVersion,
      action: 'background.execute',
      decision: 'failed',
      reason: 'Background Skill execution failed',
      scopeType: 'agent',
      scopeId: job.agentId,
      targetId: job.id,
      metadata: { attempt: job.attempts, willRetry: job.attempts < job.maxAttempts },
      nowMs,
    })
    await recordBackgroundRun({ db, job, bindingSource, status: 'failed', reason: '目标复盘提醒执行失败', startedAtMs })
  }
}

export async function processDueBackgroundSkillJobs(env: ApiBindings) {
  const db = getDb(env.DB)
  const jobs = await claimDueSkillBackgroundJobs({ db, nowMs: Date.now(), limit: 20 })
  await Promise.allSettled(jobs.map((job) => executeJob(db, job)))
}
