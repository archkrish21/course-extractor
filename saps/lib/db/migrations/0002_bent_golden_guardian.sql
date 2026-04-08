CREATE TABLE "plan_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by" uuid,
	"permission" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "plan_shares" ADD CONSTRAINT "plan_shares_plan_id_four_year_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."four_year_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_shares" ADD CONSTRAINT "plan_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_shares" ADD CONSTRAINT "plan_shares_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_shares_plan_user_unique" ON "plan_shares" USING btree ("plan_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_plan_shares_user" ON "plan_shares" USING btree ("user_id");