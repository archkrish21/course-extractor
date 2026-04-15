-- ============================================================================
-- Migration 0009: Enable Row Level Security on all tables
-- ============================================================================
-- Purpose: Defense-in-depth. Application code (Drizzle ORM) runs as the
-- postgres superuser and bypasses RLS entirely. These policies protect
-- against queries via PostgREST, the Supabase dashboard, or if the
-- DATABASE_URL leaks to a non-superuser context.
--
-- Under the current architecture (Option A from AUTH_HARDENING_PLAN.md),
-- Drizzle is the primary access-control layer. RLS is the backstop.
--
-- Rollback: run 0009_disable_rls.sql (sibling file)
-- ============================================================================

-- ─── HELPER: account membership subquery ────────────────────────────────────
-- Used in many policies below. Returns account_ids the current session user
-- is a member of.
-- auth.uid() is a Supabase function that returns the authenticated user's ID.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. USER-DATA TABLES — scoped by auth.uid() or account membership
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── users ──────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── accounts ──────────────────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_member ON accounts
  FOR ALL TO authenticated
  USING (
    id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── account_members ───────────────────────────────────────────────────────
ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_members_access ON account_members
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── account_invite_codes ──────────────────────────────────────────────────
ALTER TABLE account_invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_invite_codes_access ON account_invite_codes
  FOR ALL TO authenticated
  USING (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── student_profiles ──────────────────────────────────────────────────────
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_profiles_self ON student_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── student_parent_links ──────────────────────────────────────────────────
ALTER TABLE student_parent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_parent_links_access ON student_parent_links
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid() OR parent_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid() OR parent_id = auth.uid()
  );

-- ─── counselor_student_links ───────────────────────────────────────────────
ALTER TABLE counselor_student_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY counselor_student_links_access ON counselor_student_links
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid() OR counselor_id = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid() OR counselor_id = auth.uid()
  );

-- ─── four_year_plans ───────────────────────────────────────────────────────
ALTER TABLE four_year_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY four_year_plans_access ON four_year_plans
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    OR id IN (SELECT plan_id FROM plan_shares WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── plan_courses ──────────────────────────────────────────────────────────
ALTER TABLE plan_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_courses_via_plan ON plan_courses
  FOR ALL TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE student_id = auth.uid()
         OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
         OR id IN (SELECT plan_id FROM plan_shares WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE student_id = auth.uid()
         OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  );

-- ─── plan_shares ───────────────────────────────────────────────────────────
ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_shares_access ON plan_shares
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR plan_id IN (
      SELECT id FROM four_year_plans
      WHERE student_id = auth.uid()
         OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE student_id = auth.uid()
         OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  );

-- ─── plan_share_links ──────────────────────────────────────────────────────
ALTER TABLE plan_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_share_links_access ON plan_share_links
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR plan_id IN (
      SELECT id FROM four_year_plans
      WHERE student_id = auth.uid()
         OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    created_by = auth.uid()
  );

-- ─── plan_history ──────────────────────────────────────────────────────────
ALTER TABLE plan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_history_access ON plan_history
  FOR ALL TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM four_year_plans
      WHERE student_id = auth.uid()
         OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    changed_by = auth.uid()
  );

-- ─── grade_entries ─────────────────────────────────────────────────────────
ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY grade_entries_access ON grade_entries
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── gpa_snapshots ─────────────────────────────────────────────────────────
ALTER TABLE gpa_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY gpa_snapshots_access ON gpa_snapshots
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── dual_credit_log ───────────────────────────────────────────────────────
ALTER TABLE dual_credit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY dual_credit_log_access ON dual_credit_log
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── goals ─────────────────────────────────────────────────────────────────
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_access ON goals
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── alerts ────────────────────────────────────────────────────────────────
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY alerts_access ON alerts
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── notifications ─────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_access ON notifications
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── subscriptions ─────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_access ON subscriptions
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- ─── consent_records ───────────────────────────────────────────────────────
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_records_self ON consent_records
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── account_events ────────────────────────────────────────────────────────
ALTER TABLE account_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_events_access ON account_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── parent_invite_codes ───────────────────────────────────────────────────
ALTER TABLE parent_invite_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY parent_invite_codes_access ON parent_invite_codes
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR claimed_by = auth.uid()
  )
  WITH CHECK (
    student_id = auth.uid()
  );

-- ─── requirement_progress ──────────────────────────────────────────────────
ALTER TABLE requirement_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY requirement_progress_access ON requirement_progress
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    student_id = auth.uid()
    OR account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── student_requirement_status ────────────────────────────────────────────
ALTER TABLE student_requirement_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_requirement_status_access ON student_requirement_status
  FOR ALL TO authenticated
  USING (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );

-- ─── student_requirement_opt_ins ───────────────────────────────────────────
ALTER TABLE student_requirement_opt_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_requirement_opt_ins_access ON student_requirement_opt_ins
  FOR ALL TO authenticated
  USING (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REFERENCE-DATA TABLES — read-only for authenticated, no writes via RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_plans_read ON subscription_plans
  FOR SELECT TO authenticated USING (true);

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_documents_read ON legal_documents
  FOR SELECT TO authenticated USING (true);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY courses_read ON courses
  FOR SELECT TO authenticated USING (true);

ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY divisions_read ON divisions
  FOR SELECT TO authenticated USING (true);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY departments_read ON departments
  FOR SELECT TO authenticated USING (true);

ALTER TABLE course_catalog_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_catalog_versions_read ON course_catalog_versions
  FOR SELECT TO authenticated USING (true);

ALTER TABLE course_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY course_prerequisites_read ON course_prerequisites
  FOR SELECT TO authenticated USING (true);

ALTER TABLE graduation_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY graduation_requirements_read ON graduation_requirements
  FOR SELECT TO authenticated USING (true);

ALTER TABLE career_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY career_paths_read ON career_paths
  FOR SELECT TO authenticated USING (true);

ALTER TABLE career_path_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY career_path_courses_read ON career_path_courses
  FOR SELECT TO authenticated USING (true);

ALTER TABLE grade_cohort_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY grade_cohort_stats_read ON grade_cohort_stats
  FOR SELECT TO authenticated USING (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SYSTEM/LOG TABLES — server-writes only, no client access
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- No policy → authenticated role has zero access. Only superuser (Drizzle)
-- and the service_role key can read/write. This is intentional — clients
-- should never see raw Stripe webhook payloads.
