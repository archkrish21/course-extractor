-- ============================================================================
-- Migration 0011: Enable RLS on audit_log table
-- ============================================================================
-- The audit_log table was created in migration 0010 (prod hardening) after
-- the RLS migration (0009) had already landed. This closes the gap.
--
-- Pattern: same as stripe_events — RLS enabled with NO policy. Only the
-- postgres superuser (Drizzle) and service_role key can read/write.
-- Authenticated clients via PostgREST/Supabase have zero access.
--
-- Rollback: ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
-- ============================================================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No policy intentionally — zero access for authenticated role.
