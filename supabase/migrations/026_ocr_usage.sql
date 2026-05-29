-- ════════════════════════════════════════════════════════════════════════
-- OCR usage counter — cuota mensual por usuario
-- ════════════════════════════════════════════════════════════════════════
-- Rastrea cuántos escaneos OCR ha hecho cada usuario en el mes actual.
-- Se usa para enforcer el límite del plan Free (15 scans/mes).
-- Pro y Premium tienen Infinity — el contador se registra igual pero no
-- se bloquea.

CREATE TABLE IF NOT EXISTS ocr_usage (
  uid         TEXT    NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  month       TEXT    NOT NULL,   -- formato 'YYYY-MM'
  scan_count  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, month)
);

CREATE INDEX IF NOT EXISTS idx_ocr_usage_uid ON ocr_usage(uid);

-- Función atómica para incrementar el contador OCR.
-- Hace INSERT ... ON CONFLICT DO UPDATE para evitar race conditions.
CREATE OR REPLACE FUNCTION increment_ocr_usage(p_uid TEXT, p_month TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO ocr_usage (uid, month, scan_count, updated_at)
  VALUES (p_uid, p_month, 1, now())
  ON CONFLICT (uid, month)
  DO UPDATE SET
    scan_count = ocr_usage.scan_count + 1,
    updated_at = now()
  RETURNING scan_count INTO new_count;
  RETURN new_count;
END;
$$;
