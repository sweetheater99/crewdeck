ALTER TABLE "agents" ADD COLUMN "requires_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "review_status" text;