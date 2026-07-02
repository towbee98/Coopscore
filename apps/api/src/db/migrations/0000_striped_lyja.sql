CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."coop_type" AS ENUM('cooperative', 'sacco', 'church', 'trade_association', 'other');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."trend" AS ENUM('improving', 'stable', 'declining');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"virtual_account_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"nomba_transaction_ref" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"contributed_at" timestamp with time zone NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"raw_webhook_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributions_amount_positive" CHECK ("contributions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "cooperatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "coop_type" NOT NULL,
	"contact_email" "citext" NOT NULL,
	"contact_phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"amount_requested" numeric(14, 2) NOT NULL,
	"amount_approved" numeric(14, 2),
	"risk_tier_at_decision" "risk_tier" NOT NULL,
	"status" "loan_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooperative_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" "citext",
	"expected_contribution_amount" numeric(14, 2) NOT NULL,
	"contribution_frequency" "frequency" NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"joined_at" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_expected_contribution_positive" CHECK ("members"."expected_contribution_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"score_snapshot_id" uuid NOT NULL,
	"risk_tier" "risk_tier" NOT NULL,
	"recommended_amount" numeric(14, 2) NOT NULL,
	"llm_explanation" text,
	"llm_model_used" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"consistency_pct" numeric(5, 2) NOT NULL,
	"months_active" integer NOT NULL,
	"missed_payments_count" integer NOT NULL,
	"average_contribution" numeric(14, 2) NOT NULL,
	"trend" "trend" NOT NULL,
	"risk_tier" "risk_tier" NOT NULL,
	"recommended_loan_amount" numeric(14, 2) NOT NULL,
	"inputs_snapshot" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_snapshots_consistency_pct_range" CHECK ("score_snapshots"."consistency_pct" BETWEEN 0 AND 100),
	CONSTRAINT "score_snapshots_months_active_nonnegative" CHECK ("score_snapshots"."months_active" >= 0),
	CONSTRAINT "score_snapshots_missed_payments_nonnegative" CHECK ("score_snapshots"."missed_payments_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "virtual_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"nomba_account_ref" text NOT NULL,
	"account_number" text NOT NULL,
	"bank_name" text NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"provider_response" jsonb,
	"provisioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suspended_at" timestamp with time zone,
	CONSTRAINT "virtual_accounts_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_virtual_account_id_virtual_accounts_id_fk" FOREIGN KEY ("virtual_account_id") REFERENCES "public"."virtual_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_cooperative_id_cooperatives_id_fk" FOREIGN KEY ("cooperative_id") REFERENCES "public"."cooperatives"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_score_snapshot_id_score_snapshots_id_fk" FOREIGN KEY ("score_snapshot_id") REFERENCES "public"."score_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_accounts" ADD CONSTRAINT "virtual_accounts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_cooperative_id_created_at_idx" ON "audit_logs" USING btree ("cooperative_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contributions_nomba_transaction_ref_idx" ON "contributions" USING btree ("nomba_transaction_ref");--> statement-breakpoint
CREATE INDEX "contributions_member_id_period_start_idx" ON "contributions" USING btree ("member_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "cooperatives_contact_email_idx" ON "cooperatives" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "loans_member_id_idx" ON "loans" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "members_cooperative_id_idx" ON "members" USING btree ("cooperative_id");--> statement-breakpoint
CREATE INDEX "members_cooperative_id_status_idx" ON "members" USING btree ("cooperative_id","status");--> statement-breakpoint
CREATE INDEX "recommendations_member_id_generated_at_idx" ON "recommendations" USING btree ("member_id","generated_at");--> statement-breakpoint
CREATE INDEX "score_snapshots_member_id_computed_at_idx" ON "score_snapshots" USING btree ("member_id","computed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_accounts_nomba_account_ref_idx" ON "virtual_accounts" USING btree ("nomba_account_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_accounts_account_number_idx" ON "virtual_accounts" USING btree ("account_number");