import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import type {
  CompanionSkillBindingScopeType,
  CompanionSkillBindingSource,
  CompanionSkillKind,
  CompanionSkillRunStatus,
  CompanionSkillScope,
  CompanionSkillSessionScopeType,
  CompanionSkillSessionStatus,
  CompanionSkillTrigger,
} from '@repo/contracts'
import type { ApiDb } from '@/db/client'
import { agentConversations, skillBindings, skillRuns, skillSessions } from '@/db/schema'

export type SkillBindingRecord = {
  id: string
  userId: string
  scopeType: CompanionSkillBindingScopeType
  scopeId: string
  skillId: string
  skillVersion: string | null
  enabled: boolean
  createdAtMs: number
  updatedAtMs: number
}

export async function listSkillBindingsForUser(db: ApiDb, userId: string): Promise<SkillBindingRecord[]> {
  const rows = await db
    .select()
    .from(skillBindings)
    .where(eq(skillBindings.userId, userId))

  return rows.map((row) => ({
    ...row,
    scopeType: row.scopeType as CompanionSkillBindingScopeType,
    enabled: row.enabled === 1,
  }))
}

export async function upsertSkillBinding(params: {
  db: ApiDb
  id: string
  userId: string
  scopeType: CompanionSkillBindingScopeType
  scopeId: string
  skillId: string
  skillVersion: string | null
  enabled: boolean
  nowMs: number
}) {
  await params.db
    .insert(skillBindings)
    .values({
      id: params.id,
      userId: params.userId,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      skillId: params.skillId,
      skillVersion: params.skillVersion,
      enabled: params.enabled ? 1 : 0,
      createdAtMs: params.nowMs,
      updatedAtMs: params.nowMs,
    })
    .onConflictDoUpdate({
      target: [
        skillBindings.userId,
        skillBindings.scopeType,
        skillBindings.scopeId,
        skillBindings.skillId,
      ],
      set: {
        skillVersion: params.skillVersion,
        enabled: params.enabled ? 1 : 0,
        updatedAtMs: params.nowMs,
      },
    })
}

export async function deleteSkillBinding(params: {
  db: ApiDb
  userId: string
  scopeType: CompanionSkillBindingScopeType
  scopeId: string
  skillId: string
}) {
  await params.db
    .delete(skillBindings)
    .where(and(
      eq(skillBindings.userId, params.userId),
      eq(skillBindings.scopeType, params.scopeType),
      eq(skillBindings.scopeId, params.scopeId),
      eq(skillBindings.skillId, params.skillId),
    ))
}

export async function findOwnedConversationSkillContext(params: {
  db: ApiDb
  userId: string
  conversationId: string
}) {
  const row = await params.db
    .select({
      conversationId: agentConversations.id,
      agentId: agentConversations.agentId,
    })
    .from(agentConversations)
    .where(and(
      eq(agentConversations.id, params.conversationId),
      eq(agentConversations.userId, params.userId),
    ))
    .limit(1)
    .get()

  return row ?? null
}

export async function insertSkillRun(params: {
  db: ApiDb
  id: string
  userId: string
  skillId: string
  skillVersion: string
  skillKind: CompanionSkillKind
  sessionId: string | null
  chatScope: CompanionSkillScope
  bindingSource: CompanionSkillBindingSource
  trigger: CompanionSkillTrigger
  score: number
  reason: string
  status: CompanionSkillRunStatus
  agentId: string | null
  groupChatId: string | null
  conversationId: string | null
  latencyMs: number
  createdAtMs: number
  completedAtMs: number | null
}) {
  await params.db.insert(skillRuns).values({
    id: params.id,
    userId: params.userId,
    skillId: params.skillId,
    skillVersion: params.skillVersion,
    skillKind: params.skillKind,
    sessionId: params.sessionId,
    chatScope: params.chatScope,
    bindingSource: params.bindingSource,
    triggerType: params.trigger,
    score: params.score,
    reason: params.reason,
    status: params.status,
    agentId: params.agentId,
    groupChatId: params.groupChatId,
    conversationId: params.conversationId,
    latencyMs: params.latencyMs,
    createdAtMs: params.createdAtMs,
    completedAtMs: params.completedAtMs,
  })
}

export async function listSkillRunsForUser(params: {
  db: ApiDb
  userId: string
  limit: number
}) {
  const rows = await params.db
    .select()
    .from(skillRuns)
    .where(eq(skillRuns.userId, params.userId))
    .orderBy(desc(skillRuns.createdAtMs), desc(skillRuns.id))
    .limit(params.limit)

  return rows.map((row) => ({
    ...row,
    skillKind: row.skillKind as CompanionSkillKind,
    chatScope: row.chatScope as CompanionSkillScope,
    bindingSource: row.bindingSource as CompanionSkillBindingSource,
    trigger: row.triggerType as CompanionSkillTrigger,
    status: row.status as CompanionSkillRunStatus,
  }))
}

export type SkillSessionRecord = {
  id: string
  userId: string
  skillId: string
  skillVersion: string
  chatScope: CompanionSkillScope
  bindingSource: CompanionSkillBindingSource
  scopeType: CompanionSkillSessionScopeType
  scopeId: string
  status: CompanionSkillSessionStatus
  currentStep: string
  stateJson: string
  pendingQuestion: string | null
  lastSourceMessageId: string | null
  lastSystemInstruction: string | null
  revision: number
  createdAtMs: number
  updatedAtMs: number
  expiresAtMs: number
  completedAtMs: number | null
  cancelledAtMs: number | null
  failedAtMs: number | null
}

function toSkillSessionRecord(row: typeof skillSessions.$inferSelect): SkillSessionRecord {
  return {
    ...row,
    chatScope: row.chatScope as CompanionSkillScope,
    bindingSource: row.bindingSource as CompanionSkillBindingSource,
    scopeType: row.scopeType as CompanionSkillSessionScopeType,
    status: row.status as CompanionSkillSessionStatus,
  }
}

async function expireSkillSessionsForUser(params: {
  db: ApiDb
  userId: string
  nowMs: number
}) {
  await params.db
    .update(skillSessions)
    .set({
      status: 'expired',
      updatedAtMs: params.nowMs,
      revision: sql`${skillSessions.revision} + 1`,
    })
    .where(and(
      eq(skillSessions.userId, params.userId),
      inArray(skillSessions.status, ['active', 'waiting_user']),
      lte(skillSessions.expiresAtMs, params.nowMs),
    ))
}

export async function findSkillSessionById(params: {
  db: ApiDb
  userId: string
  sessionId: string
}) {
  const row = await params.db
    .select()
    .from(skillSessions)
    .where(and(
      eq(skillSessions.id, params.sessionId),
      eq(skillSessions.userId, params.userId),
    ))
    .limit(1)
    .get()

  return row ? toSkillSessionRecord(row) : null
}

export async function findProcessedSkillSessionTurn(params: {
  db: ApiDb
  userId: string
  scopeType: CompanionSkillSessionScopeType
  scopeId: string
  sourceMessageId: string
}) {
  const row = await params.db
    .select()
    .from(skillSessions)
    .where(and(
      eq(skillSessions.userId, params.userId),
      eq(skillSessions.scopeType, params.scopeType),
      eq(skillSessions.scopeId, params.scopeId),
      eq(skillSessions.lastSourceMessageId, params.sourceMessageId),
    ))
    .orderBy(desc(skillSessions.updatedAtMs))
    .limit(1)
    .get()

  return row ? toSkillSessionRecord(row) : null
}

export async function findActiveSkillSession(params: {
  db: ApiDb
  userId: string
  scopeType: CompanionSkillSessionScopeType
  scopeId: string
  nowMs: number
}) {
  await expireSkillSessionsForUser(params)

  const row = await params.db
    .select()
    .from(skillSessions)
    .where(and(
      eq(skillSessions.userId, params.userId),
      eq(skillSessions.scopeType, params.scopeType),
      eq(skillSessions.scopeId, params.scopeId),
      inArray(skillSessions.status, ['active', 'waiting_user']),
    ))
    .orderBy(desc(skillSessions.updatedAtMs))
    .limit(1)
    .get()

  return row ? toSkillSessionRecord(row) : null
}

export async function createSkillSession(params: {
  db: ApiDb
  id: string
  userId: string
  skillId: string
  skillVersion: string
  chatScope: CompanionSkillScope
  bindingSource: CompanionSkillBindingSource
  scopeType: CompanionSkillSessionScopeType
  scopeId: string
  status: Extract<CompanionSkillSessionStatus, 'waiting_user' | 'completed'>
  currentStep: string
  stateJson: string
  pendingQuestion: string | null
  lastSourceMessageId: string
  lastSystemInstruction: string
  expiresAtMs: number
  nowMs: number
}) {
  await params.db.insert(skillSessions).values({
    id: params.id,
    userId: params.userId,
    skillId: params.skillId,
    skillVersion: params.skillVersion,
    chatScope: params.chatScope,
    bindingSource: params.bindingSource,
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    status: params.status,
    currentStep: params.currentStep,
    stateJson: params.stateJson,
    pendingQuestion: params.pendingQuestion,
    lastSourceMessageId: params.lastSourceMessageId,
    lastSystemInstruction: params.lastSystemInstruction,
    revision: 0,
    createdAtMs: params.nowMs,
    updatedAtMs: params.nowMs,
    expiresAtMs: params.expiresAtMs,
    completedAtMs: params.status === 'completed' ? params.nowMs : null,
    cancelledAtMs: null,
    failedAtMs: null,
  })

  return findSkillSessionById({
    db: params.db,
    userId: params.userId,
    sessionId: params.id,
  })
}

export async function updateSkillSessionTurn(params: {
  db: ApiDb
  userId: string
  sessionId: string
  expectedRevision: number
  status: Extract<CompanionSkillSessionStatus, 'waiting_user' | 'completed'>
  currentStep: string
  stateJson: string
  pendingQuestion: string | null
  sourceMessageId: string
  systemInstruction: string
  expiresAtMs: number
  nowMs: number
}) {
  const updated = await params.db
    .update(skillSessions)
    .set({
      status: params.status,
      currentStep: params.currentStep,
      stateJson: params.stateJson,
      pendingQuestion: params.pendingQuestion,
      lastSourceMessageId: params.sourceMessageId,
      lastSystemInstruction: params.systemInstruction,
      revision: params.expectedRevision + 1,
      updatedAtMs: params.nowMs,
      expiresAtMs: params.expiresAtMs,
      completedAtMs: params.status === 'completed' ? params.nowMs : null,
    })
    .where(and(
      eq(skillSessions.id, params.sessionId),
      eq(skillSessions.userId, params.userId),
      eq(skillSessions.revision, params.expectedRevision),
      inArray(skillSessions.status, ['active', 'waiting_user']),
    ))
    .returning({ id: skillSessions.id })

  if (updated.length !== 1) {
    return null
  }

  return findSkillSessionById({
    db: params.db,
    userId: params.userId,
    sessionId: params.sessionId,
  })
}

export async function cancelSkillSession(params: {
  db: ApiDb
  userId: string
  sessionId: string
  expectedRevision: number
  sourceMessageId?: string | null
  systemInstruction?: string | null
  nowMs: number
}) {
  const updated = await params.db
    .update(skillSessions)
    .set({
      status: 'cancelled',
      lastSourceMessageId: params.sourceMessageId ?? undefined,
      lastSystemInstruction: params.systemInstruction ?? undefined,
      revision: params.expectedRevision + 1,
      updatedAtMs: params.nowMs,
      cancelledAtMs: params.nowMs,
    })
    .where(and(
      eq(skillSessions.id, params.sessionId),
      eq(skillSessions.userId, params.userId),
      eq(skillSessions.revision, params.expectedRevision),
      inArray(skillSessions.status, ['active', 'waiting_user']),
    ))
    .returning({ id: skillSessions.id })

  if (updated.length !== 1) {
    return null
  }

  return findSkillSessionById({
    db: params.db,
    userId: params.userId,
    sessionId: params.sessionId,
  })
}

export async function failSkillSession(params: {
  db: ApiDb
  userId: string
  sessionId: string
  expectedRevision: number
  nowMs: number
}) {
  await params.db
    .update(skillSessions)
    .set({
      status: 'failed',
      revision: params.expectedRevision + 1,
      updatedAtMs: params.nowMs,
      failedAtMs: params.nowMs,
    })
    .where(and(
      eq(skillSessions.id, params.sessionId),
      eq(skillSessions.userId, params.userId),
      eq(skillSessions.revision, params.expectedRevision),
      inArray(skillSessions.status, ['active', 'waiting_user']),
    ))
}

export async function listSkillSessionsForUser(params: {
  db: ApiDb
  userId: string
  limit: number
  activeOnly?: boolean
  nowMs: number
}) {
  await expireSkillSessionsForUser(params)

  const rows = await params.db
    .select()
    .from(skillSessions)
    .where(params.activeOnly
      ? and(
          eq(skillSessions.userId, params.userId),
          inArray(skillSessions.status, ['active', 'waiting_user']),
        )
      : eq(skillSessions.userId, params.userId))
    .orderBy(desc(skillSessions.updatedAtMs), desc(skillSessions.id))
    .limit(params.limit)

  return rows.map(toSkillSessionRecord)
}
