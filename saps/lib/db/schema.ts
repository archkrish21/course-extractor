import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  jsonb,
  smallint,
  integer,
  decimal,
  smallserial,
  uniqueIndex,
  index,
  primaryKey,
  check,
  varchar,
} from "drizzle-orm/pg-core";

// ─── ENUMS (as check constraints) ───────────────────────────────────────────

// ─── USERS ──────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: text("role", {
      enum: ["student", "parent", "counselor", "admin"],
    }).notNull(),
    isEmailVerified: boolean("is_email_verified").default(false),
    dateOfBirth: date("date_of_birth"),
    accountStatus: text("account_status", {
      enum: ["active", "frozen", "deactivated", "suspended"],
    })
      .notNull()
      .default("active"),
    freezeReason: text("freeze_reason", {
      enum: [
        "payment_lapsed",
        "subscription_canceled",
        "graduation_complete",
        "admin_action",
      ],
    }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
    ppAcceptedAt: timestamp("pp_accepted_at", { withTimezone: true }),
    notificationPreferences: jsonb("notification_preferences").default({
      alert_triggered: { email: true, in_app: true },
      catalog_update: { email: true, in_app: true },
      grade_reminder: { email: true, in_app: false },
      prereq_gap: { email: false, in_app: true },
      gpa_digest: { email: true, in_app: false },
      plan_milestone: { email: false, in_app: true },
      course_removed: { email: true, in_app: true },
      grade_below_target: { email: true, in_app: true },
      dual_credit_opportunity: { email: false, in_app: true },
      year_end_reminder: { email: true, in_app: true },
      trial_expiry_warning: { email: true, in_app: true },
      account_frozen: { email: true, in_app: true },
      graduation_detected: { email: true, in_app: true },
    }),
  },
  (table) => [
    check(
      "frozen_consistency",
      sql`(${table.accountStatus} = 'frozen' AND ${table.freezeReason} IS NOT NULL AND ${table.frozenAt} IS NOT NULL) OR (${table.accountStatus} <> 'frozen' AND ${table.freezeReason} IS NULL AND ${table.frozenAt} IS NULL)`
    ),
  ]
);

// ─── LEGAL DOCUMENTS & CONSENT ──────────────────────────────────────────────

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", {
      enum: ["terms_of_service", "privacy_policy"],
    }).notNull(),
    version: text("version").notNull(),
    effectiveDate: date("effective_date").notNull(),
    contentHash: text("content_hash").notNull(),
    summaryOfChanges: text("summary_of_changes"),
    isCurrent: boolean("is_current").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_documents_type_version_unique").on(table.type, table.version),
  ]
);

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    legalDocumentId: uuid("legal_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "restrict" }),
    action: text("action", {
      enum: ["accepted", "withdrawn"],
    }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    consentedAt: timestamp("consented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_consent_records_user").on(table.userId),
    index("idx_consent_records_user_date").on(table.userId, table.consentedAt),
  ]
);

// ─── ACCOUNTS (student-centric) ─────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentName: text("student_name").notNull(),
  studentDateOfBirth: date("student_date_of_birth"),
  gradeLevel: smallint("grade_level"),
  graduationYear: smallint("graduation_year"),
  schoolId: uuid("school_id"),
  studentUserId: uuid("student_user_id").unique().references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  billingContactId: uuid("billing_contact_id").references(() => users.id, { onDelete: "set null" }),
  claimCode: varchar("claim_code", { length: 8 }).unique(),
  claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_accounts_student").on(table.studentUserId),
  uniqueIndex("idx_accounts_claim_code").on(table.claimCode),
  check(
    "grade_level_range",
    sql`${table.gradeLevel} BETWEEN 9 AND 12 OR ${table.gradeLevel} IS NULL`
  ),
]);

// ─── ACCOUNT MEMBERS ────────────────────────────────────────────────────────

export const accountMembers = pgTable("account_members", {
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'student' | 'parent' | 'guardian' | 'counselor'
  canEdit: boolean("can_edit").notNull().default(true),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.userId] }),
  index("idx_account_members_user").on(table.userId),
  check(
    "role_values",
    sql`${table.role} IN ('student', 'parent', 'guardian', 'counselor')`
  ),
]);

// ─── STUDENT PROFILES ───────────────────────────────────────────────────────

export const studentProfiles = pgTable("student_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  graduationYear: smallint("graduation_year").notNull(),
  currentGradeLevel: smallint("current_grade_level").notNull(),
  gpaGoal: decimal("gpa_goal", { precision: 3, scale: 2 }),
  collegeTargets: jsonb("college_targets"),
  careerGoals: jsonb("career_goals"),
  satScore: smallint("sat_score"),
  actScore: smallint("act_score"),
  apExamScores: jsonb("ap_exam_scores"),
  contributesToStats: boolean("contributes_to_stats").notNull().default(false),
  rigorScore: decimal("rigor_score", { precision: 6, scale: 3 }),
  yearEndTransitionState: text("year_end_transition_state", {
    enum: ["pending", "in_progress", "completed"],
  })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── STUDENT-PARENT LINKS ───────────────────────────────────────────────────

export const studentParentLinks = pgTable(
  "student_parent_links",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canEdit: boolean("can_edit").default(false),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.parentId] })]
);

// ─── COUNSELOR-STUDENT LINKS ────────────────────────────────────────────────

export const counselorStudentLinks = pgTable(
  "counselor_student_links",
  {
    counselorId: uuid("counselor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow(),
    linkedBy: uuid("linked_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [primaryKey({ columns: [table.counselorId, table.studentId] })]
);

// ─── SUBSCRIPTION PLANS ─────────────────────────────────────────────────────

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  priceMonthly: decimal("price_monthly", { precision: 6, scale: 2 }),
  priceAnnual: decimal("price_annual", { precision: 7, scale: 2 }),
  priceFourYear: decimal("price_four_year", { precision: 7, scale: 2 }),
  maxPlans: smallint("max_plans"),
  features: jsonb("features").notNull(),
});

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  subscriptionPlanId: uuid("subscription_plan_id")
    .notNull()
    .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
  status: text("status", {
    enum: ["trialing", "active", "past_due", "canceled", "paused"],
  }).notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }).notNull(),
  billingCycle: text("billing_cycle", { enum: ["monthly", "annual", "four_year"] }),
  currentPeriodStart: timestamp("current_period_start", {
    withTimezone: true,
  }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ─── STRIPE EVENTS ──────────────────────────────────────────────────────────

export const stripeEvents = pgTable(
  "stripe_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stripeEventId: text("stripe_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    apiVersion: text("api_version"),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_stripe_events_unprocessed")
      .on(table.receivedAt)
      .where(sql`${table.processed} = FALSE`),
  ]
);

// ─── ACCOUNT EVENTS ─────────────────────────────────────────────────────────

export const accountEvents = pgTable(
  "account_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: [
        "account_frozen",
        "account_reactivated",
        "account_deactivated",
        "account_suspended",
        "suspension_lifted",
        "graduation_detected",
        "trial_expired",
        "data_exported",
      ],
    }).notNull(),
    triggeredBy: text("triggered_by", {
      enum: ["system", "stripe_webhook", "admin", "user"],
    }).notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_account_events_user").on(table.userId, table.occurredAt),
  ]
);

// ─── DIVISIONS ──────────────────────────────────────────────────────────────

export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  displayOrder: smallint("display_order").default(0),
});

// ─── DEPARTMENTS ────────────────────────────────────────────────────────────

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    displayOrder: smallint("display_order").default(0),
  },
  (table) => [
    uniqueIndex("departments_division_name_unique").on(
      table.divisionId,
      table.name
    ),
  ]
);

// ─── COURSE CATALOG VERSIONS ────────────────────────────────────────────────

export const courseCatalogVersions = pgTable("course_catalog_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolYear: text("school_year").notNull().unique(),
  sourcePdfUrl: text("source_pdf_url"),
  jsonArtifactPath: text("json_artifact_path"),
  loadedAt: timestamp("loaded_at", { withTimezone: true }).defaultNow(),
  loadedBy: uuid("loaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  coursesAdded: smallint("courses_added").default(0),
  coursesRemoved: smallint("courses_removed").default(0),
  coursesModified: smallint("courses_modified").default(0),
  changeSummary: jsonb("change_summary").default([]),
});

// ─── COURSES ────────────────────────────────────────────────────────────────

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "restrict",
    }),
    description: text("description"),
    creditValue: decimal("credit_value", { precision: 3, scale: 1 })
      .notNull()
      .default("1.0"),
    duration: text("duration", { enum: ["semester", "full_year"] }).notNull(),
    gradeLevels: integer("grade_levels").array().notNull(),
    creditType: text("credit_type", {
      enum: ["CP", "Accelerated", "Honors", "AP", "Pass/Fail"],
    }).notNull(),
    isAp: boolean("is_ap").default(false),
    isDualCredit: boolean("is_dual_credit").default(false),
    isHonors: boolean("is_honors").default(false),
    gpaWaiver: boolean("gpa_waiver").default(false),
    semestersOffered: integer("semesters_offered").array(),
    maxEnrollment: smallint("max_enrollment"),
    isActive: boolean("is_active").default(true),
    catalogVersionId: uuid("catalog_version_id")
      .notNull()
      .references(() => courseCatalogVersions.id, { onDelete: "restrict" }),
    previousCode: text("previous_code"),
    previousName: text("previous_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("courses_code_catalog_version_unique").on(
      table.code,
      table.catalogVersionId
    ),
    index("idx_courses_code_active")
      .on(table.code)
      .where(sql`${table.isActive} = TRUE`),
  ]
);

// ─── COURSE PREREQUISITES ───────────────────────────────────────────────────

export const coursePrerequisites = pgTable(
  "course_prerequisites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    prerequisiteId: uuid("prerequisite_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    relationshipType: text("relationship_type", {
      enum: ["prerequisite", "corequisite"],
    })
      .notNull()
      .default("prerequisite"),
    requirementGroup: smallint("requirement_group").notNull().default(1),
    minimumGrade: text("minimum_grade", { enum: ["A", "B", "C", "D"] }),
    isRecommended: boolean("is_recommended").notNull().default(false),
    notes: text("notes"),
    catalogVersionId: uuid("catalog_version_id")
      .notNull()
      .references(() => courseCatalogVersions.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("course_prereqs_unique").on(
      table.courseId,
      table.prerequisiteId,
      table.catalogVersionId
    ),
    check(
      "no_self_prerequisite",
      sql`${table.courseId} <> ${table.prerequisiteId}`
    ),
  ]
);

// ─── GRADUATION REQUIREMENTS ────────────────────────────────────────────────

export const graduationRequirements = pgTable(
  "graduation_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    divisionId: uuid("division_id")
      .references(() => divisions.id, { onDelete: "restrict" }),
    requirementName: text("requirement_name").notNull(),
    requiredCredits: decimal("required_credits", {
      precision: 3,
      scale: 1,
    }).notNull(),
    eligibleCreditTypes: text("eligible_credit_types").array(),
    matchingRule: jsonb("matching_rule"),
    notes: text("notes"),
    catalogVersionId: uuid("catalog_version_id")
      .notNull()
      .references(() => courseCatalogVersions.id, { onDelete: "restrict" }),
    requirementGroup: text("requirement_group").notNull().default("graduation"),
    evaluationType: text("evaluation_type").notNull().default("course_match"),
    displayOrder: smallint("display_order").default(0),
    isOptIn: boolean("is_opt_in").notNull().default(false),
  },
  (table) => [
    uniqueIndex("grad_req_version_name_unique").on(
      table.catalogVersionId,
      table.requirementName
    ),
    index("idx_grad_req_group").on(table.requirementGroup),
  ]
);

// ─── STUDENT REQUIREMENT STATUS (non-course requirement tracking) ───────────

export const studentRequirementStatus = pgTable(
  "student_requirement_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => graduationRequirements.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["not_started", "in_progress", "completed", "waived"],
    }).notNull().default("not_started"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("student_req_status_unique").on(
      table.accountId,
      table.requirementId
    ),
  ]
);

// ─── STUDENT REQUIREMENT OPT-INS ───────────────────────────────────────────

export const studentRequirementOptIns = pgTable(
  "student_requirement_opt_ins",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    requirementGroup: text("requirement_group").notNull(),
    enabledAt: timestamp("enabled_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.requirementGroup] }),
  ]
);

// ─── CAREER PATHS ───────────────────────────────────────────────────────────

export const careerPaths = pgTable("career_paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  relatedCareers: jsonb("related_careers").default([]),
  displayOrder: smallint("display_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── CAREER PATH COURSES ────────────────────────────────────────────────────

export const careerPathCourses = pgTable(
  "career_path_courses",
  {
    careerPathId: uuid("career_path_id")
      .notNull()
      .references(() => careerPaths.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    catalogVersionId: uuid("catalog_version_id")
      .notNull()
      .references(() => courseCatalogVersions.id),
    priority: smallint("priority").notNull(),
    notes: text("notes"),
  },
  (table) => [
    primaryKey({ columns: [table.careerPathId, table.courseId] }),
    check(
      "priority_range",
      sql`${table.priority} IN (1, 2, 3)`
    ),
  ]
);

// ─── FOUR YEAR PLANS ────────────────────────────────────────────────────────

export const fourYearPlans = pgTable(
  "four_year_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    visibility: text("visibility", { enum: ["shared", "private"] }).default("shared"),
    name: text("name").notNull(),
    schoolYear: text("school_year").notNull(),
    catalogVersionId: uuid("catalog_version_id").references(
      () => courseCatalogVersions.id,
      { onDelete: "restrict" }
    ),
    createdFromTemplateId: uuid("created_from_template_id").references(
      (): any => fourYearPlans.id,
      { onDelete: "set null" }
    ),
    isTemplate: boolean("is_template").default(false),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("draft"),
    isPrimary: boolean("is_primary").notNull().default(false),
    lockedGradeLevels: jsonb("locked_grade_levels").$type<number[]>().default([]),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("idx_one_primary_plan_per_student")
      .on(table.studentId)
      .where(
        sql`${table.isPrimary} = TRUE AND ${table.isTemplate} = FALSE AND ${table.studentId} IS NOT NULL`
      ),
    check(
      "template_or_student",
      sql`${table.isTemplate} = TRUE OR ${table.studentId} IS NOT NULL`
    ),
    check(
      "primary_not_template",
      sql`${table.isPrimary} = FALSE OR ${table.isTemplate} = FALSE`
    ),
    check(
      "primary_has_activated_at",
      sql`${table.isPrimary} = FALSE OR ${table.activatedAt} IS NOT NULL`
    ),
  ]
);

// ─── PLAN COURSES ───────────────────────────────────────────────────────────

export const planCourses = pgTable(
  "plan_courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => fourYearPlans.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    gradeLevel: smallint("grade_level").notNull(),
    semester: smallint("semester"),
    status: text("status", {
      enum: ["planned", "enrolled", "completed", "dropped"],
    }).default("planned"),
    plannedGrade: text("planned_grade", {
      enum: ["A", "B", "C", "D", "F", "P", "I"],
    }),
    gpaWaiverApplied: boolean("gpa_waiver_applied").default(false),
    displayOrder: smallint("display_order").default(0),
    notes: text("notes"),
  },
  (table) => [
    uniqueIndex("plan_courses_unique").on(
      table.planId,
      table.courseId,
      table.gradeLevel,
      table.semester
    ),
    index("idx_plan_courses_plan_id").on(table.planId),
    check(
      "grade_level_range",
      sql`${table.gradeLevel} BETWEEN 9 AND 12`
    ),
    check(
      "semester_values",
      sql`${table.semester} IN (1, 2) OR ${table.semester} IS NULL`
    ),
  ]
);

// ─── PLAN SHARE LINKS ───────────────────────────────────────────────────────

export const planShareLinks = pgTable("plan_share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => fourYearPlans.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  token: text("token").notNull().unique(),
  label: text("label"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastAccessed: timestamp("last_accessed", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─── PLAN SHARES (per-user permissions) ────────────────────────────────────

export const planShares = pgTable(
  "plan_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => fourYearPlans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    permission: text("permission", {
      enum: ["owner", "view", "edit", "delete"],
    }).notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("plan_shares_plan_user_unique").on(table.planId, table.userId),
    index("idx_plan_shares_user").on(table.userId),
  ]
);

// ─── PLAN HISTORY ───────────────────────────────────────────────────────────

export const planHistory = pgTable(
  "plan_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => fourYearPlans.id, { onDelete: "cascade" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action", {
      enum: [
        "add_course",
        "remove_course",
        "change_planned_grade",
        "change_semester",
        "change_status",
        "rename_plan",
        "reorder_courses",
        "set_primary",
      ],
    }),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
  },
  (table) => [
    index("idx_plan_history_plan_id_at").on(table.planId, table.changedAt),
  ]
);

// ─── GRADE ENTRIES ──────────────────────────────────────────────────────────

export const gradeEntries = pgTable(
  "grade_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    academicYear: text("academic_year").notNull(),
    semester: smallint("semester").notNull(),
    finalGrade: text("final_grade", {
      enum: ["A", "B", "C", "D", "F", "P", "I"],
    }),
    creditEarned: decimal("credit_earned", { precision: 3, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("grade_entries_unique").on(
      table.studentId,
      table.courseId,
      table.academicYear,
      table.semester
    ),
    index("idx_grade_entries_student_id").on(table.studentId),
    check(
      "semester_values",
      sql`${table.semester} IN (1, 2)`
    ),
  ]
);

// ─── GPA SNAPSHOTS ──────────────────────────────────────────────────────────

export const gpaSnapshots = pgTable(
  "gpa_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    snapshotDate: timestamp("snapshot_date", { withTimezone: true })
      .notNull()
      .defaultNow(),
    trigger: text("trigger", {
      enum: ["semester_end", "manual", "plan_save"],
    }).notNull(),
    cumulativeGpa: decimal("cumulative_gpa", { precision: 4, scale: 3 }),
    weightedGpa: decimal("weighted_gpa", { precision: 4, scale: 3 }),
    semesterGpa: decimal("semester_gpa", { precision: 4, scale: 3 }),
    creditsEarned: decimal("credits_earned", { precision: 5, scale: 1 }),
    creditsAttempted: decimal("credits_attempted", { precision: 5, scale: 1 }),
  },
  (table) => [
    index("idx_gpa_snapshots_student_date").on(
      table.studentId,
      table.snapshotDate
    ),
  ]
);

// ─── DUAL CREDIT LOG ────────────────────────────────────────────────────────

export const dualCreditLog = pgTable(
  "dual_credit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    planId: uuid("plan_id").references(() => fourYearPlans.id, {
      onDelete: "set null",
    }),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),
    partnerCollege: text("partner_college").notNull(),
    collegeCourseCode: text("college_course_code"),
    collegeCredits: decimal("college_credits", {
      precision: 3,
      scale: 1,
    }).notNull(),
    academicYear: text("academic_year").notNull(),
    status: text("status", {
      enum: ["planned", "enrolled", "completed", "transferred", "dropped"],
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_dual_credit_student").on(table.studentId),
  ]
);

// ─── GOALS ──────────────────────────────────────────────────────────────────

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    goalType: text("goal_type", {
      enum: ["gpa", "college", "career", "graduation", "dual_credit"],
    }).notNull(),
    targetGpa: decimal("target_gpa", { precision: 3, scale: 2 }),
    targetText: text("target_text"),
    targetDate: date("target_date"),
    status: text("status", {
      enum: ["active", "achieved", "abandoned"],
    }).default("active"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_goals_student_active")
      .on(table.studentId)
      .where(sql`${table.status} = 'active'`),
  ]
);

// ─── ALERTS ─────────────────────────────────────────────────────────────────

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    alertType: text("alert_type", {
      enum: [
        "overload",
        "underload",
        "prereq_violation",
        "coreq_violation",
        "enrollment_rule",
        "grade_level_ineligible",
        "repeat_course",
        "graduation_risk",
        "catalog_change",
        "grade_below_target",
        "gpa_goal_at_risk",
        "declining_gpa_trend",
        "ap_capacity_underuse",
        "dual_credit_opportunity",
        "incomplete_grade",
      ],
    }).notNull(),
    severity: text("severity", {
      enum: ["info", "warning", "critical"],
    }).notNull(),
    message: text("message").notNull(),
    actionSuggestion: text("action_suggestion"),
    relatedPlanId: uuid("related_plan_id").references(() => fourYearPlans.id, {
      onDelete: "set null",
    }),
    relatedCourseId: uuid("related_course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    deduplicationKey: text("deduplication_key"),
    isRead: boolean("is_read").default(false),
    // TODO: Phase 2 — replace is_dismissed with dismissed_by UUID when multi-member alert dismissal is implemented
    isDismissed: boolean("is_dismissed").default(false),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_alerts_dedup")
      .on(table.studentId, table.deduplicationKey)
      .where(sql`${table.resolvedAt} IS NULL`),
    index("idx_alerts_student_unresolved")
      .on(table.studentId)
      .where(sql`${table.resolvedAt} IS NULL`),
  ]
);

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    channel: text("channel", { enum: ["in_app", "email"] }),
    notificationType: text("notification_type", {
      enum: [
        "alert_triggered",
        "catalog_update",
        "grade_reminder",
        "prereq_gap",
        "gpa_digest",
        "plan_milestone",
        "course_removed",
        "grade_below_target",
        "dual_credit_opportunity",
        "year_end_reminder",
        "trial_expiry_warning",
        "account_frozen",
        "graduation_detected",
      ],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),
    metadata: jsonb("metadata").default({}),
    status: text("status", {
      enum: ["pending", "sent", "failed"],
    }).default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_notifications_user_unread")
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
    index("idx_notifications_user_date").on(table.userId, table.createdAt),
  ]
);

// ─── REQUIREMENT PROGRESS ───────────────────────────────────────────────────

export const requirementProgress = pgTable(
  "requirement_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    planId: uuid("plan_id").references(() => fourYearPlans.id, {
      onDelete: "cascade",
    }),
    requirementId: uuid("requirement_id").references(
      () => graduationRequirements.id,
      { onDelete: "cascade" }
    ),
    catalogVersionId: uuid("catalog_version_id").references(
      () => courseCatalogVersions.id,
      { onDelete: "restrict" }
    ),
    requiredCredits: decimal("required_credits", { precision: 3, scale: 1 }),
    completedCredits: decimal("completed_credits", { precision: 3, scale: 1 }),
    plannedCredits: decimal("planned_credits", { precision: 3, scale: 1 }),
    status: text("status", { enum: ["met", "in_progress", "gap"] }),
    lastComputedAt: timestamp("last_computed_at", {
      withTimezone: true,
    }).defaultNow(),
  },
  (table) => [
    uniqueIndex("requirement_progress_unique").on(
      table.planId,
      table.requirementId
    ),
    index("idx_requirement_progress_student").on(table.studentId),
  ]
);

// ─── GRADE COHORT STATS ─────────────────────────────────────────────────────

export const gradeCohortStats = pgTable(
  "grade_cohort_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gradeLevel: smallint("grade_level").notNull(),
    schoolYear: text("school_year").notNull(),
    metric: text("metric", {
      enum: [
        "unweighted_gpa",
        "weighted_gpa",
        "ap_count",
        "credit_count",
        "rigor_score",
      ],
    }).notNull(),
    sampleSize: integer("sample_size").notNull(),
    p10: decimal("p10", { precision: 6, scale: 3 }),
    p25: decimal("p25", { precision: 6, scale: 3 }),
    p50: decimal("p50", { precision: 6, scale: 3 }),
    p75: decimal("p75", { precision: 6, scale: 3 }),
    p90: decimal("p90", { precision: 6, scale: 3 }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("grade_cohort_stats_unique").on(
      table.gradeLevel,
      table.schoolYear,
      table.metric
    ),
  ]
);

// ─── PARENT INVITE CODES ────────────────────────────────────────────────────

export const parentInviteCodes = pgTable(
  "parent_invite_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 6 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedBy: uuid("claimed_by").references(() => users.id),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_invite_codes_lookup")
      .on(table.code)
      .where(sql`${table.claimedBy} IS NULL`),
  ]
);

// ─── ACCOUNT INVITE CODES ──────────────────────────────────────────────────

export const accountInviteCodes = pgTable(
  "account_invite_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 8 }).notNull().unique(),
    targetRole: text("target_role", {
      enum: ["student", "parent", "guardian"],
    }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    claimedBy: uuid("claimed_by").references(() => users.id),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_account_invite_codes_lookup")
      .on(table.code)
      .where(sql`${table.claimedBy} IS NULL`),
  ]
);

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  subscriptions: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  accountAsStudent: one(accounts, {
    fields: [users.id],
    references: [accounts.studentUserId],
    relationName: "accountStudent",
  }),
  accountMemberships: many(accountMembers),
  studentParentLinksAsStudent: many(studentParentLinks, {
    relationName: "studentParentStudent",
  }),
  studentParentLinksAsParent: many(studentParentLinks, {
    relationName: "studentParentParent",
  }),
  counselorStudentLinksAsCounselor: many(counselorStudentLinks, {
    relationName: "counselorLink",
  }),
  counselorStudentLinksAsStudent: many(counselorStudentLinks, {
    relationName: "studentLink",
  }),
  fourYearPlans: many(fourYearPlans),
  gradeEntries: many(gradeEntries),
  gpaSnapshots: many(gpaSnapshots),
  goals: many(goals),
  alerts: many(alerts),
  notifications: many(notifications),
  accountEvents: many(accountEvents),
  dualCreditLog: many(dualCreditLog),
  parentInviteCodes: many(parentInviteCodes),
}));

export const studentProfilesRelations = relations(
  studentProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [studentProfiles.userId],
      references: [users.id],
    }),
  })
);

export const studentParentLinksRelations = relations(
  studentParentLinks,
  ({ one }) => ({
    student: one(users, {
      fields: [studentParentLinks.studentId],
      references: [users.id],
      relationName: "studentParentStudent",
    }),
    parent: one(users, {
      fields: [studentParentLinks.parentId],
      references: [users.id],
      relationName: "studentParentParent",
    }),
  })
);

export const counselorStudentLinksRelations = relations(
  counselorStudentLinks,
  ({ one }) => ({
    counselor: one(users, {
      fields: [counselorStudentLinks.counselorId],
      references: [users.id],
      relationName: "counselorLink",
    }),
    student: one(users, {
      fields: [counselorStudentLinks.studentId],
      references: [users.id],
      relationName: "studentLink",
    }),
    linkedByUser: one(users, {
      fields: [counselorStudentLinks.linkedBy],
      references: [users.id],
    }),
  })
);

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  ({ many }) => ({
    subscriptions: many(subscriptions),
  })
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [subscriptions.accountId],
    references: [accounts.id],
  }),
  subscriptionPlan: one(subscriptionPlans, {
    fields: [subscriptions.subscriptionPlanId],
    references: [subscriptionPlans.id],
  }),
}));

export const accountEventsRelations = relations(accountEvents, ({ one }) => ({
  user: one(users, {
    fields: [accountEvents.userId],
    references: [users.id],
  }),
}));

export const divisionsRelations = relations(divisions, ({ many }) => ({
  departments: many(departments),
  courses: many(courses),
  graduationRequirements: many(graduationRequirements),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  division: one(divisions, {
    fields: [departments.divisionId],
    references: [divisions.id],
  }),
  courses: many(courses),
}));

export const courseCatalogVersionsRelations = relations(
  courseCatalogVersions,
  ({ one, many }) => ({
    loadedByUser: one(users, {
      fields: [courseCatalogVersions.loadedBy],
      references: [users.id],
    }),
    courses: many(courses),
    coursePrerequisites: many(coursePrerequisites),
    graduationRequirements: many(graduationRequirements),
  })
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  division: one(divisions, {
    fields: [courses.divisionId],
    references: [divisions.id],
  }),
  department: one(departments, {
    fields: [courses.departmentId],
    references: [departments.id],
  }),
  catalogVersion: one(courseCatalogVersions, {
    fields: [courses.catalogVersionId],
    references: [courseCatalogVersions.id],
  }),
  prerequisitesAsCourse: many(coursePrerequisites, {
    relationName: "coursePrereqs",
  }),
  prerequisitesAsPrereq: many(coursePrerequisites, {
    relationName: "prereqCourse",
  }),
  planCourses: many(planCourses),
  gradeEntries: many(gradeEntries),
  careerPathCourses: many(careerPathCourses),
  alerts: many(alerts),
}));

export const coursePrerequisitesRelations = relations(
  coursePrerequisites,
  ({ one }) => ({
    course: one(courses, {
      fields: [coursePrerequisites.courseId],
      references: [courses.id],
      relationName: "coursePrereqs",
    }),
    prerequisite: one(courses, {
      fields: [coursePrerequisites.prerequisiteId],
      references: [courses.id],
      relationName: "prereqCourse",
    }),
    catalogVersion: one(courseCatalogVersions, {
      fields: [coursePrerequisites.catalogVersionId],
      references: [courseCatalogVersions.id],
    }),
  })
);

export const graduationRequirementsRelations = relations(
  graduationRequirements,
  ({ one, many }) => ({
    division: one(divisions, {
      fields: [graduationRequirements.divisionId],
      references: [divisions.id],
    }),
    catalogVersion: one(courseCatalogVersions, {
      fields: [graduationRequirements.catalogVersionId],
      references: [courseCatalogVersions.id],
    }),
    requirementProgress: many(requirementProgress),
  })
);

export const careerPathsRelations = relations(careerPaths, ({ many }) => ({
  careerPathCourses: many(careerPathCourses),
}));

export const careerPathCoursesRelations = relations(
  careerPathCourses,
  ({ one }) => ({
    careerPath: one(careerPaths, {
      fields: [careerPathCourses.careerPathId],
      references: [careerPaths.id],
    }),
    course: one(courses, {
      fields: [careerPathCourses.courseId],
      references: [courses.id],
    }),
    catalogVersion: one(courseCatalogVersions, {
      fields: [careerPathCourses.catalogVersionId],
      references: [courseCatalogVersions.id],
    }),
  })
);

export const fourYearPlansRelations = relations(
  fourYearPlans,
  ({ one, many }) => ({
    student: one(users, {
      fields: [fourYearPlans.studentId],
      references: [users.id],
    }),
    account: one(accounts, {
      fields: [fourYearPlans.accountId],
      references: [accounts.id],
    }),
    catalogVersion: one(courseCatalogVersions, {
      fields: [fourYearPlans.catalogVersionId],
      references: [courseCatalogVersions.id],
    }),
    createdFromTemplate: one(fourYearPlans, {
      fields: [fourYearPlans.createdFromTemplateId],
      references: [fourYearPlans.id],
    }),
    planCourses: many(planCourses),
    planShareLinks: many(planShareLinks),
    planShares: many(planShares),
    planHistory: many(planHistory),
    alerts: many(alerts),
    dualCreditLog: many(dualCreditLog),
    requirementProgress: many(requirementProgress),
  })
);

export const planSharesRelations = relations(planShares, ({ one }) => ({
  plan: one(fourYearPlans, {
    fields: [planShares.planId],
    references: [fourYearPlans.id],
  }),
  user: one(users, {
    fields: [planShares.userId],
    references: [users.id],
  }),
}));

export const planCoursesRelations = relations(planCourses, ({ one }) => ({
  plan: one(fourYearPlans, {
    fields: [planCourses.planId],
    references: [fourYearPlans.id],
  }),
  course: one(courses, {
    fields: [planCourses.courseId],
    references: [courses.id],
  }),
}));

export const planShareLinksRelations = relations(
  planShareLinks,
  ({ one }) => ({
    plan: one(fourYearPlans, {
      fields: [planShareLinks.planId],
      references: [fourYearPlans.id],
    }),
    createdByUser: one(users, {
      fields: [planShareLinks.createdBy],
      references: [users.id],
    }),
  })
);

export const planHistoryRelations = relations(planHistory, ({ one }) => ({
  plan: one(fourYearPlans, {
    fields: [planHistory.planId],
    references: [fourYearPlans.id],
  }),
  changedByUser: one(users, {
    fields: [planHistory.changedBy],
    references: [users.id],
  }),
}));

export const gradeEntriesRelations = relations(gradeEntries, ({ one }) => ({
  student: one(users, {
    fields: [gradeEntries.studentId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [gradeEntries.accountId],
    references: [accounts.id],
  }),
  course: one(courses, {
    fields: [gradeEntries.courseId],
    references: [courses.id],
  }),
}));

export const gpaSnapshotsRelations = relations(gpaSnapshots, ({ one }) => ({
  student: one(users, {
    fields: [gpaSnapshots.studentId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [gpaSnapshots.accountId],
    references: [accounts.id],
  }),
}));

export const dualCreditLogRelations = relations(dualCreditLog, ({ one }) => ({
  student: one(users, {
    fields: [dualCreditLog.studentId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [dualCreditLog.accountId],
    references: [accounts.id],
  }),
  plan: one(fourYearPlans, {
    fields: [dualCreditLog.planId],
    references: [fourYearPlans.id],
  }),
  course: one(courses, {
    fields: [dualCreditLog.courseId],
    references: [courses.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  student: one(users, {
    fields: [goals.studentId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [goals.accountId],
    references: [accounts.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  student: one(users, {
    fields: [alerts.studentId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [alerts.accountId],
    references: [accounts.id],
  }),
  relatedPlan: one(fourYearPlans, {
    fields: [alerts.relatedPlanId],
    references: [fourYearPlans.id],
  }),
  relatedCourse: one(courses, {
    fields: [alerts.relatedCourseId],
    references: [courses.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [notifications.accountId],
    references: [accounts.id],
  }),
}));

export const requirementProgressRelations = relations(
  requirementProgress,
  ({ one }) => ({
    student: one(users, {
      fields: [requirementProgress.studentId],
      references: [users.id],
    }),
    account: one(accounts, {
      fields: [requirementProgress.accountId],
      references: [accounts.id],
    }),
    plan: one(fourYearPlans, {
      fields: [requirementProgress.planId],
      references: [fourYearPlans.id],
    }),
    requirement: one(graduationRequirements, {
      fields: [requirementProgress.requirementId],
      references: [graduationRequirements.id],
    }),
    catalogVersion: one(courseCatalogVersions, {
      fields: [requirementProgress.catalogVersionId],
      references: [courseCatalogVersions.id],
    }),
  })
);

export const parentInviteCodesRelations = relations(
  parentInviteCodes,
  ({ one }) => ({
    student: one(users, {
      fields: [parentInviteCodes.studentId],
      references: [users.id],
    }),
    claimedByUser: one(users, {
      fields: [parentInviteCodes.claimedBy],
      references: [users.id],
    }),
  })
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  studentUser: one(users, {
    fields: [accounts.studentUserId],
    references: [users.id],
    relationName: "accountStudent",
  }),
  createdByUser: one(users, {
    fields: [accounts.createdBy],
    references: [users.id],
    relationName: "accountCreator",
  }),
  billingContact: one(users, {
    fields: [accounts.billingContactId],
    references: [users.id],
    relationName: "accountBillingContact",
  }),
  members: many(accountMembers),
  subscriptions: many(subscriptions),
  fourYearPlans: many(fourYearPlans),
  gradeEntries: many(gradeEntries),
  gpaSnapshots: many(gpaSnapshots),
  goals: many(goals),
  alerts: many(alerts),
  notifications: many(notifications),
  requirementProgress: many(requirementProgress),
  dualCreditLog: many(dualCreditLog),
}));

export const accountMembersRelations = relations(accountMembers, ({ one }) => ({
  account: one(accounts, {
    fields: [accountMembers.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [accountMembers.userId],
    references: [users.id],
  }),
  invitedByUser: one(users, {
    fields: [accountMembers.invitedBy],
    references: [users.id],
  }),
}));
