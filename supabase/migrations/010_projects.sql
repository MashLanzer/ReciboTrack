-- Create proper projects table
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid          TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  description  TEXT,
  budget       NUMERIC(12,2),
  currency     TEXT NOT NULL DEFAULT 'USD',
  status       TEXT NOT NULL DEFAULT 'active',  -- active, completed, archived
  color        TEXT NOT NULL DEFAULT '#6366f1',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_uid_idx ON projects(uid);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects(client_id);

-- Add project_id to expenses to link expenses to proper project entities
-- (separate from the legacy `project` text field)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS expenses_project_id_idx ON expenses(project_id);
