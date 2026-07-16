CREATE TABLE IF NOT EXISTS skill_permission_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL,
  granted_at_ms INTEGER NOT NULL,
  revoked_at_ms INTEGER,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_permission_grants_scope_unique
ON skill_permission_grants(user_id, skill_id, permission_code, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_skill_permission_grants_user_status
ON skill_permission_grants(user_id, status, updated_at_ms DESC);

CREATE TABLE IF NOT EXISTS skill_tool_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  run_id TEXT,
  source_message_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  error_code TEXT,
  created_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_tool_executions_idempotency_unique
ON skill_tool_executions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_skill_tool_executions_user_created
ON skill_tool_executions(user_id, created_at_ms DESC, id DESC);

CREATE TABLE IF NOT EXISTS skill_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skill_audit_events_user_created
ON skill_audit_events(user_id, created_at_ms DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_skill_audit_events_skill_created
ON skill_audit_events(skill_id, created_at_ms DESC);

CREATE TABLE IF NOT EXISTS skill_background_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES user_agent_companions(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  permission_grant_id TEXT REFERENCES skill_permission_grants(id) ON DELETE SET NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  scheduled_at_ms INTEGER NOT NULL,
  next_attempt_at_ms INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  lease_until_ms INTEGER,
  last_error TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  cancelled_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skill_background_jobs_due
ON skill_background_jobs(status, next_attempt_at_ms, scheduled_at_ms);

CREATE INDEX IF NOT EXISTS idx_skill_background_jobs_user_created
ON skill_background_jobs(user_id, created_at_ms DESC, id DESC);
