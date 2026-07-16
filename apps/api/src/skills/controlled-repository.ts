import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import type {
  CompanionSkillBackgroundJobStatus,
  CompanionSkillPermissionCode,
  CompanionSkillPermissionGrantStatus,
  CompanionSkillPermissionScopeType,
} from '@repo/contracts'
import type { ApiDb } from '@/db/client'
import {
  skillAuditEvents,
  skillBackgroundJobs,
  skillPermissionGrants,
  skillToolExecutions,
  userAgentCompanions,
} from '@/db/schema'

export type SkillPermissionGrantRecord = {
  id: string
  userId: string
  skillId: string
  skillVersion: string
  permissionCode: CompanionSkillPermissionCode
  scopeType: CompanionSkillPermissionScopeType
  scopeId: string
  status: CompanionSkillPermissionGrantStatus
  grantedAtMs: number
  revokedAtMs: number | null
  updatedAtMs: number
}

function toPermissionGrant(row: typeof skillPermissionGrants.$inferSelect): SkillPermissionGrantRecord {
  return {
    ...row,
    permissionCode: row.permissionCode as CompanionSkillPermissionCode,
    scopeType: row.scopeType as CompanionSkillPermissionScopeType,
    status: row.status as CompanionSkillPermissionGrantStatus,
  }
}

export async function listSkillPermissionGrants(params: { db: ApiDb; userId: string }) {
  const rows = await params.db
    .select()
    .from(skillPermissionGrants)
    .where(eq(skillPermissionGrants.userId, params.userId))
    .orderBy(desc(skillPermissionGrants.updatedAtMs))
  return rows.map(toPermissionGrant)
}

export async function upsertSkillPermissionGrant(params: {
  db: ApiDb
  id: string
  userId: string
  skillId: string
  skillVersion: string
  permissionCode: CompanionSkillPermissionCode
  scopeType: CompanionSkillPermissionScopeType
  scopeId: string
  granted: boolean
  nowMs: number
}) {
  await params.db
    .insert(skillPermissionGrants)
    .values({
      id: params.id,
      userId: params.userId,
      skillId: params.skillId,
      skillVersion: params.skillVersion,
      permissionCode: params.permissionCode,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      status: params.granted ? 'active' : 'revoked',
      grantedAtMs: params.nowMs,
      revokedAtMs: params.granted ? null : params.nowMs,
      updatedAtMs: params.nowMs,
    })
    .onConflictDoUpdate({
      target: [
        skillPermissionGrants.userId,
        skillPermissionGrants.skillId,
        skillPermissionGrants.permissionCode,
        skillPermissionGrants.scopeType,
        skillPermissionGrants.scopeId,
      ],
      set: {
        skillVersion: params.skillVersion,
        status: params.granted ? 'active' : 'revoked',
        grantedAtMs: params.granted ? params.nowMs : sql`${skillPermissionGrants.grantedAtMs}`,
        revokedAtMs: params.granted ? null : params.nowMs,
        updatedAtMs: params.nowMs,
      },
    })

  const row = await params.db
    .select()
    .from(skillPermissionGrants)
    .where(and(
      eq(skillPermissionGrants.userId, params.userId),
      eq(skillPermissionGrants.skillId, params.skillId),
      eq(skillPermissionGrants.permissionCode, params.permissionCode),
      eq(skillPermissionGrants.scopeType, params.scopeType),
      eq(skillPermissionGrants.scopeId, params.scopeId),
    ))
    .limit(1)
    .get()

  return row ? toPermissionGrant(row) : null
}

export async function insertSkillAuditEvent(params: {
  db: ApiDb
  id: string
  userId: string | null
  skillId: string
  skillVersion: string
  action: string
  decision: 'allowed' | 'denied' | 'succeeded' | 'failed' | 'cancelled'
  reason: string
  scopeType: string
  scopeId: string
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  nowMs: number
}) {
  await params.db.insert(skillAuditEvents).values({
    id: params.id,
    userId: params.userId,
    skillId: params.skillId,
    skillVersion: params.skillVersion,
    action: params.action,
    decision: params.decision,
    reason: params.reason,
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    targetId: params.targetId ?? null,
    metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
    createdAtMs: params.nowMs,
  })
}

export async function createSkillToolExecution(params: {
  db: ApiDb
  id: string
  userId: string
  skillId: string
  skillVersion: string
  toolId: string
  sourceMessageId: string
  idempotencyKey: string
  inputDigest: string
  nowMs: number
}) {
  const rows = await params.db
    .insert(skillToolExecutions)
    .values({
      id: params.id,
      userId: params.userId,
      skillId: params.skillId,
      skillVersion: params.skillVersion,
      toolId: params.toolId,
      runId: null,
      sourceMessageId: params.sourceMessageId,
      idempotencyKey: params.idempotencyKey,
      status: 'running',
      inputDigest: params.inputDigest,
      latencyMs: 0,
      errorCode: null,
      createdAtMs: params.nowMs,
      completedAtMs: null,
    })
    .onConflictDoNothing()
    .returning({ id: skillToolExecutions.id })
  return rows.length === 1
}

export async function completeSkillToolExecution(params: {
  db: ApiDb
  id: string
  status: 'completed' | 'failed' | 'timed_out'
  latencyMs: number
  errorCode?: string | null
  nowMs: number
}) {
  await params.db
    .update(skillToolExecutions)
    .set({
      status: params.status,
      latencyMs: params.latencyMs,
      errorCode: params.errorCode ?? null,
      completedAtMs: params.nowMs,
    })
    .where(eq(skillToolExecutions.id, params.id))
}

export type SkillBackgroundJobRecord = {
  id: string
  userId: string
  skillId: string
  skillVersion: string
  agentId: string
  agentName: string
  conversationId: string
  permissionGrantId: string | null
  payloadJson: string
  status: CompanionSkillBackgroundJobStatus
  scheduledAtMs: number
  nextAttemptAtMs: number
  attempts: number
  maxAttempts: number
  revision: number
  leaseUntilMs: number | null
  lastError: string | null
  createdAtMs: number
  updatedAtMs: number
  completedAtMs: number | null
  cancelledAtMs: number | null
}

const backgroundSelection = {
  id: skillBackgroundJobs.id,
  userId: skillBackgroundJobs.userId,
  skillId: skillBackgroundJobs.skillId,
  skillVersion: skillBackgroundJobs.skillVersion,
  agentId: skillBackgroundJobs.agentId,
  agentName: userAgentCompanions.name,
  conversationId: skillBackgroundJobs.conversationId,
  permissionGrantId: skillBackgroundJobs.permissionGrantId,
  payloadJson: skillBackgroundJobs.payloadJson,
  status: skillBackgroundJobs.status,
  scheduledAtMs: skillBackgroundJobs.scheduledAtMs,
  nextAttemptAtMs: skillBackgroundJobs.nextAttemptAtMs,
  attempts: skillBackgroundJobs.attempts,
  maxAttempts: skillBackgroundJobs.maxAttempts,
  revision: skillBackgroundJobs.revision,
  leaseUntilMs: skillBackgroundJobs.leaseUntilMs,
  lastError: skillBackgroundJobs.lastError,
  createdAtMs: skillBackgroundJobs.createdAtMs,
  updatedAtMs: skillBackgroundJobs.updatedAtMs,
  completedAtMs: skillBackgroundJobs.completedAtMs,
  cancelledAtMs: skillBackgroundJobs.cancelledAtMs,
}

function toBackgroundJob(row: Omit<SkillBackgroundJobRecord, 'status'> & { status: string }): SkillBackgroundJobRecord {
  return { ...row, status: row.status as CompanionSkillBackgroundJobStatus }
}

export async function createSkillBackgroundJob(params: {
  db: ApiDb
  id: string
  userId: string
  skillId: string
  skillVersion: string
  agentId: string
  conversationId: string
  permissionGrantId: string
  payloadJson: string
  scheduledAtMs: number
  maxAttempts: number
  nowMs: number
}) {
  await params.db.insert(skillBackgroundJobs).values({
    id: params.id,
    userId: params.userId,
    skillId: params.skillId,
    skillVersion: params.skillVersion,
    agentId: params.agentId,
    conversationId: params.conversationId,
    permissionGrantId: params.permissionGrantId,
    payloadJson: params.payloadJson,
    status: 'scheduled',
    scheduledAtMs: params.scheduledAtMs,
    nextAttemptAtMs: params.scheduledAtMs,
    attempts: 0,
    maxAttempts: params.maxAttempts,
    revision: 0,
    leaseUntilMs: null,
    lastError: null,
    createdAtMs: params.nowMs,
    updatedAtMs: params.nowMs,
    completedAtMs: null,
    cancelledAtMs: null,
  })
  return findSkillBackgroundJob({ db: params.db, userId: params.userId, jobId: params.id })
}

export async function findSkillBackgroundJob(params: { db: ApiDb; userId: string; jobId: string }) {
  const row = await params.db
    .select(backgroundSelection)
    .from(skillBackgroundJobs)
    .innerJoin(userAgentCompanions, eq(userAgentCompanions.id, skillBackgroundJobs.agentId))
    .where(and(eq(skillBackgroundJobs.id, params.jobId), eq(skillBackgroundJobs.userId, params.userId)))
    .limit(1)
    .get()
  return row ? toBackgroundJob(row) : null
}

export async function listSkillBackgroundJobs(params: { db: ApiDb; userId: string; limit: number }) {
  const rows = await params.db
    .select(backgroundSelection)
    .from(skillBackgroundJobs)
    .innerJoin(userAgentCompanions, eq(userAgentCompanions.id, skillBackgroundJobs.agentId))
    .where(eq(skillBackgroundJobs.userId, params.userId))
    .orderBy(desc(skillBackgroundJobs.createdAtMs), desc(skillBackgroundJobs.id))
    .limit(params.limit)
  return rows.map(toBackgroundJob)
}

export async function cancelSkillBackgroundJob(params: {
  db: ApiDb
  userId: string
  jobId: string
  expectedRevision: number
  nowMs: number
}) {
  const rows = await params.db
    .update(skillBackgroundJobs)
    .set({
      status: 'cancelled',
      revision: params.expectedRevision + 1,
      leaseUntilMs: null,
      updatedAtMs: params.nowMs,
      cancelledAtMs: params.nowMs,
    })
    .where(and(
      eq(skillBackgroundJobs.id, params.jobId),
      eq(skillBackgroundJobs.userId, params.userId),
      eq(skillBackgroundJobs.revision, params.expectedRevision),
      inArray(skillBackgroundJobs.status, ['scheduled', 'retrying']),
    ))
    .returning({ id: skillBackgroundJobs.id })
  if (rows.length !== 1) return null
  return findSkillBackgroundJob(params)
}

export async function claimDueSkillBackgroundJobs(params: { db: ApiDb; nowMs: number; limit: number }) {
  await params.db
    .update(skillBackgroundJobs)
    .set({
      status: 'retrying',
      revision: sql`${skillBackgroundJobs.revision} + 1`,
      leaseUntilMs: null,
      nextAttemptAtMs: params.nowMs,
      updatedAtMs: params.nowMs,
      lastError: 'Previous execution lease expired',
    })
    .where(and(
      eq(skillBackgroundJobs.status, 'running'),
      lte(skillBackgroundJobs.leaseUntilMs, params.nowMs),
    ))

  const candidates = await params.db
    .select(backgroundSelection)
    .from(skillBackgroundJobs)
    .innerJoin(userAgentCompanions, eq(userAgentCompanions.id, skillBackgroundJobs.agentId))
    .where(and(
      inArray(skillBackgroundJobs.status, ['scheduled', 'retrying']),
      lte(skillBackgroundJobs.nextAttemptAtMs, params.nowMs),
    ))
    .orderBy(skillBackgroundJobs.nextAttemptAtMs, skillBackgroundJobs.id)
    .limit(params.limit)

  const claimed: SkillBackgroundJobRecord[] = []
  for (const row of candidates) {
    const updated = await params.db
      .update(skillBackgroundJobs)
      .set({
        status: 'running',
        attempts: row.attempts + 1,
        revision: row.revision + 1,
        leaseUntilMs: params.nowMs + 120_000,
        updatedAtMs: params.nowMs,
      })
      .where(and(
        eq(skillBackgroundJobs.id, row.id),
        eq(skillBackgroundJobs.revision, row.revision),
        inArray(skillBackgroundJobs.status, ['scheduled', 'retrying']),
      ))
      .returning({ id: skillBackgroundJobs.id })
    if (updated.length === 1) {
      claimed.push(toBackgroundJob({ ...row, status: 'running', attempts: row.attempts + 1, revision: row.revision + 1, leaseUntilMs: params.nowMs + 120_000, updatedAtMs: params.nowMs }))
    }
  }
  return claimed
}

export async function completeSkillBackgroundJob(params: { db: ApiDb; job: SkillBackgroundJobRecord; nowMs: number }) {
  await params.db
    .update(skillBackgroundJobs)
    .set({ status: 'completed', leaseUntilMs: null, revision: params.job.revision + 1, updatedAtMs: params.nowMs, completedAtMs: params.nowMs })
    .where(and(eq(skillBackgroundJobs.id, params.job.id), eq(skillBackgroundJobs.revision, params.job.revision), eq(skillBackgroundJobs.status, 'running')))
}

export async function failSkillBackgroundJob(params: {
  db: ApiDb
  job: SkillBackgroundJobRecord
  error: string
  permanent?: boolean
  nowMs: number
}) {
  const exhausted = params.permanent || params.job.attempts >= params.job.maxAttempts
  const retryDelayMs = Math.min(60 * 60_000, 5 * 60_000 * (2 ** Math.max(0, params.job.attempts - 1)))
  await params.db
    .update(skillBackgroundJobs)
    .set({
      status: exhausted ? 'failed' : 'retrying',
      nextAttemptAtMs: exhausted ? params.job.nextAttemptAtMs : params.nowMs + retryDelayMs,
      leaseUntilMs: null,
      lastError: params.error.slice(0, 500),
      revision: params.job.revision + 1,
      updatedAtMs: params.nowMs,
      completedAtMs: exhausted ? params.nowMs : null,
    })
    .where(and(eq(skillBackgroundJobs.id, params.job.id), eq(skillBackgroundJobs.revision, params.job.revision), eq(skillBackgroundJobs.status, 'running')))
}
