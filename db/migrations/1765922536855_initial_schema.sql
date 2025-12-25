-- Database schema introspected from Turso
-- Generated: 2025-12-16T22:02:16.567Z
-- This represents your current database state as the initial migration

CREATE TABLE clients (
        channel_id TEXT PRIMARY KEY,
        channel_name TEXT NOT NULL,
        client_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      , avg_sentiment_score REAL, churn_risk_level TEXT DEFAULT 'low', engagement_trend TEXT DEFAULT 'stable', last_sentiment TEXT, updated_at INTEGER);

CREATE TABLE csm_response_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        query_id INTEGER,
        query_timestamp INTEGER NOT NULL,
        response_timestamp INTEGER,
        response_time_seconds INTEGER,
        resolution_time_seconds INTEGER,
        responder_user_id TEXT,
        responder_username TEXT,
        response_usefulness TEXT,
        response_professionalism TEXT,
        response_clarity REAL,
        contains_loom_link INTEGER DEFAULT 0,
        loom_url TEXT,
        loom_effectiveness TEXT,
        overall_quality_score REAL,
        ai_assessment_raw TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()), effectiveness_detail TEXT, effectiveness_level TEXT DEFAULT "relevant", customer_first_language TEXT DEFAULT "transactional", five_star_rating TEXT, confidence_statement TEXT, confidence_level TEXT DEFAULT "mid",
        FOREIGN KEY (channel_id) REFERENCES clients(channel_id),
        FOREIGN KEY (query_id) REFERENCES query_board(id)
      );

CREATE TABLE customer_sentiment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        sentiment_type TEXT NOT NULL,
        sentiment_score REAL,
        is_complaint INTEGER DEFAULT 0,
        is_issue_report INTEGER DEFAULT 0,
        is_feedback INTEGER DEFAULT 0,
        is_pause_request INTEGER DEFAULT 0,
        is_payment_issue INTEGER DEFAULT 0,
        is_cancellation_signal INTEGER DEFAULT 0,
        is_disengagement INTEGER DEFAULT 0,
        is_frustration INTEGER DEFAULT 0,
        is_confusion INTEGER DEFAULT 0,
        engagement_level TEXT,
        message_content TEXT NOT NULL,
        ai_summary TEXT,
        keywords TEXT,
        requires_immediate_action INTEGER DEFAULT 0,
        suggested_action TEXT,
        ai_analysis_raw TEXT,
        author_id TEXT,
        author_username TEXT,
        message_timestamp INTEGER NOT NULL,
        discord_msg_link TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()), confidence_level TEXT DEFAULT "mid",
        FOREIGN KEY (channel_id) REFERENCES clients(channel_id)
      );

CREATE TABLE daily_analytics_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        date TEXT NOT NULL,
        total_client_messages INTEGER DEFAULT 0,
        total_team_messages INTEGER DEFAULT 0,
        total_queries INTEGER DEFAULT 0,
        queries_resolved INTEGER DEFAULT 0,
        avg_response_time_seconds INTEGER,
        min_response_time_seconds INTEGER,
        max_response_time_seconds INTEGER,
        avg_resolution_time_seconds INTEGER,
        avg_usefulness_score REAL,
        avg_professionalism_score REAL,
        avg_clarity_score REAL,
        avg_overall_quality REAL,
        looms_sent INTEGER DEFAULT 0,
        looms_effective INTEGER DEFAULT 0,
        positive_messages INTEGER DEFAULT 0,
        neutral_messages INTEGER DEFAULT 0,
        negative_messages INTEGER DEFAULT 0,
        frustrated_messages INTEGER DEFAULT 0,
        churn_signals_count INTEGER DEFAULT 0,
        complaints_count INTEGER DEFAULT 0,
        engagement_score REAL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(channel_id, date),
        FOREIGN KEY (channel_id) REFERENCES clients(channel_id)
      );

CREATE TABLE kb_chunks (
        chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding F32_BLOB(1536),
        topic_tag TEXT,
        author_role TEXT CHECK(author_role IN ('client', 'team')) NOT NULL,
        message_timestamp INTEGER,
        metadata TEXT,
        FOREIGN KEY(doc_id) REFERENCES kb_documents(doc_id)
      );

CREATE TABLE kb_documents (
        doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'discord_history',
        date_range_start INTEGER,
        date_range_end INTEGER,
        ingested_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY(channel_id) REFERENCES clients(channel_id)
      );

CREATE TABLE looms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    loom_url TEXT NOT NULL,
    loom_id TEXT,
    query_context TEXT,
    question_id INTEGER,
    sender_user_id TEXT NOT NULL,
    sender_username TEXT,
    client_response_after TEXT,
    was_helpful INTEGER,
    client_followup_questions INTEGER DEFAULT 0,
    sent_at INTEGER NOT NULL,
    client_acknowledged_at INTEGER,
    discord_msg_link TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (channel_id) REFERENCES clients(channel_id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE outbound_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    url TEXT NOT NULL,
    link_type TEXT,
    is_internal INTEGER DEFAULT 0,
    question_id INTEGER,
    issue_id INTEGER,
    sender_user_id TEXT,
    sender_username TEXT,
    context TEXT,
    was_clicked INTEGER DEFAULT 0,
    client_response_after TEXT,
    extracted_at INTEGER NOT NULL DEFAULT (unixepoch()),
    discord_msg_link TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(message_id, url),
    FOREIGN KEY (channel_id) REFERENCES clients(channel_id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (issue_id) REFERENCES top_issues(id)
);

CREATE TABLE push_subscriptions (
		id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
		user_id TEXT NOT NULL,
		endpoint TEXT NOT NULL,
		p256dh TEXT NOT NULL,
		auth TEXT NOT NULL,
		user_agent TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

CREATE TABLE questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    content TEXT NOT NULL,
    ai_summary TEXT,
    type TEXT NOT NULL,
    urgency TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT,
    discord_msg_link TEXT NOT NULL,
    resolved_by_id TEXT,
    response_time_seconds INTEGER,
    resolution_time_seconds INTEGER,
    response_quality_score REAL,
    first_response_at INTEGER,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (channel_id) REFERENCES clients(channel_id)
);

CREATE TABLE risk_radar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channel_id TEXT NOT NULL UNIQUE,
          last_client_msg_at INTEGER,
          last_team_reply_at INTEGER,
          inactivity_days INTEGER DEFAULT 0,
          risk_status TEXT DEFAULT 'HEALTHY' CHECK(risk_status IN ('HEALTHY', 'STAGNANT', 'AT_RISK', 'CHURNED')),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (channel_id) REFERENCES clients(channel_id) ON DELETE CASCADE
        );

CREATE TABLE support_agents (
		id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
		user_id TEXT,
		name TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('human', 'ai')),
		is_active INTEGER NOT NULL DEFAULT 1,
		config TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

CREATE TABLE support_kb_chunks (
		id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
		document_id TEXT NOT NULL,
		document_name TEXT NOT NULL,
		content TEXT NOT NULL,
		embedding TEXT,
		metadata TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

CREATE TABLE support_messages (
		id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
		ticket_id TEXT NOT NULL,
		sender_type TEXT NOT NULL CHECK(sender_type IN ('user', 'human_agent', 'ai_agent')),
		sender_id TEXT,
		content TEXT NOT NULL,
		visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'internal')),
		ai_confidence REAL,
		metadata TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

CREATE TABLE support_tickets (
		id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
		user_id TEXT NOT NULL,
		subject TEXT NOT NULL,
		description TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'pending', 'closed')),
		priority TEXT NOT NULL DEFAULT 'low' CHECK(priority IN ('low', 'high')),
		category TEXT CHECK(category IN ('bug', 'feature', 'question', 'other')),
		assigned_agent_id TEXT,
		metadata TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now')),
		closed_at TEXT
	);

CREATE TABLE top_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_category TEXT NOT NULL,
    topic_keywords TEXT,
    topic_embedding BLOB,
    canonical_question TEXT NOT NULL,
    sample_questions TEXT,
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    affected_channels TEXT,
    unique_clients_count INTEGER DEFAULT 1,
    training_material_exists INTEGER DEFAULT 0,
    training_recommendation TEXT,
    priority TEXT DEFAULT 'medium',
    is_addressed INTEGER DEFAULT 0,
    addressed_at INTEGER,
    addressed_notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE `topissuescomparison-job` (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    channel_id TEXT NOT NULL,
    question_id INTEGER,
    message_id TEXT NOT NULL,
    message_content TEXT NOT NULL,
    similarity_score REAL,
    message_timestamp INTEGER NOT NULL,
    discord_msg_link TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (issue_id) REFERENCES top_issues(id),
    FOREIGN KEY (channel_id) REFERENCES clients(channel_id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Indexes
CREATE INDEX idx_clients_active ON clients(is_active);
CREATE INDEX idx_clients_name ON clients(client_name);
CREATE INDEX idx_csm_response_channel ON csm_response_analytics(channel_id);
CREATE INDEX idx_csm_response_responder ON csm_response_analytics(responder_user_id);
CREATE INDEX idx_csm_response_timestamp ON csm_response_analytics(query_timestamp);
CREATE INDEX idx_daily_summary_channel_date ON daily_analytics_summary(channel_id, date);
CREATE INDEX idx_daily_summary_date ON daily_analytics_summary(date);
CREATE INDEX idx_kb_channel ON kb_chunks(channel_id);
CREATE INDEX idx_kb_doc_id ON kb_chunks(doc_id);
CREATE INDEX idx_kb_timestamp ON kb_chunks(message_timestamp);
CREATE INDEX idx_looms_channel ON looms(channel_id);
CREATE INDEX idx_looms_question ON looms(question_id);
CREATE INDEX idx_looms_sender ON looms(sender_user_id);
CREATE INDEX idx_looms_timestamp ON looms(sent_at);
CREATE INDEX idx_outbound_channel ON outbound_links(channel_id);
CREATE INDEX idx_outbound_issue ON outbound_links(issue_id);
CREATE INDEX idx_outbound_question ON outbound_links(question_id);
CREATE INDEX idx_outbound_sender ON outbound_links(sender_user_id);
CREATE INDEX idx_outbound_timestamp ON outbound_links(extracted_at);
CREATE INDEX idx_outbound_url ON outbound_links(url);
CREATE INDEX idx_push_subscriptions_is_active ON push_subscriptions(is_active);
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_user_id_active ON push_subscriptions(user_id, is_active);
CREATE INDEX idx_questions_channel ON questions(channel_id);
CREATE INDEX idx_questions_created_at ON questions(created_at);
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_urgency ON questions(urgency);
CREATE INDEX idx_risk_radar_channel_id ON risk_radar(channel_id);
CREATE INDEX idx_risk_radar_inactivity_days ON risk_radar(inactivity_days);
CREATE INDEX idx_risk_radar_last_client_msg_at ON risk_radar(last_client_msg_at);
CREATE INDEX idx_risk_radar_risk_status ON risk_radar(risk_status);
CREATE INDEX idx_risk_radar_updated_at ON risk_radar(updated_at);
CREATE INDEX idx_sentiment_channel ON customer_sentiment(channel_id);
CREATE INDEX idx_sentiment_churn_signals ON customer_sentiment(is_pause_request, is_payment_issue, is_cancellation_signal);
CREATE INDEX idx_sentiment_engagement ON customer_sentiment(engagement_level);
CREATE INDEX idx_sentiment_timestamp ON customer_sentiment(message_timestamp);
CREATE INDEX idx_sentiment_type ON customer_sentiment(sentiment_type);
CREATE INDEX idx_support_agents_is_active ON support_agents(is_active);
CREATE INDEX idx_support_agents_type ON support_agents(type);
CREATE INDEX idx_support_agents_user_id ON support_agents(user_id);
CREATE INDEX idx_support_kb_chunks_document_id ON support_kb_chunks(document_id);
CREATE INDEX idx_support_kb_chunks_document_name ON support_kb_chunks(document_name);
CREATE INDEX idx_support_messages_sender_type ON support_messages(sender_type);
CREATE INDEX idx_support_messages_ticket_created ON support_messages(ticket_id, created_at);
CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX idx_support_messages_ticket_visibility ON support_messages(ticket_id, visibility);
CREATE INDEX idx_support_messages_visibility ON support_messages(visibility);
CREATE INDEX idx_support_tickets_assigned_agent ON support_tickets(assigned_agent_id);
CREATE INDEX idx_support_tickets_category ON support_tickets(category);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_user_id_created ON support_tickets(user_id, created_at);
CREATE INDEX idx_support_tickets_user_id_status ON support_tickets(user_id, status);
CREATE INDEX idx_top_issues_category ON top_issues(topic_category);
CREATE INDEX idx_top_issues_count ON top_issues(occurrence_count);
CREATE INDEX idx_top_issues_priority ON top_issues(priority);
CREATE INDEX idx_top_issues_unaddressed ON top_issues(is_addressed);
CREATE INDEX idx_topissuescomparison_channel ON `topissuescomparison-job`(channel_id);
CREATE INDEX idx_topissuescomparison_issue ON `topissuescomparison-job`(issue_id);
CREATE INDEX idx_topissuescomparison_message ON `topissuescomparison-job`(message_id);
CREATE INDEX idx_topissuescomparison_question ON `topissuescomparison-job`(question_id);
