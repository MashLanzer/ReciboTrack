-- ─── Fix entity_edges: from_id y to_id deben ser TEXT (no UUID FK)
-- porque from_id puede ser "expense:{uuid}" (no es un entity UUID)
DROP TABLE IF EXISTS entity_edges;

CREATE TABLE entity_edges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  from_id    TEXT NOT NULL,          -- "expense:{uuid}" o entity UUID
  to_id      TEXT NOT NULL,          -- entity UUID
  type       TEXT,
  expense_id TEXT,                   -- UUID del gasto asociado (para filtros)
  weight     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_edges_uid ON entity_edges(uid);
CREATE INDEX idx_entity_edges_expense ON entity_edges(uid, expense_id);
CREATE INDEX idx_entity_edges_to ON entity_edges(uid, to_id);

-- ─── Fix highlights: recrear con metadata JSONB para almacenar todos los campos
DROP TABLE IF EXISTS highlights;

CREATE TABLE highlights (
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  key        TEXT NOT NULL,          -- equivalente al doc ID en Firestore (= type)
  type       TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',  -- { title, value, description, icon, pinned }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, key)
);
