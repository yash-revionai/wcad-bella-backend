ALTER TABLE call_sessions
  RENAME COLUMN ultravox_call_id TO retell_call_id;

DROP INDEX IF EXISTS call_sessions_ultravox_call_id_idx;
CREATE INDEX IF NOT EXISTS call_sessions_retell_call_id_idx ON call_sessions(retell_call_id);
