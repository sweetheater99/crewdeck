ALTER TABLE "agents" ADD COLUMN "retry_policy" jsonb DEFAULT '{"maxRetries":3,"backoffSec":300}'::jsonb;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "fallback_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_fallback_agent_id_agents_id_fk" FOREIGN KEY ("fallback_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;