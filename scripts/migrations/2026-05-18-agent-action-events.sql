-- 2026-05-18-agent-action-events.sql
--
-- Adds the agent_action_events table that backs the LifeSort Agents feature's
-- draft → confirm → execute action audit trail. Every action an agent
-- proposes is written as a row with status='pending'. The user reviews and
-- either confirms or rejects. Confirmed actions are executed by
-- /api/agent/execute, which flips status to 'executed' (or 'failed') and
-- records the resulting resource id.
--
-- Idempotent — safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_action_events (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_run_id    UUID,
  tool_name       VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     TEXT,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | confirmed | rejected | executed | failed
  error           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  executed_at     TIMESTAMP WITH TIME ZONE,
  CHECK (status IN ('pending', 'confirmed', 'rejected', 'executed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_agent_action_events_user_created
  ON agent_action_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_action_events_user_status
  ON agent_action_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_action_events_run
  ON agent_action_events(agent_run_id);

COMMIT;
