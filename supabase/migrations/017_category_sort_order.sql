ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE categories SET sort_order = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY uid ORDER BY created_at) AS rn FROM categories) sub
WHERE categories.id = sub.id;
