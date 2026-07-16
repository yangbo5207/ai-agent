import { z } from 'zod'

export const CompanionSkillScopeSchema = z.enum([
  'single_chat',
  'group_chat',
  'background',
])

export const CompanionSkillKindSchema = z.enum([
  'prompt',
  'workflow',
  'tool',
  'background',
])

export const CompanionSkillTriggerSchema = z.enum([
  'explicit',
  'rule',
  'session',
  'schedule',
])

export const CompanionSkillBindingScopeTypeSchema = z.enum([
  'user',
  'agent',
  'group',
  'conversation',
])

export const CompanionSkillBindingSourceSchema = z.enum([
  'default',
  'user',
  'agent',
  'group',
  'conversation',
])

export const CompanionSkillPermissionCodeSchema = z.enum([
  'memory:read',
  'proactive_message:write',
])

export const CompanionSkillRiskLevelSchema = z.enum([
  'L0',
  'L1',
  'L2',
  'L3',
  'L4',
])

export const CompanionSkillApprovalModeSchema = z.enum([
  'none',
  'persistent',
  'per_operation',
])

export const CompanionSkillPermissionRequirementSchema = z.object({
  code: CompanionSkillPermissionCodeSchema,
  riskLevel: CompanionSkillRiskLevelSchema,
  approvalMode: CompanionSkillApprovalModeSchema,
})

export const CompanionSkillManifestSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  kind: CompanionSkillKindSchema,
  scopes: z.array(CompanionSkillScopeSchema)
    .min(1)
    .refine((scopes) => new Set(scopes).size === scopes.length, 'Skill scopes must be unique'),
  triggerExamples: z.array(z.string().trim().min(1).max(160)).max(12),
  priority: z.number().int().min(0).max(100),
  enabledByDefault: z.boolean(),
  permissions: z.array(CompanionSkillPermissionRequirementSchema).max(8).optional(),
})

export const CompanionSkillSelectionSchema = z.object({
  skillId: CompanionSkillManifestSchema.shape.id,
  skillVersion: CompanionSkillManifestSchema.shape.version,
  skillKind: CompanionSkillKindSchema,
  trigger: CompanionSkillTriggerSchema,
  score: z.number().int().min(0),
  reason: z.string().trim().min(1).max(240),
})

export const CompanionSkillBindingTargetSchema = z.object({
  scopeType: CompanionSkillBindingScopeTypeSchema,
  scopeId: z.string().trim().min(1).max(160).nullable(),
}).superRefine((target, context) => {
  if (target.scopeType === 'user' && target.scopeId !== null) {
    context.addIssue({
      code: 'custom',
      message: 'User scope does not accept a scope id',
      path: ['scopeId'],
    })
  }

  if (target.scopeType !== 'user' && target.scopeId === null) {
    context.addIssue({
      code: 'custom',
      message: `${target.scopeType} scope requires a scope id`,
      path: ['scopeId'],
    })
  }
})

export const CompanionSkillBindingSchema = z.object({
  id: z.string().trim().min(1),
  skillId: CompanionSkillManifestSchema.shape.id,
  skillVersion: CompanionSkillManifestSchema.shape.version.nullable(),
  scopeType: CompanionSkillBindingScopeTypeSchema,
  scopeId: z.string().trim().min(1),
  enabled: z.boolean(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
})

export const CompanionSkillCatalogItemSchema = z.object({
  manifest: CompanionSkillManifestSchema,
  effectiveEnabled: z.boolean(),
  bindingSource: CompanionSkillBindingSourceSchema,
  overrideEnabled: z.boolean().nullable(),
})

export const CompanionSkillCatalogResponseSchema = z.object({
  target: CompanionSkillBindingTargetSchema,
  items: z.array(CompanionSkillCatalogItemSchema),
})

export const UpdateCompanionSkillBindingRequestSchema = z.object({
  target: CompanionSkillBindingTargetSchema,
  skillId: CompanionSkillManifestSchema.shape.id,
  enabled: z.boolean().nullable(),
})

export const UpdateCompanionSkillBindingResponseSchema = CompanionSkillCatalogItemSchema

export const CompanionSkillRunStatusSchema = z.enum([
  'waiting_user',
  'completed',
  'denied',
  'cancelled',
  'expired',
  'failed',
])

export const CompanionSkillRunSchema = z.object({
  id: z.string().trim().min(1),
  skillId: CompanionSkillManifestSchema.shape.id,
  skillVersion: CompanionSkillManifestSchema.shape.version,
  skillName: z.string().trim().min(1).max(80),
  skillKind: CompanionSkillKindSchema,
  sessionId: z.string().trim().min(1).nullable(),
  chatScope: CompanionSkillScopeSchema,
  bindingSource: CompanionSkillBindingSourceSchema,
  trigger: CompanionSkillTriggerSchema,
  score: z.number().int().min(0),
  reason: z.string().trim().min(1).max(240),
  status: CompanionSkillRunStatusSchema,
  agentId: z.string().trim().min(1).nullable(),
  groupChatId: z.string().trim().min(1).nullable(),
  conversationId: z.string().trim().min(1).nullable(),
  latencyMs: z.number().int().nonnegative(),
  createdAtMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().nullable(),
})

export const CompanionSkillRunListResponseSchema = z.object({
  items: z.array(CompanionSkillRunSchema),
})

export const CompanionSkillEvaluationSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(1),
})

export const CompanionSkillSessionScopeTypeSchema = z.enum([
  'agent',
  'group',
  'conversation',
])

export const CompanionSkillSessionStatusSchema = z.enum([
  'active',
  'waiting_user',
  'completed',
  'cancelled',
  'expired',
  'failed',
])

export const CompanionSkillSessionSchema = z.object({
  id: z.string().trim().min(1),
  skillId: CompanionSkillManifestSchema.shape.id,
  skillVersion: CompanionSkillManifestSchema.shape.version,
  skillName: z.string().trim().min(1).max(80),
  chatScope: CompanionSkillScopeSchema,
  bindingSource: CompanionSkillBindingSourceSchema,
  scopeType: CompanionSkillSessionScopeTypeSchema,
  scopeId: z.string().trim().min(1),
  status: CompanionSkillSessionStatusSchema,
  currentStep: z.string().trim().min(1).max(80),
  pendingQuestion: z.string().trim().min(1).max(500).nullable(),
  revision: z.number().int().nonnegative(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().nullable(),
  cancelledAtMs: z.number().int().nonnegative().nullable(),
})

export const CompanionSkillSessionListResponseSchema = z.object({
  items: z.array(CompanionSkillSessionSchema),
})

export const CancelCompanionSkillSessionResponseSchema = z.object({
  session: CompanionSkillSessionSchema,
})

export const CompanionSkillPermissionScopeTypeSchema = z.enum([
  'user',
  'agent',
])

export const CompanionSkillPermissionTargetSchema = z.object({
  scopeType: CompanionSkillPermissionScopeTypeSchema,
  scopeId: z.string().trim().min(1).max(160).nullable(),
}).superRefine((target, context) => {
  if (target.scopeType === 'user' && target.scopeId !== null) {
    context.addIssue({
      code: 'custom',
      message: 'User permission scope does not accept a scope id',
      path: ['scopeId'],
    })
  }

  if (target.scopeType === 'agent' && target.scopeId === null) {
    context.addIssue({
      code: 'custom',
      message: 'Agent permission scope requires a scope id',
      path: ['scopeId'],
    })
  }
})

export const CompanionSkillPermissionGrantStatusSchema = z.enum([
  'active',
  'revoked',
])

export const CompanionSkillPermissionGrantSchema = z.object({
  id: z.string().trim().min(1),
  skillId: CompanionSkillManifestSchema.shape.id,
  skillVersion: CompanionSkillManifestSchema.shape.version,
  permissionCode: CompanionSkillPermissionCodeSchema,
  scopeType: CompanionSkillPermissionScopeTypeSchema,
  scopeId: z.string().trim().min(1),
  status: CompanionSkillPermissionGrantStatusSchema,
  grantedAtMs: z.number().int().nonnegative(),
  revokedAtMs: z.number().int().nonnegative().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
})

export const CompanionSkillPermissionGrantListResponseSchema = z.object({
  items: z.array(CompanionSkillPermissionGrantSchema),
})

export const UpdateCompanionSkillPermissionGrantRequestSchema = z.object({
  target: CompanionSkillPermissionTargetSchema,
  skillId: CompanionSkillManifestSchema.shape.id,
  permissionCode: CompanionSkillPermissionCodeSchema,
  granted: z.boolean(),
})

export const UpdateCompanionSkillPermissionGrantResponseSchema = z.object({
  grant: CompanionSkillPermissionGrantSchema,
})

export const CompanionSkillBackgroundJobStatusSchema = z.enum([
  'scheduled',
  'running',
  'retrying',
  'completed',
  'failed',
  'cancelled',
])

export const CompanionSkillBackgroundJobSchema = z.object({
  id: z.string().trim().min(1),
  skillId: CompanionSkillManifestSchema.shape.id,
  skillVersion: CompanionSkillManifestSchema.shape.version,
  skillName: z.string().trim().min(1).max(80),
  agentId: z.string().trim().min(1),
  agentName: z.string().trim().min(1).max(80),
  status: CompanionSkillBackgroundJobStatusSchema,
  scheduledAtMs: z.number().int().nonnegative(),
  nextAttemptAtMs: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  note: z.string().trim().max(500).nullable(),
  lastError: z.string().trim().max(500).nullable(),
  createdAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().nullable(),
  cancelledAtMs: z.number().int().nonnegative().nullable(),
})

export const CompanionSkillBackgroundJobListResponseSchema = z.object({
  items: z.array(CompanionSkillBackgroundJobSchema),
})

export const CreateCompanionSkillBackgroundJobRequestSchema = z.object({
  skillId: CompanionSkillManifestSchema.shape.id,
  agentId: z.string().trim().min(1).max(160),
  scheduledAtMs: z.number().int().nonnegative(),
  note: z.string().trim().max(500).optional(),
})

export const CreateCompanionSkillBackgroundJobResponseSchema = z.object({
  job: CompanionSkillBackgroundJobSchema,
})

export const CancelCompanionSkillBackgroundJobResponseSchema = z.object({
  job: CompanionSkillBackgroundJobSchema,
})

export type CompanionSkillScope = z.infer<typeof CompanionSkillScopeSchema>
export type CompanionSkillKind = z.infer<typeof CompanionSkillKindSchema>
export type CompanionSkillTrigger = z.infer<typeof CompanionSkillTriggerSchema>
export type CompanionSkillBindingScopeType = z.infer<typeof CompanionSkillBindingScopeTypeSchema>
export type CompanionSkillBindingSource = z.infer<typeof CompanionSkillBindingSourceSchema>
export type CompanionSkillPermissionCode = z.infer<typeof CompanionSkillPermissionCodeSchema>
export type CompanionSkillRiskLevel = z.infer<typeof CompanionSkillRiskLevelSchema>
export type CompanionSkillApprovalMode = z.infer<typeof CompanionSkillApprovalModeSchema>
export type CompanionSkillPermissionRequirement = z.infer<typeof CompanionSkillPermissionRequirementSchema>
export type CompanionSkillManifest = z.infer<typeof CompanionSkillManifestSchema>
export type CompanionSkillSelection = z.infer<typeof CompanionSkillSelectionSchema>
export type CompanionSkillBindingTarget = z.infer<typeof CompanionSkillBindingTargetSchema>
export type CompanionSkillBinding = z.infer<typeof CompanionSkillBindingSchema>
export type CompanionSkillCatalogItem = z.infer<typeof CompanionSkillCatalogItemSchema>
export type CompanionSkillCatalogResponse = z.infer<typeof CompanionSkillCatalogResponseSchema>
export type UpdateCompanionSkillBindingRequest = z.infer<typeof UpdateCompanionSkillBindingRequestSchema>
export type UpdateCompanionSkillBindingResponse = z.infer<typeof UpdateCompanionSkillBindingResponseSchema>
export type CompanionSkillRunStatus = z.infer<typeof CompanionSkillRunStatusSchema>
export type CompanionSkillRun = z.infer<typeof CompanionSkillRunSchema>
export type CompanionSkillRunListResponse = z.infer<typeof CompanionSkillRunListResponseSchema>
export type CompanionSkillEvaluationSummary = z.infer<typeof CompanionSkillEvaluationSummarySchema>
export type CompanionSkillSessionScopeType = z.infer<typeof CompanionSkillSessionScopeTypeSchema>
export type CompanionSkillSessionStatus = z.infer<typeof CompanionSkillSessionStatusSchema>
export type CompanionSkillSession = z.infer<typeof CompanionSkillSessionSchema>
export type CompanionSkillSessionListResponse = z.infer<typeof CompanionSkillSessionListResponseSchema>
export type CancelCompanionSkillSessionResponse = z.infer<typeof CancelCompanionSkillSessionResponseSchema>
export type CompanionSkillPermissionScopeType = z.infer<typeof CompanionSkillPermissionScopeTypeSchema>
export type CompanionSkillPermissionTarget = z.infer<typeof CompanionSkillPermissionTargetSchema>
export type CompanionSkillPermissionGrantStatus = z.infer<typeof CompanionSkillPermissionGrantStatusSchema>
export type CompanionSkillPermissionGrant = z.infer<typeof CompanionSkillPermissionGrantSchema>
export type CompanionSkillPermissionGrantListResponse = z.infer<typeof CompanionSkillPermissionGrantListResponseSchema>
export type UpdateCompanionSkillPermissionGrantRequest = z.infer<typeof UpdateCompanionSkillPermissionGrantRequestSchema>
export type UpdateCompanionSkillPermissionGrantResponse = z.infer<typeof UpdateCompanionSkillPermissionGrantResponseSchema>
export type CompanionSkillBackgroundJobStatus = z.infer<typeof CompanionSkillBackgroundJobStatusSchema>
export type CompanionSkillBackgroundJob = z.infer<typeof CompanionSkillBackgroundJobSchema>
export type CompanionSkillBackgroundJobListResponse = z.infer<typeof CompanionSkillBackgroundJobListResponseSchema>
export type CreateCompanionSkillBackgroundJobRequest = z.infer<typeof CreateCompanionSkillBackgroundJobRequestSchema>
export type CreateCompanionSkillBackgroundJobResponse = z.infer<typeof CreateCompanionSkillBackgroundJobResponseSchema>
export type CancelCompanionSkillBackgroundJobResponse = z.infer<typeof CancelCompanionSkillBackgroundJobResponseSchema>
