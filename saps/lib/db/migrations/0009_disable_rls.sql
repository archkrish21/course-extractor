-- ============================================================================
-- Rollback for migration 0009: Disable Row Level Security on all tables
-- ============================================================================
-- Run this if RLS causes issues. DROP POLICY is idempotent with IF EXISTS.
-- ============================================================================

-- User-data tables
DROP POLICY IF EXISTS users_self ON users;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_member ON accounts;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_members_access ON account_members;
ALTER TABLE account_members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_invite_codes_access ON account_invite_codes;
ALTER TABLE account_invite_codes DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_profiles_self ON student_profiles;
ALTER TABLE student_profiles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_parent_links_access ON student_parent_links;
ALTER TABLE student_parent_links DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counselor_student_links_access ON counselor_student_links;
ALTER TABLE counselor_student_links DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS four_year_plans_access ON four_year_plans;
ALTER TABLE four_year_plans DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_courses_via_plan ON plan_courses;
ALTER TABLE plan_courses DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_shares_access ON plan_shares;
ALTER TABLE plan_shares DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_share_links_access ON plan_share_links;
ALTER TABLE plan_share_links DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_history_access ON plan_history;
ALTER TABLE plan_history DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grade_entries_access ON grade_entries;
ALTER TABLE grade_entries DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gpa_snapshots_access ON gpa_snapshots;
ALTER TABLE gpa_snapshots DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dual_credit_log_access ON dual_credit_log;
ALTER TABLE dual_credit_log DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goals_access ON goals;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alerts_access ON alerts;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_access ON notifications;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_access ON subscriptions;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_records_self ON consent_records;
ALTER TABLE consent_records DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_events_access ON account_events;
ALTER TABLE account_events DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parent_invite_codes_access ON parent_invite_codes;
ALTER TABLE parent_invite_codes DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS requirement_progress_access ON requirement_progress;
ALTER TABLE requirement_progress DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_requirement_status_access ON student_requirement_status;
ALTER TABLE student_requirement_status DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_requirement_opt_ins_access ON student_requirement_opt_ins;
ALTER TABLE student_requirement_opt_ins DISABLE ROW LEVEL SECURITY;

-- Reference-data tables
DROP POLICY IF EXISTS subscription_plans_read ON subscription_plans;
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_documents_read ON legal_documents;
ALTER TABLE legal_documents DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courses_read ON courses;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS divisions_read ON divisions;
ALTER TABLE divisions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_read ON departments;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_catalog_versions_read ON course_catalog_versions;
ALTER TABLE course_catalog_versions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_prerequisites_read ON course_prerequisites;
ALTER TABLE course_prerequisites DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS graduation_requirements_read ON graduation_requirements;
ALTER TABLE graduation_requirements DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_paths_read ON career_paths;
ALTER TABLE career_paths DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_path_courses_read ON career_path_courses;
ALTER TABLE career_path_courses DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grade_cohort_stats_read ON grade_cohort_stats;
ALTER TABLE grade_cohort_stats DISABLE ROW LEVEL SECURITY;

-- System/log tables
ALTER TABLE stripe_events DISABLE ROW LEVEL SECURITY;
