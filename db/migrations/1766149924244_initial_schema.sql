-- Initial schema introspected from Turso database
-- Generated: 2025-12-19T13:12:04.243Z

CREATE TABLE IF NOT EXISTS clients (
  "channel_id" TEXT PRIMARY KEY NULL,
  "channel_name" TEXT NOT NULL,
  "client_name" TEXT NOT NULL,
  "is_active" INTEGER NULL DEFAULT 1,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "avg_sentiment_score" REAL NULL,
  "churn_risk_level" TEXT NULL DEFAULT 'low',
  "engagement_trend" TEXT NULL DEFAULT 'stable',
  "last_sentiment" TEXT NULL,
  "updated_at" INTEGER NULL
);

CREATE TABLE IF NOT EXISTS csm_response_analytics (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "query_id" INTEGER NULL,
  "query_timestamp" INTEGER NOT NULL,
  "response_timestamp" INTEGER NULL,
  "response_time_seconds" INTEGER NULL,
  "resolution_time_seconds" INTEGER NULL,
  "responder_user_id" TEXT NULL,
  "responder_username" TEXT NULL,
  "response_usefulness" TEXT NULL,
  "response_professionalism" TEXT NULL,
  "response_clarity" REAL NULL,
  "contains_loom_link" INTEGER NULL DEFAULT 0,
  "loom_url" TEXT NULL,
  "loom_effectiveness" TEXT NULL,
  "overall_quality_score" REAL NULL,
  "ai_assessment_raw" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "effectiveness_detail" TEXT NULL,
  "effectiveness_level" TEXT NULL DEFAULT "relevant",
  "customer_first_language" TEXT NULL DEFAULT "transactional",
  "five_star_rating" TEXT NULL,
  "confidence_statement" TEXT NULL,
  "confidence_level" TEXT NULL DEFAULT "mid",
  FOREIGN KEY ("query_id") REFERENCES query_board("id"),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS customer_sentiment (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "sentiment_type" TEXT NOT NULL,
  "sentiment_score" REAL NULL,
  "is_complaint" INTEGER NULL DEFAULT 0,
  "is_issue_report" INTEGER NULL DEFAULT 0,
  "is_feedback" INTEGER NULL DEFAULT 0,
  "is_pause_request" INTEGER NULL DEFAULT 0,
  "is_payment_issue" INTEGER NULL DEFAULT 0,
  "is_cancellation_signal" INTEGER NULL DEFAULT 0,
  "is_disengagement" INTEGER NULL DEFAULT 0,
  "is_frustration" INTEGER NULL DEFAULT 0,
  "is_confusion" INTEGER NULL DEFAULT 0,
  "engagement_level" TEXT NULL,
  "message_content" TEXT NOT NULL,
  "ai_summary" TEXT NULL,
  "keywords" TEXT NULL,
  "requires_immediate_action" INTEGER NULL DEFAULT 0,
  "suggested_action" TEXT NULL,
  "ai_analysis_raw" TEXT NULL,
  "author_id" TEXT NULL,
  "author_username" TEXT NULL,
  "message_timestamp" INTEGER NOT NULL,
  "discord_msg_link" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "confidence_level" TEXT NULL DEFAULT "mid",
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS daily_analytics_summary (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "total_client_messages" INTEGER NULL DEFAULT 0,
  "total_team_messages" INTEGER NULL DEFAULT 0,
  "total_queries" INTEGER NULL DEFAULT 0,
  "queries_resolved" INTEGER NULL DEFAULT 0,
  "avg_response_time_seconds" INTEGER NULL,
  "min_response_time_seconds" INTEGER NULL,
  "max_response_time_seconds" INTEGER NULL,
  "avg_resolution_time_seconds" INTEGER NULL,
  "avg_usefulness_score" REAL NULL,
  "avg_professionalism_score" REAL NULL,
  "avg_clarity_score" REAL NULL,
  "avg_overall_quality" REAL NULL,
  "looms_sent" INTEGER NULL DEFAULT 0,
  "looms_effective" INTEGER NULL DEFAULT 0,
  "positive_messages" INTEGER NULL DEFAULT 0,
  "neutral_messages" INTEGER NULL DEFAULT 0,
  "negative_messages" INTEGER NULL DEFAULT 0,
  "frustrated_messages" INTEGER NULL DEFAULT 0,
  "churn_signals_count" INTEGER NULL DEFAULT 0,
  "complaints_count" INTEGER NULL DEFAULT 0,
  "engagement_score" REAL NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS kb_chunks (
  "chunk_id" INTEGER PRIMARY KEY NULL,
  "doc_id" INTEGER NOT NULL,
  "channel_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" F32_BLOB(1536) NULL,
  "topic_tag" TEXT NULL,
  "author_role" TEXT NOT NULL,
  "message_timestamp" INTEGER NULL,
  "metadata" TEXT NULL,
  FOREIGN KEY ("doc_id") REFERENCES kb_documents("doc_id")
);

CREATE TABLE IF NOT EXISTS kb_documents (
  "doc_id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'discord_history',
  "date_range_start" INTEGER NULL,
  "date_range_end" INTEGER NULL,
  "ingested_at" INTEGER NULL DEFAULT unixepoch(),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS looms (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "loom_url" TEXT NOT NULL,
  "loom_id" TEXT NULL,
  "query_context" TEXT NULL,
  "question_id" INTEGER NULL,
  "sender_user_id" TEXT NOT NULL,
  "sender_username" TEXT NULL,
  "client_response_after" TEXT NULL,
  "was_helpful" INTEGER NULL,
  "client_followup_questions" INTEGER NULL DEFAULT 0,
  "sent_at" INTEGER NOT NULL,
  "client_acknowledged_at" INTEGER NULL,
  "discord_msg_link" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("question_id") REFERENCES questions("id"),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS outbound_links (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "link_type" TEXT NULL,
  "is_internal" INTEGER NULL DEFAULT 0,
  "question_id" INTEGER NULL,
  "issue_id" INTEGER NULL,
  "sender_user_id" TEXT NULL,
  "sender_username" TEXT NULL,
  "context" TEXT NULL,
  "was_clicked" INTEGER NULL DEFAULT 0,
  "client_response_after" TEXT NULL,
  "extracted_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "discord_msg_link" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("issue_id") REFERENCES top_issues("id"),
  FOREIGN KEY ("question_id") REFERENCES questions("id"),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  "id" TEXT PRIMARY KEY NULL DEFAULT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  "user_id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT datetime('now'),
  "updated_at" TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS questions (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "ai_summary" TEXT NULL,
  "type" TEXT NOT NULL,
  "urgency" TEXT NOT NULL,
  "status" TEXT NULL DEFAULT 'open',
  "priority" TEXT NULL,
  "discord_msg_link" TEXT NOT NULL,
  "resolved_by_id" TEXT NULL,
  "response_time_seconds" INTEGER NULL,
  "resolution_time_seconds" INTEGER NULL,
  "response_quality_score" REAL NULL,
  "first_response_at" INTEGER NULL,
  "resolved_at" INTEGER NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS risk_radar (
  "id" INTEGER PRIMARY KEY NULL,
  "channel_id" TEXT NOT NULL,
  "last_client_msg_at" INTEGER NULL,
  "last_team_reply_at" INTEGER NULL,
  "inactivity_days" INTEGER NULL DEFAULT 0,
  "risk_status" TEXT NULL DEFAULT 'HEALTHY',
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id")
);

CREATE TABLE IF NOT EXISTS support_agents (
  "id" TEXT PRIMARY KEY NULL DEFAULT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  "user_id" TEXT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "config" TEXT NULL,
  "created_at" TEXT NOT NULL DEFAULT datetime('now'),
  "updated_at" TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS support_kb_chunks (
  "id" TEXT PRIMARY KEY NULL DEFAULT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  "document_id" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" TEXT NULL,
  "metadata" TEXT NULL,
  "created_at" TEXT NOT NULL DEFAULT datetime('now'),
  "updated_at" TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS support_messages (
  "id" TEXT PRIMARY KEY NULL DEFAULT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  "ticket_id" TEXT NOT NULL,
  "sender_type" TEXT NOT NULL,
  "sender_id" TEXT NULL,
  "content" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'public',
  "ai_confidence" REAL NULL,
  "metadata" TEXT NULL,
  "created_at" TEXT NOT NULL DEFAULT datetime('now')
);

CREATE TABLE IF NOT EXISTS support_tickets (
  "id" TEXT PRIMARY KEY NULL DEFAULT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  "user_id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "priority" TEXT NOT NULL DEFAULT 'low',
  "category" TEXT NULL,
  "assigned_agent_id" TEXT NULL,
  "metadata" TEXT NULL,
  "created_at" TEXT NOT NULL DEFAULT datetime('now'),
  "updated_at" TEXT NOT NULL DEFAULT datetime('now'),
  "closed_at" TEXT NULL
);

CREATE TABLE IF NOT EXISTS top_issues (
  "id" INTEGER PRIMARY KEY NULL,
  "topic_category" TEXT NOT NULL,
  "topic_keywords" TEXT NULL,
  "topic_embedding" BLOB NULL,
  "canonical_question" TEXT NOT NULL,
  "sample_questions" TEXT NULL,
  "occurrence_count" INTEGER NULL DEFAULT 1,
  "first_seen_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "last_seen_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "affected_channels" TEXT NULL,
  "unique_clients_count" INTEGER NULL DEFAULT 1,
  "training_material_exists" INTEGER NULL DEFAULT 0,
  "training_recommendation" TEXT NULL,
  "priority" TEXT NULL DEFAULT 'medium',
  "is_addressed" INTEGER NULL DEFAULT 0,
  "addressed_at" INTEGER NULL,
  "addressed_notes" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  "updated_at" INTEGER NOT NULL DEFAULT unixepoch()
);

CREATE TABLE IF NOT EXISTS topissuescomparison-job (
  "id" INTEGER PRIMARY KEY NULL,
  "issue_id" INTEGER NOT NULL,
  "channel_id" TEXT NOT NULL,
  "question_id" INTEGER NULL,
  "message_id" TEXT NOT NULL,
  "message_content" TEXT NOT NULL,
  "similarity_score" REAL NULL,
  "message_timestamp" INTEGER NOT NULL,
  "discord_msg_link" TEXT NULL,
  "created_at" INTEGER NOT NULL DEFAULT unixepoch(),
  FOREIGN KEY ("question_id") REFERENCES questions("id"),
  FOREIGN KEY ("channel_id") REFERENCES clients("channel_id"),
  FOREIGN KEY ("issue_id") REFERENCES top_issues("id")
);

CREATE INDEX IF NOT EXISTS idx_clients_active ON clients (...);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (...);
CREATE INDEX IF NOT EXISTS csm_quality_time_idx ON csm_response_analytics (...);
CREATE INDEX IF NOT EXISTS csm_responder_time_idx ON csm_response_analytics (...);
CREATE INDEX IF NOT EXISTS csm_channel_time_idx ON csm_response_analytics (...);
CREATE INDEX IF NOT EXISTS idx_csm_response_timestamp ON csm_response_analytics (...);
CREATE INDEX IF NOT EXISTS idx_csm_response_responder ON csm_response_analytics (...);
CREATE INDEX IF NOT EXISTS idx_csm_response_channel ON csm_response_analytics (...);
CREATE INDEX IF NOT EXISTS idx_sentiment_channel_complaint ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS sentiment_churn_signals_idx ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS sentiment_type_timestamp_idx ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS sentiment_channel_timestamp_idx ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS idx_sentiment_engagement ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS idx_sentiment_timestamp ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS idx_sentiment_churn_signals ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS idx_sentiment_type ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS idx_sentiment_channel ON customer_sentiment (...);
CREATE INDEX IF NOT EXISTS summary_date_channel_idx ON daily_analytics_summary (...);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_analytics_summary (...);
CREATE INDEX IF NOT EXISTS idx_daily_summary_channel_date ON daily_analytics_summary (...);
CREATE INDEX IF NOT EXISTS idx_kb_doc_id ON kb_chunks (...);
CREATE INDEX IF NOT EXISTS idx_kb_timestamp ON kb_chunks (...);
CREATE INDEX IF NOT EXISTS idx_kb_channel ON kb_chunks (...);
CREATE INDEX IF NOT EXISTS idx_kb_documents_channel_ingested ON kb_documents (...);
CREATE INDEX IF NOT EXISTS idx_kb_documents_ingested_at ON kb_documents (...);
CREATE INDEX IF NOT EXISTS idx_kb_documents_channel ON kb_documents (...);
CREATE INDEX IF NOT EXISTS looms_channel_time_idx ON looms (...);
CREATE INDEX IF NOT EXISTS idx_looms_question ON looms (...);
CREATE INDEX IF NOT EXISTS idx_looms_timestamp ON looms (...);
CREATE INDEX IF NOT EXISTS idx_looms_sender ON looms (...);
CREATE INDEX IF NOT EXISTS idx_looms_channel ON looms (...);
CREATE INDEX IF NOT EXISTS links_channel_type_time_idx ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_outbound_timestamp ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_outbound_sender ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_outbound_url ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_outbound_issue ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_outbound_question ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_outbound_channel ON outbound_links (...);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id_active ON push_subscriptions (...);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions (...);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (...);
CREATE INDEX IF NOT EXISTS idx_questions_channel_created ON questions (...);
CREATE INDEX IF NOT EXISTS questions_created_status_idx ON questions (...);
CREATE INDEX IF NOT EXISTS questions_channel_status_created_idx ON questions (...);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions (...);
CREATE INDEX IF NOT EXISTS idx_questions_urgency ON questions (...);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions (...);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions (...);
CREATE INDEX IF NOT EXISTS idx_questions_channel ON questions (...);
CREATE INDEX IF NOT EXISTS idx_radar_channel_status ON risk_radar (...);
CREATE INDEX IF NOT EXISTS risk_inactivity_status_idx ON risk_radar (...);
CREATE INDEX IF NOT EXISTS idx_risk_radar_updated_at ON risk_radar (...);
CREATE INDEX IF NOT EXISTS idx_risk_radar_inactivity_days ON risk_radar (...);
CREATE INDEX IF NOT EXISTS idx_risk_radar_last_client_msg_at ON risk_radar (...);
CREATE INDEX IF NOT EXISTS idx_risk_radar_risk_status ON risk_radar (...);
CREATE INDEX IF NOT EXISTS idx_risk_radar_channel_id ON risk_radar (...);
CREATE INDEX IF NOT EXISTS idx_support_agents_is_active ON support_agents (...);
CREATE INDEX IF NOT EXISTS idx_support_agents_type ON support_agents (...);
CREATE INDEX IF NOT EXISTS idx_support_agents_user_id ON support_agents (...);
CREATE INDEX IF NOT EXISTS idx_support_kb_chunks_document_name ON support_kb_chunks (...);
CREATE INDEX IF NOT EXISTS idx_support_kb_chunks_document_id ON support_kb_chunks (...);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages (...);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_visibility ON support_messages (...);
CREATE INDEX IF NOT EXISTS idx_support_messages_visibility ON support_messages (...);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_type ON support_messages (...);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id_created ON support_tickets (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id_status ON support_tickets (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_agent ON support_tickets (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (...);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets (...);
CREATE INDEX IF NOT EXISTS issues_priority_count_idx ON top_issues (...);
CREATE INDEX IF NOT EXISTS idx_top_issues_unaddressed ON top_issues (...);
CREATE INDEX IF NOT EXISTS idx_top_issues_priority ON top_issues (...);
CREATE INDEX IF NOT EXISTS idx_top_issues_count ON top_issues (...);
CREATE INDEX IF NOT EXISTS idx_top_issues_category ON top_issues (...);
CREATE INDEX IF NOT EXISTS idx_topissuescomparison_message ON topissuescomparison-job (...);
CREATE INDEX IF NOT EXISTS idx_topissuescomparison_question ON topissuescomparison-job (...);
CREATE INDEX IF NOT EXISTS idx_topissuescomparison_channel ON topissuescomparison-job (...);
CREATE INDEX IF NOT EXISTS idx_topissuescomparison_issue ON topissuescomparison-job (...);
