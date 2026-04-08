CREATE TABLE "account_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"triggered_by" text NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"code" varchar(8) NOT NULL,
	"target_role" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "account_invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "account_members" (
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"can_edit" boolean DEFAULT true NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "account_members_account_id_user_id_pk" PRIMARY KEY("account_id","user_id"),
	CONSTRAINT "role_values" CHECK ("account_members"."role" IN ('student', 'parent', 'guardian', 'counselor'))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_name" text NOT NULL,
	"student_date_of_birth" date,
	"grade_level" smallint,
	"graduation_year" smallint,
	"school_id" uuid,
	"student_user_id" uuid,
	"created_by" uuid NOT NULL,
	"billing_contact_id" uuid,
	"claim_code" varchar(8),
	"claim_expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "accounts_student_user_id_unique" UNIQUE("student_user_id"),
	CONSTRAINT "accounts_claim_code_unique" UNIQUE("claim_code"),
	CONSTRAINT "grade_level_range" CHECK ("accounts"."grade_level" BETWEEN 9 AND 12 OR "accounts"."grade_level" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"account_id" uuid,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"action_suggestion" text,
	"related_plan_id" uuid,
	"related_course_id" uuid,
	"deduplication_key" text,
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"triggered_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "career_path_courses" (
	"career_path_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"catalog_version_id" uuid NOT NULL,
	"priority" smallint NOT NULL,
	"notes" text,
	CONSTRAINT "career_path_courses_career_path_id_course_id_pk" PRIMARY KEY("career_path_id","course_id"),
	CONSTRAINT "priority_range" CHECK ("career_path_courses"."priority" IN (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "career_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"related_careers" jsonb DEFAULT '[]'::jsonb,
	"display_order" smallint DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "career_paths_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "counselor_student_links" (
	"counselor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now(),
	"linked_by" uuid,
	CONSTRAINT "counselor_student_links_counselor_id_student_id_pk" PRIMARY KEY("counselor_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "course_catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year" text NOT NULL,
	"source_pdf_url" text,
	"json_artifact_path" text,
	"loaded_at" timestamp with time zone DEFAULT now(),
	"loaded_by" uuid,
	"courses_added" smallint DEFAULT 0,
	"courses_removed" smallint DEFAULT 0,
	"courses_modified" smallint DEFAULT 0,
	"change_summary" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "course_catalog_versions_school_year_unique" UNIQUE("school_year")
);
--> statement-breakpoint
CREATE TABLE "course_prerequisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	"relationship_type" text DEFAULT 'prerequisite' NOT NULL,
	"requirement_group" smallint DEFAULT 1 NOT NULL,
	"minimum_grade" text,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"notes" text,
	"catalog_version_id" uuid NOT NULL,
	CONSTRAINT "no_self_prerequisite" CHECK ("course_prerequisites"."course_id" <> "course_prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"division_id" uuid NOT NULL,
	"department_id" uuid,
	"description" text,
	"credit_value" numeric(3, 1) DEFAULT '1.0' NOT NULL,
	"duration" text NOT NULL,
	"grade_levels" integer[] NOT NULL,
	"credit_type" text NOT NULL,
	"is_ap" boolean DEFAULT false,
	"is_dual_credit" boolean DEFAULT false,
	"is_honors" boolean DEFAULT false,
	"gpa_waiver" boolean DEFAULT false,
	"semesters_offered" integer[],
	"max_enrollment" smallint,
	"is_active" boolean DEFAULT true,
	"catalog_version_id" uuid NOT NULL,
	"previous_code" text,
	"previous_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"division_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_order" smallint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"display_order" smallint DEFAULT 0,
	CONSTRAINT "divisions_name_unique" UNIQUE("name"),
	CONSTRAINT "divisions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "dual_credit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"account_id" uuid,
	"plan_id" uuid,
	"course_id" uuid,
	"partner_college" text NOT NULL,
	"college_course_code" text,
	"college_credits" numeric(3, 1) NOT NULL,
	"academic_year" text NOT NULL,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "four_year_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
	"account_id" uuid,
	"created_by" uuid,
	"visibility" text DEFAULT 'shared',
	"name" text NOT NULL,
	"school_year" text NOT NULL,
	"catalog_version_id" uuid,
	"created_from_template_id" uuid,
	"is_template" boolean DEFAULT false,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "template_or_student" CHECK ("four_year_plans"."is_template" = TRUE OR "four_year_plans"."student_id" IS NOT NULL),
	CONSTRAINT "primary_not_template" CHECK ("four_year_plans"."is_primary" = FALSE OR "four_year_plans"."is_template" = FALSE),
	CONSTRAINT "primary_has_activated_at" CHECK ("four_year_plans"."is_primary" = FALSE OR "four_year_plans"."activated_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"account_id" uuid,
	"goal_type" text NOT NULL,
	"target_gpa" numeric(3, 2),
	"target_text" text,
	"target_date" date,
	"status" text DEFAULT 'active',
	"achieved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gpa_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"account_id" uuid,
	"snapshot_date" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger" text NOT NULL,
	"cumulative_gpa" numeric(4, 3),
	"weighted_gpa" numeric(4, 3),
	"semester_gpa" numeric(4, 3),
	"credits_earned" numeric(5, 1),
	"credits_attempted" numeric(5, 1)
);
--> statement-breakpoint
CREATE TABLE "grade_cohort_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_level" smallint NOT NULL,
	"school_year" text NOT NULL,
	"metric" text NOT NULL,
	"sample_size" integer NOT NULL,
	"p10" numeric(6, 3),
	"p25" numeric(6, 3),
	"p50" numeric(6, 3),
	"p75" numeric(6, 3),
	"p90" numeric(6, 3),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"account_id" uuid,
	"course_id" uuid NOT NULL,
	"academic_year" text NOT NULL,
	"semester" smallint NOT NULL,
	"final_grade" text,
	"credit_earned" numeric(3, 1),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "semester_values" CHECK ("grade_entries"."semester" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "graduation_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"division_id" uuid,
	"requirement_name" text NOT NULL,
	"required_credits" numeric(3, 1) NOT NULL,
	"eligible_credit_types" text[],
	"matching_rule" jsonb,
	"notes" text,
	"catalog_version_id" uuid NOT NULL,
	"requirement_group" text DEFAULT 'graduation' NOT NULL,
	"evaluation_type" text DEFAULT 'course_match' NOT NULL,
	"display_order" smallint DEFAULT 0,
	"is_opt_in" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"account_id" uuid,
	"channel" text,
	"notification_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now(),
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "parent_invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "parent_invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plan_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"grade_level" smallint NOT NULL,
	"semester" smallint,
	"status" text DEFAULT 'planned',
	"planned_grade" text,
	"gpa_waiver_applied" boolean DEFAULT false,
	"display_order" smallint DEFAULT 0,
	"notes" text,
	CONSTRAINT "grade_level_range" CHECK ("plan_courses"."grade_level" BETWEEN 9 AND 12),
	CONSTRAINT "semester_values" CHECK ("plan_courses"."semester" IN (1, 2) OR "plan_courses"."semester" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "plan_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now(),
	"changed_by" uuid,
	"action" text,
	"before_state" jsonb,
	"after_state" jsonb
);
--> statement-breakpoint
CREATE TABLE "plan_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"created_by" uuid,
	"token" text NOT NULL,
	"label" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_accessed" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "plan_share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "requirement_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
	"account_id" uuid,
	"plan_id" uuid,
	"requirement_id" uuid,
	"catalog_version_id" uuid,
	"required_credits" numeric(3, 1),
	"completed_credits" numeric(3, 1),
	"planned_credits" numeric(3, 1),
	"status" text,
	"last_computed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"api_version" text,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "student_parent_links" (
	"student_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"can_edit" boolean DEFAULT false,
	"linked_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "student_parent_links_student_id_parent_id_pk" PRIMARY KEY("student_id","parent_id")
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"graduation_year" smallint NOT NULL,
	"current_grade_level" smallint NOT NULL,
	"gpa_goal" numeric(3, 2),
	"college_targets" jsonb,
	"career_goals" jsonb,
	"sat_score" smallint,
	"act_score" smallint,
	"ap_exam_scores" jsonb,
	"contributes_to_stats" boolean DEFAULT false NOT NULL,
	"rigor_score" numeric(6, 3),
	"year_end_transition_state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_requirement_opt_ins" (
	"account_id" uuid NOT NULL,
	"requirement_group" text NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "student_requirement_opt_ins_account_id_requirement_group_pk" PRIMARY KEY("account_id","requirement_group")
);
--> statement-breakpoint
CREATE TABLE "student_requirement_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"price_monthly" numeric(6, 2),
	"price_annual" numeric(7, 2),
	"max_plans" smallint,
	"features" jsonb NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"subscription_plan_id" uuid NOT NULL,
	"status" text NOT NULL,
	"trial_ends_at" timestamp with time zone NOT NULL,
	"billing_cycle" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"canceled_at" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"is_email_verified" boolean DEFAULT false,
	"date_of_birth" date,
	"account_status" text DEFAULT 'active' NOT NULL,
	"freeze_reason" text,
	"frozen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_login" timestamp with time zone,
	"notification_preferences" jsonb DEFAULT '{"alert_triggered":{"email":true,"in_app":true},"catalog_update":{"email":true,"in_app":true},"grade_reminder":{"email":true,"in_app":false},"prereq_gap":{"email":false,"in_app":true},"gpa_digest":{"email":true,"in_app":false},"plan_milestone":{"email":false,"in_app":true},"course_removed":{"email":true,"in_app":true},"grade_below_target":{"email":true,"in_app":true},"dual_credit_opportunity":{"email":false,"in_app":true},"year_end_reminder":{"email":true,"in_app":true},"trial_expiry_warning":{"email":true,"in_app":true},"account_frozen":{"email":true,"in_app":true},"graduation_detected":{"email":true,"in_app":true}}'::jsonb,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "frozen_consistency" CHECK (("users"."account_status" = 'frozen' AND "users"."freeze_reason" IS NOT NULL AND "users"."frozen_at" IS NOT NULL) OR ("users"."account_status" <> 'frozen' AND "users"."freeze_reason" IS NULL AND "users"."frozen_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "account_events" ADD CONSTRAINT "account_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invite_codes" ADD CONSTRAINT "account_invite_codes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invite_codes" ADD CONSTRAINT "account_invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invite_codes" ADD CONSTRAINT "account_invite_codes_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_billing_contact_id_users_id_fk" FOREIGN KEY ("billing_contact_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_plan_id_four_year_plans_id_fk" FOREIGN KEY ("related_plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_course_id_courses_id_fk" FOREIGN KEY ("related_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_courses" ADD CONSTRAINT "career_path_courses_career_path_id_career_paths_id_fk" FOREIGN KEY ("career_path_id") REFERENCES "public"."career_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_courses" ADD CONSTRAINT "career_path_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_path_courses" ADD CONSTRAINT "career_path_courses_catalog_version_id_course_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."course_catalog_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_student_links" ADD CONSTRAINT "counselor_student_links_counselor_id_users_id_fk" FOREIGN KEY ("counselor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_student_links" ADD CONSTRAINT "counselor_student_links_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counselor_student_links" ADD CONSTRAINT "counselor_student_links_linked_by_users_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_catalog_versions" ADD CONSTRAINT "course_catalog_versions_loaded_by_users_id_fk" FOREIGN KEY ("loaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisite_id_courses_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_catalog_version_id_course_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."course_catalog_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_catalog_version_id_course_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."course_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dual_credit_log" ADD CONSTRAINT "dual_credit_log_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dual_credit_log" ADD CONSTRAINT "dual_credit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dual_credit_log" ADD CONSTRAINT "dual_credit_log_plan_id_four_year_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dual_credit_log" ADD CONSTRAINT "dual_credit_log_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "four_year_plans" ADD CONSTRAINT "four_year_plans_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "four_year_plans" ADD CONSTRAINT "four_year_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "four_year_plans" ADD CONSTRAINT "four_year_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "four_year_plans" ADD CONSTRAINT "four_year_plans_catalog_version_id_course_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."course_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "four_year_plans" ADD CONSTRAINT "four_year_plans_created_from_template_id_four_year_plans_id_fk" FOREIGN KEY ("created_from_template_id") REFERENCES "public"."four_year_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpa_snapshots" ADD CONSTRAINT "gpa_snapshots_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gpa_snapshots" ADD CONSTRAINT "gpa_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_entries" ADD CONSTRAINT "grade_entries_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_entries" ADD CONSTRAINT "grade_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_entries" ADD CONSTRAINT "grade_entries_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graduation_requirements" ADD CONSTRAINT "graduation_requirements_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graduation_requirements" ADD CONSTRAINT "graduation_requirements_catalog_version_id_course_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."course_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_invite_codes" ADD CONSTRAINT "parent_invite_codes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_invite_codes" ADD CONSTRAINT "parent_invite_codes_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_courses" ADD CONSTRAINT "plan_courses_plan_id_four_year_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_courses" ADD CONSTRAINT "plan_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_history" ADD CONSTRAINT "plan_history_plan_id_four_year_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_history" ADD CONSTRAINT "plan_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_share_links" ADD CONSTRAINT "plan_share_links_plan_id_four_year_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_share_links" ADD CONSTRAINT "plan_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_progress" ADD CONSTRAINT "requirement_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_progress" ADD CONSTRAINT "requirement_progress_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_progress" ADD CONSTRAINT "requirement_progress_plan_id_four_year_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_progress" ADD CONSTRAINT "requirement_progress_requirement_id_graduation_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."graduation_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_progress" ADD CONSTRAINT "requirement_progress_catalog_version_id_course_catalog_versions_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."course_catalog_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_parent_links" ADD CONSTRAINT "student_parent_links_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_parent_links" ADD CONSTRAINT "student_parent_links_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_requirement_opt_ins" ADD CONSTRAINT "student_requirement_opt_ins_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_requirement_status" ADD CONSTRAINT "student_requirement_status_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_requirement_status" ADD CONSTRAINT "student_requirement_status_requirement_id_graduation_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."graduation_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_events_user" ON "account_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_account_invite_codes_lookup" ON "account_invite_codes" USING btree ("code") WHERE "account_invite_codes"."claimed_by" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_account_members_user" ON "account_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_student" ON "accounts" USING btree ("student_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_claim_code" ON "accounts" USING btree ("claim_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_alerts_dedup" ON "alerts" USING btree ("student_id","deduplication_key") WHERE "alerts"."resolved_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_alerts_student_unresolved" ON "alerts" USING btree ("student_id") WHERE "alerts"."resolved_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "course_prereqs_unique" ON "course_prerequisites" USING btree ("course_id","prerequisite_id","catalog_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_code_catalog_version_unique" ON "courses" USING btree ("code","catalog_version_id");--> statement-breakpoint
CREATE INDEX "idx_courses_code_active" ON "courses" USING btree ("code") WHERE "courses"."is_active" = TRUE;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_division_name_unique" ON "departments" USING btree ("division_id","name");--> statement-breakpoint
CREATE INDEX "idx_dual_credit_student" ON "dual_credit_log" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_one_primary_plan_per_student" ON "four_year_plans" USING btree ("student_id") WHERE "four_year_plans"."is_primary" = TRUE AND "four_year_plans"."is_template" = FALSE AND "four_year_plans"."student_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_goals_student_active" ON "goals" USING btree ("student_id") WHERE "goals"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_gpa_snapshots_student_date" ON "gpa_snapshots" USING btree ("student_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_cohort_stats_unique" ON "grade_cohort_stats" USING btree ("grade_level","school_year","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_entries_unique" ON "grade_entries" USING btree ("student_id","course_id","academic_year","semester");--> statement-breakpoint
CREATE INDEX "idx_grade_entries_student_id" ON "grade_entries" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grad_req_version_name_unique" ON "graduation_requirements" USING btree ("catalog_version_id","requirement_name");--> statement-breakpoint
CREATE INDEX "idx_grad_req_group" ON "graduation_requirements" USING btree ("requirement_group");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_date" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_invite_codes_lookup" ON "parent_invite_codes" USING btree ("code") WHERE "parent_invite_codes"."claimed_by" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_courses_unique" ON "plan_courses" USING btree ("plan_id","course_id","grade_level","semester");--> statement-breakpoint
CREATE INDEX "idx_plan_courses_plan_id" ON "plan_courses" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_plan_history_plan_id_at" ON "plan_history" USING btree ("plan_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_progress_unique" ON "requirement_progress" USING btree ("plan_id","requirement_id");--> statement-breakpoint
CREATE INDEX "idx_requirement_progress_student" ON "requirement_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_events_unprocessed" ON "stripe_events" USING btree ("received_at") WHERE "stripe_events"."processed" = FALSE;--> statement-breakpoint
CREATE UNIQUE INDEX "student_req_status_unique" ON "student_requirement_status" USING btree ("account_id","requirement_id");