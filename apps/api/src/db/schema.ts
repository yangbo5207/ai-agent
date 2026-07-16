import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  displayName: text('display_name'),
  primaryEmailId: text('primary_email_id'),
  avatarKey: text('avatar_key'),
  createdAtMs: integer('created_at_ms').notNull(),
  updatedAtMs: integer('updated_at_ms').notNull(),
  lastLoginAtMs: integer('last_login_at_ms'),
})

export const defaultAvatarVersions = sqliteTable('default_avatar_versions', {
  id: text('id').primaryKey(),
  avatarKey: text('avatar_key').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAtMs: integer('created_at_ms').notNull(),
}, (table) => [
  index('idx_default_avatar_versions_created_at_ms').on(table.createdAtMs),
])

export const userEmails = sqliteTable(
  'user_emails',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    isPrimary: integer('is_primary').notNull(),
    isVerified: integer('is_verified').notNull(),
    verifiedAtMs: integer('verified_at_ms'),
    source: text('source').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_emails_normalized_email_unique').on(table.normalizedEmail),
    uniqueIndex('idx_user_emails_user_normalized_unique').on(table.userId, table.normalizedEmail),
    uniqueIndex('idx_user_emails_one_primary_per_user').on(table.userId).where(sql`${table.isPrimary} = 1`),
  ],
)

export const passwordCredentials = sqliteTable(
  'password_credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailId: text('email_id')
      .notNull()
      .references(() => userEmails.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    passwordAlgo: text('password_algo').notNull(),
    passwordUpdatedAtMs: integer('password_updated_at_ms').notNull(),
    failedAttempts: integer('failed_attempts').notNull(),
    lockedUntilMs: integer('locked_until_ms'),
    mustResetPassword: integer('must_reset_password').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_password_credentials_user_unique').on(table.userId),
    uniqueIndex('idx_password_credentials_email_unique').on(table.emailId),
  ],
)

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [uniqueIndex('idx_applications_code_unique').on(table.code)],
)

export const applicationAuthMethods = sqliteTable(
  'application_auth_methods',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    enabled: integer('enabled').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_application_auth_methods_unique').on(table.applicationId, table.provider),
  ],
)

export const roles = sqliteTable(
  'roles',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
    disabledAtMs: integer('disabled_at_ms'),
    deletedAtMs: integer('deleted_at_ms'),
  },
  (table) => [uniqueIndex('idx_roles_application_code_unique').on(table.applicationId, table.code)],
)

export const subscriptionPlans = sqliteTable('subscription_plans', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: text('price').notNull(),
  billingPeriod: text('billing_period').notNull(),
  maxAgents: integer('max_agents').notNull(),
  supportsGroupChat: integer('supports_group_chat').notNull(),
  supportsMultiAgentLinkage: integer('supports_multi_agent_linkage').notNull(),
  supportsDiscoverSquare: integer('supports_discover_square').notNull(),
  supportsAgentTimeEvolution: integer('supports_agent_time_evolution').notNull(),
  status: text('status').notNull(),
  createdAtMs: integer('created_at_ms').notNull(),
  updatedAtMs: integer('updated_at_ms').notNull(),
  deletedAtMs: integer('deleted_at_ms'),
}, (table) => [
  uniqueIndex('idx_subscription_plans_code_unique').on(table.code),
])

export const userSubscriptionBindings = sqliteTable(
  'user_subscription_bindings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subscriptionPlanId: text('subscription_plan_id')
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
    status: text('status').notNull(),
    assignedAtMs: integer('assigned_at_ms').notNull(),
    assignedByUserId: text('assigned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    revokedAtMs: integer('revoked_at_ms'),
  },
  (table) => [
    index('idx_user_subscription_bindings_user_id').on(table.userId),
    index('idx_user_subscription_bindings_plan_id').on(table.subscriptionPlanId),
    uniqueIndex('idx_user_subscription_bindings_one_active_per_user').on(table.userId).where(sql`${table.status} = 'active'`),
  ],
)

export const financialBills = sqliteTable(
  'financial_bills',
  {
    id: text('id').primaryKey(),
    wechatNickname: text('wechat_nickname').notNull(),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    paidAmountCents: integer('paid_amount_cents').notNull(),
    paidAtMs: integer('paid_at_ms').notNull(),
    billingMonth: text('billing_month').notNull(),
    isRefunded: integer('is_refunded').notNull(),
    refundAmountCents: integer('refund_amount_cents').notNull(),
    note: text('note'),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    index('idx_financial_bills_billing_month_paid_at').on(table.billingMonth, table.paidAtMs, table.id),
    index('idx_financial_bills_normalized_email').on(table.normalizedEmail),
  ],
)

export const userAgentCompanions = sqliteTable(
  'user_agent_companions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    headline: text('headline'),
    description: text('description'),
    storyBackground: text('story_background'),
    personalityPrompt: text('personality_prompt'),
    tonePrompt: text('tone_prompt'),
    guardrailsPrompt: text('guardrails_prompt'),
    openingMessage: text('opening_message'),
    defaultPrompt: text('default_prompt'),
    visibility: text('visibility'),
    imageKey: text('image_key'),
    lastAssistantMessage: text('last_assistant_message'),
    lastAssistantMessageAtMs: integer('last_assistant_message_at_ms'),
    status: text('status').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
    publishedAtMs: integer('published_at_ms'),
    archivedAtMs: integer('archived_at_ms'),
  },
  (table) => [
    index('idx_user_agent_companions_user_id').on(table.userId),
    index('idx_user_agent_companions_user_status').on(table.userId, table.status),
  ],
)

export const agentConversations = sqliteTable(
  'agent_conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    title: text('title'),
    summary: text('summary'),
    messageCount: integer('message_count').notNull(),
    lastMessageAtMs: integer('last_message_at_ms'),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_agent_conversations_user_agent_unique').on(table.userId, table.agentId),
    index('idx_agent_conversations_user_updated').on(table.userId, table.updatedAtMs),
  ],
)

export const agentConversationMessages = sqliteTable(
  'agent_conversation_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    status: text('status').notNull(),
    metadataJson: text('metadata_json'),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [
    index('idx_agent_conversation_messages_conversation_created').on(table.conversationId, table.createdAtMs, table.id),
    index('idx_agent_conversation_messages_agent_created').on(table.userId, table.agentId, table.createdAtMs),
  ],
)

export const agentMemories = sqliteTable(
  'agent_memories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    content: text('content').notNull(),
    importance: integer('importance').notNull(),
    status: text('status').notNull(),
    sourceMessageId: text('source_message_id').references(() => agentConversationMessages.id, { onDelete: 'set null' }),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    index('idx_agent_memories_agent_status_importance').on(table.userId, table.agentId, table.status, table.importance, table.updatedAtMs),
    index('idx_agent_memories_source_message').on(table.sourceMessageId),
  ],
)

export const agentMessageFeedbacks = sqliteTable(
  'agent_message_feedbacks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id')
      .notNull()
      .references(() => agentConversationMessages.id, { onDelete: 'cascade' }),
    rating: text('rating').notNull(),
    reason: text('reason'),
    note: text('note'),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_agent_message_feedbacks_user_message_unique').on(table.userId, table.messageId),
    index('idx_agent_message_feedbacks_agent_updated').on(table.userId, table.agentId, table.updatedAtMs),
    index('idx_agent_message_feedbacks_message').on(table.messageId),
  ],
)

export const agentCarePlans = sqliteTable(
  'agent_care_plans',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    enabled: integer('enabled').notNull(),
    frequency: text('frequency').notNull(),
    preferredTime: text('preferred_time'),
    scenesJson: text('scenes_json').notNull(),
    tone: text('tone').notNull(),
    customPrompt: text('custom_prompt'),
    nextRunAtMs: integer('next_run_at_ms'),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_agent_care_plans_user_agent_unique').on(table.userId, table.agentId),
    index('idx_agent_care_plans_next_run').on(table.enabled, table.nextRunAtMs),
  ],
)

export const agentCareEvents = sqliteTable(
  'agent_care_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    carePlanId: text('care_plan_id').references(() => agentCarePlans.id, { onDelete: 'set null' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id')
      .notNull()
      .references(() => agentConversationMessages.id, { onDelete: 'cascade' }),
    scene: text('scene').notNull(),
    status: text('status').notNull(),
    message: text('message').notNull(),
    metadataJson: text('metadata_json'),
    generatedAtMs: integer('generated_at_ms').notNull(),
    readAtMs: integer('read_at_ms'),
  },
  (table) => [
    index('idx_agent_care_events_agent_generated').on(table.userId, table.agentId, table.generatedAtMs),
    index('idx_agent_care_events_message').on(table.messageId),
  ],
)

export const agentGroupChats = sqliteTable(
  'agent_group_chats',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    messageCount: integer('message_count').notNull(),
    lastMessageAtMs: integer('last_message_at_ms'),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    index('idx_agent_group_chats_user_updated').on(table.userId, table.updatedAtMs, table.id),
  ],
)

export const agentGroupChatMembers = sqliteTable(
  'agent_group_chat_members',
  {
    id: text('id').primaryKey(),
    groupChatId: text('group_chat_id')
      .notNull()
      .references(() => agentGroupChats.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull(),
    status: text('status').notNull(),
    joinedAtMs: integer('joined_at_ms').notNull(),
    removedAtMs: integer('removed_at_ms'),
  },
  (table) => [
    uniqueIndex('idx_agent_group_chat_members_unique_active')
      .on(table.groupChatId, table.agentId)
      .where(sql`${table.status} = 'active'`),
    index('idx_agent_group_chat_members_group_order').on(table.groupChatId, table.status, table.displayOrder, table.id),
  ],
)

export const agentGroupChatMessages = sqliteTable(
  'agent_group_chat_messages',
  {
    id: text('id').primaryKey(),
    groupChatId: text('group_chat_id')
      .notNull()
      .references(() => agentGroupChats.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderType: text('sender_type').notNull(),
    agentId: text('agent_id').references(() => userAgentCompanions.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    status: text('status').notNull(),
    turnIndex: integer('turn_index').notNull(),
    metadataJson: text('metadata_json'),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [
    index('idx_agent_group_chat_messages_group_created').on(table.groupChatId, table.createdAtMs, table.id),
    index('idx_agent_group_chat_messages_user_group').on(table.userId, table.groupChatId, table.createdAtMs),
  ],
)

export const skillBindings = sqliteTable(
  'skill_bindings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: text('scope_type').notNull(),
    scopeId: text('scope_id').notNull(),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version'),
    enabled: integer('enabled').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_skill_bindings_scope_skill_unique')
      .on(table.userId, table.scopeType, table.scopeId, table.skillId),
    index('idx_skill_bindings_user_scope').on(table.userId, table.scopeType, table.scopeId),
  ],
)

export const skillRuns = sqliteTable(
  'skill_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version').notNull(),
    skillKind: text('skill_kind').notNull(),
    sessionId: text('session_id'),
    chatScope: text('chat_scope').notNull(),
    bindingSource: text('binding_source').notNull(),
    triggerType: text('trigger_type').notNull(),
    score: integer('score').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull(),
    agentId: text('agent_id'),
    groupChatId: text('group_chat_id'),
    conversationId: text('conversation_id'),
    latencyMs: integer('latency_ms').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    completedAtMs: integer('completed_at_ms'),
  },
  (table) => [
    index('idx_skill_runs_user_created').on(table.userId, table.createdAtMs, table.id),
    index('idx_skill_runs_user_skill_created').on(table.userId, table.skillId, table.createdAtMs),
    index('idx_skill_runs_session_created').on(table.sessionId, table.createdAtMs),
  ],
)

export const skillSessions = sqliteTable(
  'skill_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version').notNull(),
    chatScope: text('chat_scope').notNull(),
    bindingSource: text('binding_source').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeId: text('scope_id').notNull(),
    status: text('status').notNull(),
    currentStep: text('current_step').notNull(),
    stateJson: text('state_json').notNull(),
    pendingQuestion: text('pending_question'),
    lastSourceMessageId: text('last_source_message_id'),
    lastSystemInstruction: text('last_system_instruction'),
    revision: integer('revision').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
    expiresAtMs: integer('expires_at_ms').notNull(),
    completedAtMs: integer('completed_at_ms'),
    cancelledAtMs: integer('cancelled_at_ms'),
    failedAtMs: integer('failed_at_ms'),
  },
  (table) => [
    uniqueIndex('idx_skill_sessions_one_active_per_scope')
      .on(table.userId, table.scopeType, table.scopeId)
      .where(sql`${table.status} in ('active', 'waiting_user')`),
    index('idx_skill_sessions_user_status_updated').on(table.userId, table.status, table.updatedAtMs, table.id),
    index('idx_skill_sessions_expiration').on(table.status, table.expiresAtMs),
  ],
)

export const skillPermissionGrants = sqliteTable(
  'skill_permission_grants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version').notNull(),
    permissionCode: text('permission_code').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeId: text('scope_id').notNull(),
    status: text('status').notNull(),
    grantedAtMs: integer('granted_at_ms').notNull(),
    revokedAtMs: integer('revoked_at_ms'),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_skill_permission_grants_scope_unique')
      .on(table.userId, table.skillId, table.permissionCode, table.scopeType, table.scopeId),
    index('idx_skill_permission_grants_user_status').on(table.userId, table.status, table.updatedAtMs),
  ],
)

export const skillToolExecutions = sqliteTable(
  'skill_tool_executions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version').notNull(),
    toolId: text('tool_id').notNull(),
    runId: text('run_id'),
    sourceMessageId: text('source_message_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    status: text('status').notNull(),
    inputDigest: text('input_digest').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    errorCode: text('error_code'),
    createdAtMs: integer('created_at_ms').notNull(),
    completedAtMs: integer('completed_at_ms'),
  },
  (table) => [
    uniqueIndex('idx_skill_tool_executions_idempotency_unique').on(table.idempotencyKey),
    index('idx_skill_tool_executions_user_created').on(table.userId, table.createdAtMs, table.id),
  ],
)

export const skillAuditEvents = sqliteTable(
  'skill_audit_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version').notNull(),
    action: text('action').notNull(),
    decision: text('decision').notNull(),
    reason: text('reason').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeId: text('scope_id').notNull(),
    targetId: text('target_id'),
    metadataJson: text('metadata_json'),
    createdAtMs: integer('created_at_ms').notNull(),
  },
  (table) => [
    index('idx_skill_audit_events_user_created').on(table.userId, table.createdAtMs, table.id),
    index('idx_skill_audit_events_skill_created').on(table.skillId, table.createdAtMs),
  ],
)

export const skillBackgroundJobs = sqliteTable(
  'skill_background_jobs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: text('skill_id').notNull(),
    skillVersion: text('skill_version').notNull(),
    agentId: text('agent_id')
      .notNull()
      .references(() => userAgentCompanions.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    permissionGrantId: text('permission_grant_id')
      .references(() => skillPermissionGrants.id, { onDelete: 'set null' }),
    payloadJson: text('payload_json').notNull(),
    status: text('status').notNull(),
    scheduledAtMs: integer('scheduled_at_ms').notNull(),
    nextAttemptAtMs: integer('next_attempt_at_ms').notNull(),
    attempts: integer('attempts').notNull(),
    maxAttempts: integer('max_attempts').notNull(),
    revision: integer('revision').notNull(),
    leaseUntilMs: integer('lease_until_ms'),
    lastError: text('last_error'),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
    completedAtMs: integer('completed_at_ms'),
    cancelledAtMs: integer('cancelled_at_ms'),
  },
  (table) => [
    index('idx_skill_background_jobs_due').on(table.status, table.nextAttemptAtMs, table.scheduledAtMs),
    index('idx_skill_background_jobs_user_created').on(table.userId, table.createdAtMs, table.id),
  ],
)

export const userRoleBindings = sqliteTable(
  'user_role_bindings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    grantedAtMs: integer('granted_at_ms').notNull(),
    revokedAtMs: integer('revoked_at_ms'),
  },
  (table) => [uniqueIndex('idx_user_role_bindings_unique').on(table.userId, table.roleId)],
)

export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    sessionType: text('session_type').notNull(),
    deviceName: text('device_name'),
    userAgent: text('user_agent'),
    ip: text('ip'),
    lastSeenAtMs: integer('last_seen_at_ms'),
    createdAtMs: integer('created_at_ms').notNull(),
    expiresAtMs: integer('expires_at_ms').notNull(),
    revokedAtMs: integer('revoked_at_ms'),
    revokeReason: text('revoke_reason'),
  },
  (table) => [
    index('idx_auth_sessions_user_id').on(table.userId),
    index('idx_auth_sessions_application_id').on(table.applicationId),
  ],
)

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => authSessions.id, { onDelete: 'cascade' }),
    jtiHash: text('jti_hash').notNull(),
    parentTokenId: text('parent_token_id').references((): ReturnType<typeof text> => refreshTokens.id, {
      onDelete: 'set null',
    }),
    issuedAtMs: integer('issued_at_ms').notNull(),
    expiresAtMs: integer('expires_at_ms').notNull(),
    usedAtMs: integer('used_at_ms'),
    revokedAtMs: integer('revoked_at_ms'),
    replacedByTokenId: text('replaced_by_token_id').references((): ReturnType<typeof text> => refreshTokens.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('idx_refresh_tokens_jti_hash_unique').on(table.jtiHash),
    index('idx_refresh_tokens_session_id').on(table.sessionId),
  ],
)

export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    providerLogin: text('provider_login'),
    emailId: text('email_id').references(() => userEmails.id, { onDelete: 'set null' }),
    createdAtMs: integer('created_at_ms').notNull(),
    updatedAtMs: integer('updated_at_ms').notNull(),
  },
  (table) => [
    uniqueIndex('idx_oauth_accounts_provider_user_unique').on(table.provider, table.providerUserId),
    index('idx_oauth_accounts_user_id').on(table.userId),
  ],
)

export const oauthLoginTickets = sqliteTable(
  'oauth_login_tickets',
  {
    id: text('id').primaryKey(),
    ticketHash: text('ticket_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    createdAtMs: integer('created_at_ms').notNull(),
    expiresAtMs: integer('expires_at_ms').notNull(),
    usedAtMs: integer('used_at_ms'),
  },
  (table) => [
    uniqueIndex('idx_oauth_login_tickets_hash_unique').on(table.ticketHash),
    index('idx_oauth_login_tickets_user_id').on(table.userId),
  ],
)

export const schema = {
  users,
  userEmails,
  passwordCredentials,
  applications,
  applicationAuthMethods,
  roles,
  userRoleBindings,
  authSessions,
  refreshTokens,
  oauthAccounts,
  oauthLoginTickets,
  defaultAvatarVersions,
  subscriptionPlans,
  userSubscriptionBindings,
  financialBills,
  userAgentCompanions,
  agentConversations,
  agentConversationMessages,
  agentMemories,
  skillBindings,
  skillRuns,
  skillSessions,
  skillPermissionGrants,
  skillToolExecutions,
  skillAuditEvents,
  skillBackgroundJobs,
}
