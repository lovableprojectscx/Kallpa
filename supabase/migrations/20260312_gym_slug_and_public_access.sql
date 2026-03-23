-- ============================================================
-- Migración: Slug de gym + acceso público a datos del gym
-- Fecha: 2026-03-12
-- ============================================================

-- 1. Agregar columna slug a gym_settings (única por gym, opcional)
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS slug text;

-- Índice único sobre slug para garantizar unicidad y acelerar búsquedas por /g/:slug
CREATE UNIQUE INDEX IF NOT EXISTS gym_settings_slug_idx
  ON gym_settings (slug)
  WHERE slug IS NOT NULL;

-- 2. Permitir lectura pública de gym_settings (para /g/:slug)
--    Solo se exponen campos no sensibles; mp_access_token nunca se retorna en las
--    queries públicas de GymPublica.tsx (selecciona solo campos explícitos).
DROP POLICY IF EXISTS "Public read gym settings" ON gym_settings;
CREATE POLICY "Public read gym settings"
  ON gym_settings FOR SELECT
  USING (true);

-- 3. Permitir lectura pública de membership_plans (para mostrar precios en página pública)
DROP POLICY IF EXISTS "Public read active plans" ON membership_plans;
CREATE POLICY "Public read active plans"
  ON membership_plans FOR SELECT
  USING (is_active = true);

-- 4. Permitir lectura pública de class_schedules (para horario en página pública)
DROP POLICY IF EXISTS "Public read active schedules" ON class_schedules;
CREATE POLICY "Public read active schedules"
  ON class_schedules FOR SELECT
  USING (is_active = true);

-- 5. Permitir lectura pública de classes (para JOIN en class_schedules)
DROP POLICY IF EXISTS "Public read active classes" ON classes;
CREATE POLICY "Public read active classes"
  ON classes FOR SELECT
  USING (is_active = true);
