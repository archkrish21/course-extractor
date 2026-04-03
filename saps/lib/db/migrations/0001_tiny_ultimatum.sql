ALTER TABLE "four_year_plans" ADD COLUMN "locked_grade_levels" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "price_four_year" numeric(7, 2);