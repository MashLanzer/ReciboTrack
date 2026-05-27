-- ════════════════════════════════════════════════════════════════════════
-- Three-tier plans — Free, Pro, Premium
-- ════════════════════════════════════════════════════════════════════════
-- Antes: solo había 'free' y 'pro'. Ahora separamos en 3 tiers:
--   - free:    100 gastos/mes, sin export, sin workspaces
--   - pro:     ilimitado, exports, 3 workspaces       ($1.99/mes)
--   - premium: todo pro + bank sync + IA + webhooks   ($4.99/mes)
--
-- Usuarios que pagaron $4.99 antes (= columna plan='pro') se migran a
-- 'premium' para que mantengan el feature set por el que pagaron.

-- 1. Quitar la constraint vieja
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- 2. Añadir constraint nueva con 3 valores
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'pro', 'premium'));

-- 3. Migrar usuarios 'pro' actuales a 'premium' (estaban pagando $4.99)
UPDATE profiles SET plan = 'premium' WHERE plan = 'pro';
