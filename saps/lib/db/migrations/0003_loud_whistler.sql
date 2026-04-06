CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"legal_document_id" uuid NOT NULL,
	"action" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"version" text NOT NULL,
	"effective_date" date NOT NULL,
	"content_hash" text NOT NULL,
	"summary_of_changes" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tos_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pp_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_legal_document_id_legal_documents_id_fk" FOREIGN KEY ("legal_document_id") REFERENCES "public"."legal_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consent_records_user" ON "consent_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_consent_records_user_date" ON "consent_records" USING btree ("user_id","consented_at");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_type_version_unique" ON "legal_documents" USING btree ("type","version");