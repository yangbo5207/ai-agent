CREATE TABLE IF NOT EXISTS skill_bindings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  skill_version TEXT,
  enabled INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_bindings_scope_skill_unique
ON skill_bindings(user_id, scope_type, scope_id, skill_id);

CREATE INDEX IF NOT EXISTS idx_skill_bindings_user_scope
ON skill_bindings(user_id, scope_type, scope_id);

CREATE TABLE IF NOT EXISTS skill_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_version TEXT NOT NULL,
  chat_scope TEXT NOT NULL,
  binding_source TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  agent_id TEXT,
  group_chat_id TEXT,
  conversation_id TEXT,
  latency_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skill_runs_user_created
ON skill_runs(user_id, created_at_ms DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_skill_runs_user_skill_created
ON skill_runs(user_id, skill_id, created_at_ms DESC);
