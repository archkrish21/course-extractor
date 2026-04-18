ALTER TABLE "users" ADD COLUMN "profile_setup_completed_at" timestamp with time zone;
-- Backfill: all existing users already completed profile setup
UPDATE "users" SET "profile_setup_completed_at" = "created_at" WHERE "profile_setup_completed_at" IS NULL;