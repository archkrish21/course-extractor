ALTER TABLE "grade_entries" DROP CONSTRAINT "semester_values";--> statement-breakpoint
ALTER TABLE "plan_courses" DROP CONSTRAINT "semester_values";--> statement-breakpoint
ALTER TABLE "account_members" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "account_members" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "career_path_courses" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "course_prerequisites" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "graduation_requirements" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "graduation_requirements" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "plan_courses" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "plan_courses" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "student_requirement_status" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "grade_entries" ADD CONSTRAINT "semester_values" CHECK ("grade_entries"."semester" IN (-2, -1, 1, 2));--> statement-breakpoint
ALTER TABLE "plan_courses" ADD CONSTRAINT "semester_values" CHECK ("plan_courses"."semester" IN (-2, -1, 1, 2) OR "plan_courses"."semester" IS NULL);