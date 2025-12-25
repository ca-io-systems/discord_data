-- Add Whop Support Messages tracking tables
-- Stores complete data from Whop API without enrichment
-- Generated: 2025-12-23T18:30:00.000Z

CREATE TABLE IF NOT EXISTS whop_support_channels (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "whop_channel_id" TEXT NOT NULL UNIQUE,
  "company_id" TEXT NULL,
  "customer_user_id" TEXT NOT NULL,
  "customer_name" TEXT NULL,
  "customer_username" TEXT NULL,
  "custom_name" TEXT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "last_message_at" TEXT NULL,
  "resolved_at" TEXT NULL,
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "last_synced_at" INTEGER NULL,
  "messages_synced" INTEGER NOT NULL DEFAULT 0,
  "raw_data" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch()
);

CREATE TABLE IF NOT EXISTS whop_support_messages (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "whop_message_id" TEXT NOT NULL UNIQUE,
  "whop_channel_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT NULL,
  "user_username" TEXT NULL,
  "user_profile_picture_url" TEXT NULL,
  "content" TEXT NOT NULL,
  "rich_content" TEXT NULL,
  "is_edited" INTEGER NOT NULL DEFAULT 0,
  "is_pinned" INTEGER NOT NULL DEFAULT 0,
  "message_type" TEXT NOT NULL DEFAULT 'regular',
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "replying_to_message_id" TEXT NULL,
  "is_everyone_mentioned" INTEGER NOT NULL DEFAULT 0,
  "mentioned_user_ids" TEXT NULL,
  "attachments" TEXT NULL,
  "reaction_counts" TEXT NULL,
  "poll_data" TEXT NULL,
  "whop_created_at" TEXT NULL,
  "whop_updated_at" TEXT NULL,
  "synced_to_discord" INTEGER NOT NULL DEFAULT 0,
  "discord_message_id" TEXT NULL,
  "raw_data" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("whop_channel_id") REFERENCES whop_support_channels("whop_channel_id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_whop_channel_id" ON whop_support_messages("whop_channel_id");
CREATE INDEX IF NOT EXISTS "idx_whop_user_id" ON whop_support_messages("user_id");
CREATE INDEX IF NOT EXISTS "idx_whop_created_at" ON whop_support_messages("whop_created_at");
CREATE INDEX IF NOT EXISTS "idx_whop_message_id" ON whop_support_messages("whop_message_id");
CREATE INDEX IF NOT EXISTS "idx_whop_synced_discord" ON whop_support_messages("synced_to_discord");
CREATE INDEX IF NOT EXISTS "idx_whop_channel_created" ON whop_support_messages("whop_channel_id", "whop_created_at");

CREATE INDEX IF NOT EXISTS "idx_whop_channel_id_unique" ON whop_support_channels("whop_channel_id");
CREATE INDEX IF NOT EXISTS "idx_whop_channel_customer" ON whop_support_channels("customer_user_id");
CREATE INDEX IF NOT EXISTS "idx_whop_channel_status" ON whop_support_channels("status");
CREATE INDEX IF NOT EXISTS "idx_whop_last_synced" ON whop_support_channels("last_synced_at");
