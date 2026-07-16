ALTER TABLE skill_runs ADD COLUMN skill_kind TEXT NOT NULL DEFAULT 'prompt';
ALTER TABLE skill_runs ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_skill_runs_session_created
ON skill_runs(session_id, created_at_ms DESC)
WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS skill_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  chat_scope TEXT NOT NULL,
  binding_source TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_step TEXT NOT NULL,
  state_json TEXT NOT NULL,
  pending_question TEXT,
  last_source_message_id TEXT,
  last_system_instruction TEXT,
  revision INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  cancelled_at_ms INTEGER,
  failed_at_ms INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_sessions_one_active_per_scope
ON skill_sessions(user_id, scope_type, scope_id)
WHERE status IN ('active', 'waiting_user');

CREATE INDEX IF NOT EXISTS idx_skill_sessions_user_status_updated
ON skill_sessions(user_id, status, updated_at_ms DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_skill_sessions_expiration
ON skill_sessions(status, expires_at_ms)
WHERE status IN ('active', 'waiting_user');
