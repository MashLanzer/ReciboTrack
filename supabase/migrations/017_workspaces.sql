CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  owner_uid   TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  uid          TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, uid)
);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  created_by   TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  used_at      TIMESTAMPTZ
);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workspaces_owner_uid_idx ON workspaces(owner_uid);
CREATE INDEX IF NOT EXISTS workspace_members_uid_idx ON workspace_members(uid);
CREATE INDEX IF NOT EXISTS workspace_invites_token_idx ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS expenses_workspace_id_idx ON expenses(workspace_id);
