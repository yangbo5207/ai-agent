import { uuidv7 } from 'uuidv7'
import type { CompanionSkillPermissionRequirement } from '@repo/contracts'
import type { ApiDb } from '@/db/client'
import {
  insertSkillAuditEvent,
  listSkillPermissionGrants,
  type SkillPermissionGrantRecord,
} from '../controlled-repository'

export type SkillPermissionTarget = { scopeType: 'user' | 'agent'; scopeId: string }

export type SkillPolicyDecision = {
  allowed: boolean
  reason: string
  grants: SkillPermissionGrantRecord[]
  missing: CompanionSkillPermissionRequirement[]
}

export async function evaluateSkillPolicy(params: {
  db: ApiDb
  userId: string
  skillId: string
  skillVersion: string
  requirements: readonly CompanionSkillPermissionRequirement[]
  targets: readonly SkillPermissionTarget[]
  action: string
  targetId?: string | null
}): Promise<SkillPolicyDecision> {
  const grants = await listSkillPermissionGrants({ db: params.db, userId: params.userId })
  const matched: SkillPermissionGrantRecord[] = []
  const missing = params.requirements.filter((requirement) => {
    if (requirement.approvalMode === 'none') return false
    const grant = params.targets
      .map((target) => grants.find((candidate) => (
        candidate.skillId === params.skillId
        && candidate.permissionCode === requirement.code
        && candidate.scopeType === target.scopeType
        && candidate.scopeId === target.scopeId
        && candidate.status === 'active'
      )))
      .find(Boolean)
    if (grant) matched.push(grant)
    return !grant
  })
  const allowed = missing.length === 0
  const reason = allowed
    ? 'All declared Skill permissions are active'
    : `Missing permission: ${missing.map((item) => item.code).join(', ')}`
  const auditTarget = params.targets[0] ?? { scopeType: 'user' as const, scopeId: params.userId }

  await insertSkillAuditEvent({
    db: params.db,
    id: uuidv7(),
    userId: params.userId,
    skillId: params.skillId,
    skillVersion: params.skillVersion,
    action: params.action,
    decision: allowed ? 'allowed' : 'denied',
    reason,
    scopeType: auditTarget.scopeType,
    scopeId: auditTarget.scopeId,
    targetId: params.targetId,
    metadata: { permissions: params.requirements.map((item) => item.code) },
    nowMs: Date.now(),
  })

  return { allowed, reason, grants: matched, missing }
}
