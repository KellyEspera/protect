-- ============================================================
-- PROTECT System — Audit Log Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name  TEXT        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index for fast DESC fetch by time
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs (changed_at DESC);

-- 3. Row Level Security — only authenticated users can read; no direct inserts (trigger only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "audit_logs_select" ON audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Trigger function — runs as DB owner (SECURITY DEFINER) so it bypasses RLS
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Extract the logged-in user's ID from the Supabase JWT claims
  BEGIN
    v_user_id := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  INSERT INTO audit_logs (table_name, action, record_id, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_user_id
  );

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 5. Attach triggers (drop first to avoid duplicates on re-run)
DROP TRIGGER IF EXISTS trg_audit_residents  ON residents;
DROP TRIGGER IF EXISTS trg_audit_households ON households;
DROP TRIGGER IF EXISTS trg_audit_incidents  ON incidents;

CREATE TRIGGER trg_audit_residents
  AFTER INSERT OR UPDATE OR DELETE ON residents
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_households
  AFTER INSERT OR UPDATE OR DELETE ON households
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
