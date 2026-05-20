ALTER TYPE "public"."caption_status" ADD VALUE 'queued' BEFORE 'processing';--> statement-breakpoint
ALTER TABLE "captions" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "captions" ADD COLUMN "queued_at" timestamp;--> statement-breakpoint
ALTER TABLE "captions" ADD COLUMN "error_detail" text;--> statement-breakpoint
ALTER TABLE "datasets" ADD COLUMN "auto_enqueue" boolean DEFAULT false NOT NULL;