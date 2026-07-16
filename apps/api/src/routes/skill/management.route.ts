import { uuidv7 } from 'uuidv7'
import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  BizCode,
  CancelCompanionSkillSessionResponseSchema,
  CancelCompanionSkillBackgroundJobResponseSchema,
  CompanionSkillBackgroundJobListResponseSchema,
  CompanionSkillBindingTargetSchema,
  CompanionSkillCatalogResponseSchema,
  CompanionSkillEvaluationSummarySchema,
  CompanionSkillRunListResponseSchema,
  CompanionSkillSessionListResponseSchema,
  CompanionSkillPermissionGrantListResponseSchema,
  CreateCompanionSkillBackgroundJobRequestSchema,
  CreateCompanionSkillBackgroundJobResponseSchema,
  UpdateCompanionSkillBindingRequestSchema,
  UpdateCompanionSkillBindingResponseSchema,
  UpdateCompanionSkillPermissionGrantRequestSchema,
  UpdateCompanionSkillPermissionGrantResponseSchema,
  buildSuccess,
  type CompanionSkillBindingTarget,
  type CompanionSkillScope,
} from '@repo/contracts'
import { authUnauthorizedError } from '@/auth/errors'
import { buildValidationErrorHandler } from '@/auth/http'
import { verifyAccessToken } from '@/auth/jwt'
import {
  findAgentGroupChat,
  findUserAgentCompanionOwner,
  getOrCreateDefaultAgentConversation,
} from '@/auth/repository'
import type { ApiBindings } from '@/bindings'
import { getDb, type ApiDb } from '@/db/client'
import { getApiEnv } from '@/env'
import { createApiMeta } from '@/lib/api-meta'
import { AppError } from '@/lib/app-error'
import {
  buildSkillCatalog,
  getRegisteredSkill,
  getBackgroundSkill,
} from '@/skills'
import { findEffectiveBinding, type ResolvedSkillBindingTarget } from '@/skills/core/bindings'
import { evaluateSkillPolicy } from '@/skills/core/policy-gate'
import {
  cancelSkillBackgroundJob,
  createSkillBackgroundJob,
  findSkillBackgroundJob,
  insertSkillAuditEvent,
  listSkillBackgroundJobs,
  listSkillPermissionGrants,
  upsertSkillPermissionGrant,
  type SkillBackgroundJobRecord,
} from '@/skills/controlled-repository'
import { evaluateSkillSelectors } from '@/skills/evaluations/evaluate-skill-selectors'
import {
  deleteSkillBinding,
  cancelSkillSession,
  findSkillSessionById,
  findOwnedConversationSkillContext,
  insertSkillRun,
  listSkillBindingsForUser,
  listSkillRunsForUser,
  listSkillSessionsForUser,
  upsertSkillBinding,
  type SkillSessionRecord,
} from '@/skills/repository'

const skillManagementRoute = new Hono<{ Bindings: ApiBindings }>()

async function requireWebAccessToken(c: Context<{ Bindings: ApiBindings }>) {
  const authorization = c.req.header('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw authUnauthorizedError('Access token is required')
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token) {
    throw authUnauthorizedError('Access token is required')
  }

  try {
    return await verifyAccessToken({
      token,
      secret: getApiEnv(c.env).JWT_ACCESS_SECRET,
      expectedApp: 'web',
    })
  } catch {
    throw authUnauthorizedError('Access token is invalid')
  }
}

type ManagementTarget = {
  publicTarget: CompanionSkillBindingTarget
  directTarget: ResolvedSkillBindingTarget
  targets: ResolvedSkillBindingTarget[]
  skillScope?: CompanionSkillScope
}

async function resolveManagementTarget(params: {
  db: ApiDb
  userId: string
  target: CompanionSkillBindingTarget
}): Promise<ManagementTarget> {
  const userTarget: ResolvedSkillBindingTarget = {
    scopeType: 'user',
    scopeId: params.userId,
  }

  if (params.target.scopeType === 'user') {
    return {
      publicTarget: { scopeType: 'user', scopeId: null },
      directTarget: userTarget,
      targets: [userTarget],
    }
  }

  const scopeId = params.target.scopeId

  if (!scopeId) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Skill binding scope id is required', 400)
  }

  if (params.target.scopeType === 'agent') {
    const agent = await findUserAgentCompanionOwner(params.db, {
      userId: params.userId,
      agentId: scopeId,
    })

    if (!agent) {
      throw new AppError(BizCode.COMMON_NOT_FOUND, 'Agent companion is not found', 404)
    }

    const directTarget: ResolvedSkillBindingTarget = { scopeType: 'agent', scopeId }
    return {
      publicTarget: params.target,
      directTarget,
      targets: [directTarget, userTarget],
      skillScope: 'single_chat',
    }
  }

  if (params.target.scopeType === 'group') {
    const group = await findAgentGroupChat(params.db, {
      userId: params.userId,
      groupChatId: scopeId,
    })

    if (!group) {
      throw new AppError(BizCode.COMMON_NOT_FOUND, 'Agent group chat is not found', 404)
    }

    const directTarget: ResolvedSkillBindingTarget = { scopeType: 'group', scopeId }
    return {
      publicTarget: params.target,
      directTarget,
      targets: [directTarget, userTarget],
      skillScope: 'group_chat',
    }
  }

  const conversation = await findOwnedConversationSkillContext({
    db: params.db,
    userId: params.userId,
    conversationId: scopeId,
  })

  if (!conversation) {
    throw new AppError(BizCode.COMMON_NOT_FOUND, 'Agent conversation is not found', 404)
  }

  const directTarget: ResolvedSkillBindingTarget = { scopeType: 'conversation', scopeId }
  return {
    publicTarget: params.target,
    directTarget,
    targets: [
      directTarget,
      { scopeType: 'agent', scopeId: conversation.agentId },
      userTarget,
    ],
    skillScope: 'single_chat',
  }
}

function parseTargetFromQuery(c: Context<{ Bindings: ApiBindings }>) {
  const parsed = CompanionSkillBindingTargetSchema.safeParse({
    scopeType: c.req.query('scopeType') ?? 'user',
    scopeId: c.req.query('scopeId')?.trim() || null,
  })

  if (!parsed.success) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Invalid Skill binding target', 400, parsed.error.flatten())
  }

  return parsed.data
}

async function buildCatalog(params: {
  db: ApiDb
  userId: string
  target: ManagementTarget
}) {
  const bindings = await listSkillBindingsForUser(params.db, params.userId)
  return buildSkillCatalog({
    bindings,
    targets: params.target.targets,
    directTarget: params.target.directTarget,
    scope: params.target.skillScope,
  })
}

function toPermissionGrantResponse(grant: Awaited<ReturnType<typeof listSkillPermissionGrants>>[number]) {
  return {
    id: grant.id,
    skillId: grant.skillId,
    skillVersion: grant.skillVersion,
    permissionCode: grant.permissionCode,
    scopeType: grant.scopeType,
    scopeId: grant.scopeId,
    status: grant.status,
    grantedAtMs: grant.grantedAtMs,
    revokedAtMs: grant.revokedAtMs,
    updatedAtMs: grant.updatedAtMs,
  }
}

function toBackgroundJobResponse(job: SkillBackgroundJobRecord) {
  let note: string | null = null
  try {
    const payload = JSON.parse(job.payloadJson) as { note?: unknown }
    note = typeof payload.note === 'string' ? payload.note : null
  } catch {
    note = null
  }

  return {
    id: job.id,
    skillId: job.skillId,
    skillVersion: job.skillVersion,
    skillName: getRegisteredSkill(job.skillId, job.skillVersion)?.manifest.name ?? job.skillId,
    agentId: job.agentId,
    agentName: job.agentName,
    status: job.status,
    scheduledAtMs: job.scheduledAtMs,
    nextAttemptAtMs: job.nextAttemptAtMs,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    note,
    lastError: job.lastError,
    createdAtMs: job.createdAtMs,
    updatedAtMs: job.updatedAtMs,
    completedAtMs: job.completedAtMs,
    cancelledAtMs: job.cancelledAtMs,
  }
}

skillManagementRoute.get('/catalog', async (c) => {
  const claims = await requireWebAccessToken(c)
  const db = getDb(c.env.DB)
  const target = await resolveManagementTarget({
    db,
    userId: claims.sub,
    target: parseTargetFromQuery(c),
  })
  const items = await buildCatalog({ db, userId: claims.sub, target })
  const res = CompanionSkillCatalogResponseSchema.parse({
    target: target.publicTarget,
    items,
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

skillManagementRoute.patch(
  '/binding',
  zValidator(
    'json',
    UpdateCompanionSkillBindingRequestSchema,
    buildValidationErrorHandler('Invalid Skill binding payload'),
  ),
  async (c) => {
    const claims = await requireWebAccessToken(c)
    const payload = c.req.valid('json')
    const db = getDb(c.env.DB)
    const definition = getRegisteredSkill(payload.skillId)

    if (!definition) {
      throw new AppError(BizCode.COMMON_NOT_FOUND, 'Skill is not found', 404)
    }

    const target = await resolveManagementTarget({
      db,
      userId: claims.sub,
      target: payload.target,
    })

    if (target.skillScope && !definition.manifest.scopes.includes(target.skillScope)) {
      throw new AppError(BizCode.BIZ_RULE_VIOLATION, 'Skill is unavailable for this binding scope', 422)
    }

    if (payload.enabled === null) {
      await deleteSkillBinding({
        db,
        userId: claims.sub,
        scopeType: target.directTarget.scopeType,
        scopeId: target.directTarget.scopeId,
        skillId: definition.manifest.id,
      })
    } else {
      await upsertSkillBinding({
        db,
        id: uuidv7(),
        userId: claims.sub,
        scopeType: target.directTarget.scopeType,
        scopeId: target.directTarget.scopeId,
        skillId: definition.manifest.id,
        skillVersion: definition.manifest.version,
        enabled: payload.enabled,
        nowMs: Date.now(),
      })
    }

    const items = await buildCatalog({ db, userId: claims.sub, target })
    const item = items.find((candidate) => candidate.manifest.id === definition.manifest.id)

    if (!item) {
      throw new AppError(BizCode.SYSTEM_INTERNAL_ERROR, 'Failed to resolve Skill binding', 500)
    }

    const res = UpdateCompanionSkillBindingResponseSchema.parse(item)
    return c.json(buildSuccess(res, createApiMeta()))
  },
)

skillManagementRoute.get('/permissions', async (c) => {
  const claims = await requireWebAccessToken(c)
  const grants = await listSkillPermissionGrants({ db: getDb(c.env.DB), userId: claims.sub })
  const res = CompanionSkillPermissionGrantListResponseSchema.parse({
    items: grants.map(toPermissionGrantResponse),
  })
  return c.json(buildSuccess(res, createApiMeta()))
})

skillManagementRoute.patch(
  '/permissions',
  zValidator(
    'json',
    UpdateCompanionSkillPermissionGrantRequestSchema,
    buildValidationErrorHandler('Invalid Skill permission payload'),
  ),
  async (c) => {
    const claims = await requireWebAccessToken(c)
    const payload = c.req.valid('json')
    const db = getDb(c.env.DB)
    const definition = getRegisteredSkill(payload.skillId)

    if (!definition) {
      throw new AppError(BizCode.COMMON_NOT_FOUND, 'Skill is not found', 404)
    }

    const requirement = definition.manifest.permissions?.find((item) => item.code === payload.permissionCode)
    if (!requirement) {
      throw new AppError(BizCode.BIZ_RULE_VIOLATION, 'Permission is not declared by this Skill', 422)
    }

    let scopeId = claims.sub
    if (payload.target.scopeType === 'agent') {
      scopeId = payload.target.scopeId ?? ''
      const agent = await findUserAgentCompanionOwner(db, { userId: claims.sub, agentId: scopeId })
      if (!agent) throw new AppError(BizCode.COMMON_NOT_FOUND, 'Agent companion is not found', 404)
    }

    const nowMs = Date.now()
    const grant = await upsertSkillPermissionGrant({
      db,
      id: uuidv7(),
      userId: claims.sub,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      permissionCode: payload.permissionCode,
      scopeType: payload.target.scopeType,
      scopeId,
      granted: payload.granted,
      nowMs,
    })

    if (!grant) throw new AppError(BizCode.SYSTEM_INTERNAL_ERROR, 'Failed to update Skill permission', 500)

    await insertSkillAuditEvent({
      db,
      id: uuidv7(),
      userId: claims.sub,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      action: payload.granted ? 'permission.grant' : 'permission.revoke',
      decision: payload.granted ? 'allowed' : 'cancelled',
      reason: payload.granted ? 'User granted persistent permission' : 'User revoked persistent permission',
      scopeType: payload.target.scopeType,
      scopeId,
      metadata: { permissionCode: payload.permissionCode, riskLevel: requirement.riskLevel },
      nowMs,
    })

    const res = UpdateCompanionSkillPermissionGrantResponseSchema.parse({ grant: toPermissionGrantResponse(grant) })
    return c.json(buildSuccess(res, createApiMeta()))
  },
)

skillManagementRoute.get('/background-jobs', async (c) => {
  const claims = await requireWebAccessToken(c)
  const requestedLimit = Number(c.req.query('limit') ?? 20)
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 20
  const jobs = await listSkillBackgroundJobs({ db: getDb(c.env.DB), userId: claims.sub, limit })
  const res = CompanionSkillBackgroundJobListResponseSchema.parse({ items: jobs.map(toBackgroundJobResponse) })
  return c.json(buildSuccess(res, createApiMeta()))
})

skillManagementRoute.post(
  '/background-jobs',
  zValidator(
    'json',
    CreateCompanionSkillBackgroundJobRequestSchema,
    buildValidationErrorHandler('Invalid Background Skill job payload'),
  ),
  async (c) => {
    const claims = await requireWebAccessToken(c)
    const payload = c.req.valid('json')
    const db = getDb(c.env.DB)
    const definition = getBackgroundSkill(payload.skillId)

    if (!definition) throw new AppError(BizCode.COMMON_NOT_FOUND, 'Background Skill is not found', 404)

    const nowMs = Date.now()
    if (payload.scheduledAtMs < nowMs + 60_000 || payload.scheduledAtMs > nowMs + 365 * 24 * 60 * 60_000) {
      throw new AppError(BizCode.BIZ_RULE_VIOLATION, 'Schedule time must be between one minute and one year from now', 422)
    }

    const agent = await findUserAgentCompanionOwner(db, { userId: claims.sub, agentId: payload.agentId })
    if (!agent) throw new AppError(BizCode.COMMON_NOT_FOUND, 'Agent companion is not found', 404)

    const bindingTargets: ResolvedSkillBindingTarget[] = [
      { scopeType: 'agent', scopeId: agent.id },
      { scopeType: 'user', scopeId: claims.sub },
    ]
    const bindings = await listSkillBindingsForUser(db, claims.sub)
    const binding = findEffectiveBinding({ bindings, targets: bindingTargets, skillId: definition.manifest.id })
    if (!(binding?.enabled ?? definition.manifest.enabledByDefault)) {
      throw new AppError(BizCode.BIZ_RULE_VIOLATION, 'Background Skill is disabled', 422)
    }

    const policy = await evaluateSkillPolicy({
      db,
      userId: claims.sub,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      requirements: definition.manifest.permissions ?? [],
      targets: [
        { scopeType: 'agent', scopeId: agent.id },
        { scopeType: 'user', scopeId: claims.sub },
      ],
      action: 'background.schedule',
      targetId: agent.id,
    })
    if (!policy.allowed || !policy.grants[0]) {
      throw new AppError(BizCode.BIZ_RULE_VIOLATION, 'Proactive message permission is required', 422)
    }

    const conversation = await getOrCreateDefaultAgentConversation({
      db,
      id: uuidv7(),
      userId: claims.sub,
      agentId: agent.id,
      title: agent.name,
      nowMs,
    })
    const parsedPayload = definition.payloadSchema.parse({
      agentId: agent.id,
      agentName: agent.name,
      conversationId: conversation.id,
      note: payload.note?.trim() || null,
    })
    const job = await createSkillBackgroundJob({
      db,
      id: uuidv7(),
      userId: claims.sub,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      agentId: agent.id,
      conversationId: conversation.id,
      permissionGrantId: policy.grants[0].id,
      payloadJson: JSON.stringify(parsedPayload),
      scheduledAtMs: payload.scheduledAtMs,
      maxAttempts: definition.maxAttempts,
      nowMs,
    })
    if (!job) throw new AppError(BizCode.SYSTEM_INTERNAL_ERROR, 'Failed to create Background Skill job', 500)

    await insertSkillAuditEvent({
      db,
      id: uuidv7(),
      userId: claims.sub,
      skillId: definition.manifest.id,
      skillVersion: definition.manifest.version,
      action: 'background.schedule',
      decision: 'succeeded',
      reason: 'User scheduled Background Skill job',
      scopeType: 'agent',
      scopeId: agent.id,
      targetId: job.id,
      metadata: { scheduledAtMs: payload.scheduledAtMs },
      nowMs,
    })

    const res = CreateCompanionSkillBackgroundJobResponseSchema.parse({ job: toBackgroundJobResponse(job) })
    return c.json(buildSuccess(res, createApiMeta()))
  },
)

skillManagementRoute.post('/background-jobs/:jobId/cancel', async (c) => {
  const claims = await requireWebAccessToken(c)
  const jobId = c.req.param('jobId')?.trim()
  if (!jobId) throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Background Skill job id is required', 400)

  const db = getDb(c.env.DB)
  const existing = await findSkillBackgroundJob({ db, userId: claims.sub, jobId })
  if (!existing) throw new AppError(BizCode.COMMON_NOT_FOUND, 'Background Skill job is not found', 404)
  if (existing.status === 'cancelled') {
    const res = CancelCompanionSkillBackgroundJobResponseSchema.parse({ job: toBackgroundJobResponse(existing) })
    return c.json(buildSuccess(res, createApiMeta()))
  }
  if (!['scheduled', 'retrying'].includes(existing.status)) {
    throw new AppError(BizCode.BIZ_CONFLICT, 'Background Skill job can no longer be cancelled', 409)
  }

  const cancelled = await cancelSkillBackgroundJob({
    db,
    userId: claims.sub,
    jobId,
    expectedRevision: existing.revision,
    nowMs: Date.now(),
  })
  if (!cancelled) throw new AppError(BizCode.BIZ_CONFLICT, 'Background Skill job was updated by another request', 409)

  await insertSkillAuditEvent({
    db,
    id: uuidv7(),
    userId: claims.sub,
    skillId: cancelled.skillId,
    skillVersion: cancelled.skillVersion,
    action: 'background.cancel',
    decision: 'cancelled',
    reason: 'User cancelled Background Skill job',
    scopeType: 'agent',
    scopeId: cancelled.agentId,
    targetId: cancelled.id,
    nowMs: Date.now(),
  })
  const res = CancelCompanionSkillBackgroundJobResponseSchema.parse({ job: toBackgroundJobResponse(cancelled) })
  return c.json(buildSuccess(res, createApiMeta()))
})

skillManagementRoute.get('/runs', async (c) => {
  const claims = await requireWebAccessToken(c)
  const requestedLimit = Number(c.req.query('limit') ?? 30)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 30
  const rows = await listSkillRunsForUser({
    db: getDb(c.env.DB),
    userId: claims.sub,
    limit,
  })
  const res = CompanionSkillRunListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      skillVersion: row.skillVersion,
      skillName: getRegisteredSkill(row.skillId, row.skillVersion)?.manifest.name ?? row.skillId,
      skillKind: row.skillKind,
      sessionId: row.sessionId,
      chatScope: row.chatScope,
      bindingSource: row.bindingSource,
      trigger: row.trigger,
      score: row.score,
      reason: row.reason,
      status: row.status,
      agentId: row.agentId,
      groupChatId: row.groupChatId,
      conversationId: row.conversationId,
      latencyMs: row.latencyMs,
      createdAtMs: row.createdAtMs,
      completedAtMs: row.completedAtMs,
    })),
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

skillManagementRoute.get('/evaluations/summary', async (c) => {
  await requireWebAccessToken(c)
  const evaluation = await evaluateSkillSelectors()
  const res = CompanionSkillEvaluationSummarySchema.parse({
    total: evaluation.total,
    passed: evaluation.passed,
    failed: evaluation.failed,
    passRate: evaluation.passRate,
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

function toSessionResponse(session: SkillSessionRecord) {
  return {
    id: session.id,
    skillId: session.skillId,
    skillVersion: session.skillVersion,
    skillName: getRegisteredSkill(session.skillId, session.skillVersion)?.manifest.name ?? session.skillId,
    chatScope: session.chatScope,
    bindingSource: session.bindingSource,
    scopeType: session.scopeType,
    scopeId: session.scopeId,
    status: session.status,
    currentStep: session.currentStep,
    pendingQuestion: session.pendingQuestion,
    revision: session.revision,
    createdAtMs: session.createdAtMs,
    updatedAtMs: session.updatedAtMs,
    expiresAtMs: session.expiresAtMs,
    completedAtMs: session.completedAtMs,
    cancelledAtMs: session.cancelledAtMs,
  }
}

skillManagementRoute.get('/sessions', async (c) => {
  const claims = await requireWebAccessToken(c)
  const activeOnly = c.req.query('activeOnly') !== 'false'
  const requestedLimit = Number(c.req.query('limit') ?? 20)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 20
  const sessions = await listSkillSessionsForUser({
    db: getDb(c.env.DB),
    userId: claims.sub,
    limit,
    activeOnly,
    nowMs: Date.now(),
  })
  const res = CompanionSkillSessionListResponseSchema.parse({
    items: sessions.map(toSessionResponse),
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

skillManagementRoute.post('/sessions/:sessionId/cancel', async (c) => {
  const claims = await requireWebAccessToken(c)
  const sessionId = c.req.param('sessionId')?.trim()

  if (!sessionId) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, 'Skill session id is required', 400)
  }

  const db = getDb(c.env.DB)
  const existing = await findSkillSessionById({
    db,
    userId: claims.sub,
    sessionId,
  })

  if (!existing) {
    throw new AppError(BizCode.COMMON_NOT_FOUND, 'Skill session is not found', 404)
  }

  if (existing.status === 'cancelled') {
    const res = CancelCompanionSkillSessionResponseSchema.parse({
      session: toSessionResponse(existing),
    })
    return c.json(buildSuccess(res, createApiMeta()))
  }

  if (!['active', 'waiting_user'].includes(existing.status)) {
    throw new AppError(BizCode.BIZ_CONFLICT, 'Skill session is no longer active', 409)
  }

  const cancelled = await cancelSkillSession({
    db,
    userId: claims.sub,
    sessionId,
    expectedRevision: existing.revision,
    nowMs: Date.now(),
  })

  if (!cancelled) {
    throw new AppError(BizCode.BIZ_CONFLICT, 'Skill session was updated by another request', 409)
  }

  const nowMs = Date.now()

  try {
    await insertSkillRun({
      db,
      id: uuidv7(),
      userId: claims.sub,
      skillId: cancelled.skillId,
      skillVersion: cancelled.skillVersion,
      skillKind: 'workflow',
      sessionId: cancelled.id,
      chatScope: cancelled.chatScope,
      bindingSource: cancelled.bindingSource,
      trigger: 'session',
      score: 100,
      reason: '用户从 Skills 管理页面取消 Workflow Session',
      status: 'cancelled',
      agentId: cancelled.scopeType === 'agent' ? cancelled.scopeId : null,
      groupChatId: cancelled.scopeType === 'group' ? cancelled.scopeId : null,
      conversationId: cancelled.scopeType === 'conversation' ? cancelled.scopeId : null,
      latencyMs: 0,
      createdAtMs: nowMs,
      completedAtMs: nowMs,
    })
  } catch (error) {
    console.error('Failed to record cancelled Skill session run', error)
  }

  const res = CancelCompanionSkillSessionResponseSchema.parse({
    session: toSessionResponse(cancelled),
  })

  return c.json(buildSuccess(res, createApiMeta()))
})

export default skillManagementRoute
