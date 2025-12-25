/**
 * Drizzle ORM Schema for CAIO Discord Bot
 * 
 * This is the source of truth for your database structure.
 * All tables, relationships, and audit trails are defined here.
 * 
 * Workflow:
 * 1. Update this file when making schema changes
 * 2. Run: npx drizzle-kit generate:sqlite
 * 3. Review generated SQL in ./db/migrations/
 * 4. Run: npx drizzle-kit migrate
 * 5. Commit both schema.ts and migrations to git for full audit trail
 */

import {
  sqliteTable,
  integer,
  text,
  real,
  primaryKey,
  index,
  unique,
  check,
  blob,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// ============================================================================
// KNOWLEDGE BASE TABLES
// ============================================================================

/**
 * KB Documents - Source documents for knowledge base
 */
export const kb_documents = sqliteTable(
  'kb_documents',
  {
    doc_id: integer('doc_id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id').notNull().references(() => clients.channel_id),
    source_type: text('source_type').default('discord_history').notNull(),
    date_range_start: integer('date_range_start'),
    date_range_end: integer('date_range_end'),
    ingested_at: integer('ingested_at').default(sql`(unixepoch())`),
  },
  (table) => ({
    channel_ingested_idx: index('idx_kb_documents_channel_ingested').on(table.channel_id, table.ingested_at),
    ingested_at_idx: index('idx_kb_documents_ingested_at').on(table.ingested_at),
    channel_idx: index('idx_kb_documents_channel').on(table.channel_id),
  })
);

/**
 * KB Chunks - Semantic chunks of knowledge base documents
 */
export const kb_chunks = sqliteTable(
  'kb_chunks',
  {
    chunk_id: integer('chunk_id').primaryKey({ autoIncrement: true }),
    doc_id: integer('doc_id').notNull().references(() => kb_documents.doc_id),
    channel_id: text('channel_id').notNull(),
    content: text('content').notNull(),
    embedding: real('embedding'), // Changed from text to real/numeric to match DB
    topic_tag: text('topic_tag'),
    author_role: text('author_role').notNull(), // client|team
    message_timestamp: integer('message_timestamp'),
    metadata: text('metadata'), // JSON string
  },
  (table) => ({
    doc_id_idx: index('idx_kb_doc_id').on(table.doc_id),
    timestamp_idx: index('idx_kb_timestamp').on(table.message_timestamp),
    channel_idx: index('idx_kb_channel').on(table.channel_id),
  })
);

// ============================================================================
// SUPPORT SYSTEM TABLES
// ============================================================================

/**
 * Support Agents - Human and AI agents
 */
export const support_agents = sqliteTable(
  'support_agents',
  {
    id: text('id').primaryKey().default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`),
    user_id: text('user_id'),
    name: text('name').notNull(),
    type: text('type').notNull(), // human|ai
    is_active: integer('is_active').default(1).notNull(),
    config: text('config'), // JSON config for AI agents
    created_at: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updated_at: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  },
  (table) => ({
    is_active_idx: index('idx_support_agents_is_active').on(table.is_active),
    type_idx: index('idx_support_agents_type').on(table.type),
    user_id_idx: index('idx_support_agents_user_id').on(table.user_id),
  })
);

/**
 * Support Tickets - Customer support requests
 */
export const support_tickets = sqliteTable(
  'support_tickets',
  {
    id: text('id').primaryKey().default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`),
    user_id: text('user_id').notNull(),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    status: text('status').default('open').notNull(), // open|pending|closed
    priority: text('priority').default('low').notNull(), // low|high
    category: text('category'), // bug|feature|question|other
    assigned_agent_id: text('assigned_agent_id').references(() => support_agents.id),
    metadata: text('metadata'),
    created_at: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updated_at: text('updated_at').default(sql`(datetime('now'))`).notNull(),
    closed_at: text('closed_at'),
  },
  (table) => ({
    user_created_idx: index('idx_support_tickets_user_id_created').on(table.user_id, table.created_at),
    user_status_idx: index('idx_support_tickets_user_id_status').on(table.user_id, table.status),
    assigned_agent_idx: index('idx_support_tickets_assigned_agent').on(table.assigned_agent_id),
    category_idx: index('idx_support_tickets_category').on(table.category),
    priority_idx: index('idx_support_tickets_priority').on(table.priority),
    status_idx: index('idx_support_tickets_status').on(table.status),
    user_id_idx: index('idx_support_tickets_user_id').on(table.user_id),
  })
);

/**
 * Support Messages - Messages within a ticket
 */
export const support_messages = sqliteTable(
  'support_messages',
  {
    id: text('id').primaryKey().default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`),
    ticket_id: text('ticket_id').notNull().references(() => support_tickets.id),
    sender_type: text('sender_type').notNull(), // user|human_agent|ai_agent
    sender_id: text('sender_id'),
    content: text('content').notNull(),
    visibility: text('visibility').default('public').notNull(), // public|internal
    ai_confidence: real('ai_confidence'),
    metadata: text('metadata'),
    created_at: text('created_at').default(sql`(datetime('now'))`).notNull(),
  },
  (table) => ({
    ticket_created_idx: index('idx_support_messages_ticket_created').on(table.ticket_id, table.created_at),
    ticket_visibility_idx: index('idx_support_messages_ticket_visibility').on(table.ticket_id, table.visibility),
    visibility_idx: index('idx_support_messages_visibility').on(table.visibility),
    sender_type_idx: index('idx_support_messages_sender_type').on(table.sender_type),
    ticket_id_idx: index('idx_support_messages_ticket_id').on(table.ticket_id),
  })
);

/**
 * Support KB Chunks - Knowledge base for support system
 */
export const support_kb_chunks = sqliteTable(
  'support_kb_chunks',
  {
    id: text('id').primaryKey().default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`),
    document_id: text('document_id').notNull(),
    document_name: text('document_name').notNull(),
    content: text('content').notNull(),
    embedding: text('embedding'),
    metadata: text('metadata'),
    created_at: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updated_at: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  },
  (table) => ({
    doc_name_idx: index('idx_support_kb_chunks_document_name').on(table.document_name),
    doc_id_idx: index('idx_support_kb_chunks_document_id').on(table.document_id),
  })
);

/**
 * Push Subscriptions - Web push notifications
 */
export const push_subscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey().default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`),
    user_id: text('user_id').notNull(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    user_agent: text('user_agent'),
    is_active: integer('is_active').default(1).notNull(),
    created_at: text('created_at').default(sql`(datetime('now'))`).notNull(),
    updated_at: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  },
  (table) => ({
    user_active_idx: index('idx_push_subscriptions_user_id_active').on(table.user_id, table.is_active),
    is_active_idx: index('idx_push_subscriptions_is_active').on(table.is_active),
    user_id_idx: index('idx_push_subscriptions_user_id').on(table.user_id),
  })
);

// ============================================================================
// CORE TABLES
// ============================================================================

/**
 * Clients - Customer/Channel mapping
 * Source of truth for all client relationships
 */
export const clients = sqliteTable(
  'clients',
  {
    channel_id: text('channel_id').primaryKey(),
    channel_name: text('channel_name').notNull(),
    client_name: text('client_name').notNull(),
    is_active: integer('is_active').default(1),

    // Churn Risk & Sentiment (Context7 Best Practices)
    last_sentiment: text('last_sentiment'),
    avg_sentiment_score: real('avg_sentiment_score'),
    churn_risk_level: text('churn_risk_level').default('low'),
    engagement_trend: text('engagement_trend').default('stable'),

    // Timestamps for audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at'),
  },
  (table) => ({
    channel_name_idx: index('idx_clients_name').on(table.client_name),
    is_active_idx: index('idx_clients_active').on(table.is_active),
  })
);

/**
 * Questions - Customer queries and issues
 * Renamed from query_board for clarity
 */
export const questions = sqliteTable(
  'questions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id').notNull().references(() => clients.channel_id),
    content: text('content').notNull(),
    ai_summary: text('ai_summary'),

    // Classification
    type: text('type').notNull(),
    urgency: text('urgency').notNull(),
    status: text('status').default('open'),
    priority: text('priority'),

    // Discord deep linking
    discord_msg_link: text('discord_msg_link').notNull(),

    // Response tracking
    resolved_by_id: text('resolved_by_id'),
    response_time_seconds: integer('response_time_seconds'),
    resolution_time_seconds: integer('resolution_time_seconds'),
    response_quality_score: real('response_quality_score'),
    first_response_at: integer('first_response_at'),
    resolved_at: integer('resolved_at'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    channel_idx: index('idx_questions_channel').on(table.channel_id),
    status_idx: index('idx_questions_status').on(table.status),
    type_idx: index('idx_questions_type').on(table.type),
    urgency_idx: index('idx_questions_urgency').on(table.urgency),
    created_at_idx: index('idx_questions_created_at').on(table.created_at),
    channel_status_created_idx: index('questions_channel_status_created_idx').on(table.channel_id, table.status, table.created_at),
    created_status_idx: index('questions_created_status_idx').on(table.created_at, table.status),
    channel_created_idx: index('idx_questions_channel_created').on(table.channel_id, table.created_at),
  })
);

/**
 * Risk Radar - Inactivity and churn risk tracking
 * Daily monitoring of client health
 */
export const risk_radar = sqliteTable(
  'risk_radar',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id').notNull().unique().references(() => clients.channel_id, { onDelete: 'cascade' }),
    last_client_msg_at: integer('last_client_msg_at'),
    last_team_reply_at: integer('last_team_reply_at'),
    inactivity_days: integer('inactivity_days').default(0),
    risk_status: text('risk_status').default('HEALTHY'), // HEALTHY|AT_RISK|CRITICAL
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    channel_id_idx: index('idx_risk_radar_channel_id').on(table.channel_id),
    risk_status_idx: index('idx_risk_radar_risk_status').on(table.risk_status),
    updated_at_idx: index('idx_risk_radar_updated_at').on(table.updated_at),
    last_client_msg_idx: index('idx_risk_radar_last_client_msg_at').on(table.last_client_msg_at),
    inactivity_days_idx: index('idx_risk_radar_inactivity_days').on(table.inactivity_days),
    radar_channel_status_idx: index('idx_radar_channel_status').on(table.channel_id, table.risk_status),
    inactivity_status_idx: index('risk_inactivity_status_idx').on(table.inactivity_days, table.risk_status),
  })
);

// ============================================================================
// ANALYTICS TABLES (Context7 Best Practices Integrated)
// ============================================================================

/**
 * Customer Sentiment - Track sentiment, churn signals, engagement
 * Every client message is analyzed for:
 * - Sentiment (positive|neutral|negative|frustrated|urgent)
 * - Churn risk signals (pause, payment, cancellation)
 * - Engagement indicators (disengagement, frustration, confusion)
 * - Confidence scoring (low|mid|high)
 */
export const customer_sentiment = sqliteTable(
  'customer_sentiment',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id').notNull().references(() => clients.channel_id),
    message_id: text('message_id').notNull().unique(),

    // Sentiment Analysis
    sentiment_type: text('sentiment_type').notNull(),
    sentiment_score: real('sentiment_score'),

    // Issue Signals
    is_complaint: integer('is_complaint').default(0),
    is_issue_report: integer('is_issue_report').default(0),
    is_feedback: integer('is_feedback').default(0),

    // Churn Risk Signals
    is_pause_request: integer('is_pause_request').default(0),
    is_payment_issue: integer('is_payment_issue').default(0),
    is_cancellation_signal: integer('is_cancellation_signal').default(0),

    // Engagement Signals
    is_disengagement: integer('is_disengagement').default(0),
    is_frustration: integer('is_frustration').default(0),
    is_confusion: integer('is_confusion').default(0),

    // Engagement & Actions
    engagement_level: text('engagement_level'),
    message_content: text('message_content').notNull(),
    ai_summary: text('ai_summary'),
    keywords: text('keywords'),
    requires_immediate_action: integer('requires_immediate_action').default(0),
    suggested_action: text('suggested_action'),
    ai_analysis_raw: text('ai_analysis_raw'),

    // Author info
    author_id: text('author_id'),
    author_username: text('author_username'),
    message_timestamp: integer('message_timestamp').notNull(),
    discord_msg_link: text('discord_msg_link'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    confidence_level: text('confidence_level').default('mid'),
  },
  (table) => ({
    channel_idx: index('idx_sentiment_channel').on(table.channel_id),
    type_idx: index('idx_sentiment_type').on(table.sentiment_type),
    churn_signals_idx: index('idx_sentiment_churn_signals').on(table.is_pause_request, table.is_payment_issue, table.is_cancellation_signal),
    timestamp_idx: index('idx_sentiment_timestamp').on(table.message_timestamp),
    engagement_idx: index('idx_sentiment_engagement').on(table.engagement_level),
    channel_timestamp_idx: index('sentiment_channel_timestamp_idx').on(table.channel_id, table.message_timestamp),
    type_timestamp_idx: index('sentiment_type_timestamp_idx').on(table.sentiment_type, table.message_timestamp),
    churn_signals_composite_idx: index('sentiment_churn_signals_idx').on(table.channel_id, table.is_pause_request, table.is_payment_issue, table.is_cancellation_signal, table.message_timestamp),
    channel_complaint_idx: index('idx_sentiment_channel_complaint').on(table.channel_id, table.is_complaint),
  })
);

/**
 * CSM Response Analytics - Track team member response quality
 * Context7 Best Practices: effectiveness_detail, customer_first_language, confidence_level
 */
export const csm_response_analytics = sqliteTable(
  'csm_response_analytics',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id').notNull().references(() => clients.channel_id),
    query_id: integer('query_id').references(() => questions.id),
    sentiment_message_id: integer('sentiment_message_id').references(() => customer_sentiment.id), // Link to sentiment analysis

    // Timestamps
    query_timestamp: integer('query_timestamp').notNull(),
    response_timestamp: integer('response_timestamp'),
    response_time_seconds: integer('response_time_seconds'),
    resolution_time_seconds: integer('resolution_time_seconds'),

    // Responder info
    responder_user_id: text('responder_user_id'),
    responder_username: text('responder_username'),

    // Quality Scoring
    response_usefulness: text('response_usefulness'),
    response_professionalism: text('response_professionalism'),
    response_clarity: real('response_clarity'),

    // Loom tracking
    contains_loom_link: integer('contains_loom_link').default(0),
    loom_url: text('loom_url'),
    loom_effectiveness: text('loom_effectiveness'),

    // Context7 Best Practices Fields
    effectiveness_detail: text('effectiveness_detail'),
    effectiveness_level: text('effectiveness_level').default('relevant'),
    customer_first_language: text('customer_first_language').default('transactional'),
    five_star_rating: text('five_star_rating'),
    confidence_statement: text('confidence_statement'),
    confidence_level: text('confidence_level').default('mid'),

    // Overall quality
    overall_quality_score: real('overall_quality_score'),
    ai_assessment_raw: text('ai_assessment_raw'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    channel_id_idx: index('idx_csm_response_channel').on(table.channel_id),
    query_id_idx: index('csm_query_id_idx').on(table.query_id),
    response_time_idx: index('csm_response_time_idx').on(table.response_time_seconds),
    responder_idx: index('idx_csm_response_responder').on(table.responder_user_id),
    quality_score_idx: index('csm_quality_score_idx').on(table.overall_quality_score),
    confidence_level_idx: index('csm_confidence_level_idx').on(table.confidence_level),
    created_at_idx: index('idx_csm_response_timestamp').on(table.query_timestamp),

    // Production optimization indexes
    channel_time_idx: index('csm_channel_time_idx').on(table.channel_id, table.query_timestamp),
    responder_time_idx: index('csm_responder_time_idx').on(table.responder_user_id, table.query_timestamp),
    quality_time_idx: index('csm_quality_time_idx').on(table.overall_quality_score, table.query_timestamp),
  })
);

/**
 * Top Issues - Repeated questions/bugs tracked for training
 * Renamed from repeated_requests for clarity
 */
export const top_issues = sqliteTable(
  'top_issues',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    topic_category: text('topic_category').notNull(),
    topic_keywords: text('topic_keywords'),
    topic_embedding: blob('topic_embedding'),
    canonical_question: text('canonical_question').notNull(),
    sample_questions: text('sample_questions'),

    // Tracking
    occurrence_count: integer('occurrence_count').default(1),
    first_seen_at: integer('first_seen_at').default(sql`(unixepoch())`).notNull(),
    last_seen_at: integer('last_seen_at').default(sql`(unixepoch())`).notNull(),
    affected_channels: text('affected_channels'),
    unique_clients_count: integer('unique_clients_count').default(1),

    // Training & Resolution
    training_material_exists: integer('training_material_exists').default(0),
    training_recommendation: text('training_recommendation'),
    priority: text('priority').default('medium'),
    is_addressed: integer('is_addressed').default(0),
    addressed_at: integer('addressed_at'),
    addressed_notes: text('addressed_notes'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    topic_category_idx: index('idx_top_issues_category').on(table.topic_category),
    occurrence_count_idx: index('idx_top_issues_count').on(table.occurrence_count),
    priority_idx: index('idx_top_issues_priority').on(table.priority),
    is_addressed_idx: index('idx_top_issues_unaddressed').on(table.is_addressed),
    priority_count_idx: index('issues_priority_count_idx').on(table.priority, table.occurrence_count, table.last_seen_at),
  })
);

/**
 * Top Issues Comparison Job - Instance tracking for repeated requests
 * Renamed from repeated_request_instances
 * Links individual messages to repeated issue categories
 */
export const topissuescomparison_job = sqliteTable(
  'topissuescomparison-job',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    issue_id: integer('issue_id')
      .notNull()
      .references(() => top_issues.id),
    channel_id: text('channel_id')
      .notNull()
      .references(() => clients.channel_id),
    question_id: integer('question_id').references(() => questions.id),
    message_id: text('message_id').notNull(),
    message_content: text('message_content').notNull(),
    similarity_score: real('similarity_score'),
    message_timestamp: integer('message_timestamp').notNull(),
    discord_msg_link: text('discord_msg_link'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    issue_id_idx: index('idx_topissuescomparison_issue').on(table.issue_id),
    channel_id_idx: index('idx_topissuescomparison_channel').on(table.channel_id),
    message_timestamp_idx: index('job_message_timestamp_idx').on(table.message_timestamp),
    question_id_idx: index('idx_topissuescomparison_question').on(table.question_id),
    message_id_idx: index('idx_topissuescomparison_message').on(table.message_id),
  })
);

/**
 * Looms - Track Loom video links sent by team
 * Renamed from loom_tracking
 * Links to questions and issues they help resolve
 */
export const looms = sqliteTable(
  'looms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id')
      .notNull()
      .references(() => clients.channel_id),
    message_id: text('message_id').notNull(),
    loom_url: text('loom_url').notNull(),
    loom_id: text('loom_id'),
    query_context: text('query_context'),
    question_id: integer('question_id').references(() => questions.id),
    issue_id: integer('issue_id').references(() => top_issues.id),

    // Sender info
    sender_user_id: text('sender_user_id').notNull(),
    sender_username: text('sender_username'),

    // Effectiveness tracking
    client_response_after: text('client_response_after'),
    was_helpful: integer('was_helpful'),
    client_followup_questions: integer('client_followup_questions').default(0),

    // Timestamps
    sent_at: integer('sent_at').notNull(),
    client_acknowledged_at: integer('client_acknowledged_at'),
    discord_msg_link: text('discord_msg_link'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    channel_id_idx: index('idx_looms_channel').on(table.channel_id),
    question_id_idx: index('idx_looms_question').on(table.question_id),
    sender_idx: index('idx_looms_sender').on(table.sender_user_id),
    timestamp_idx: index('idx_looms_timestamp').on(table.sent_at),
    channel_time_idx: index('looms_channel_time_idx').on(table.channel_id, table.created_at),
  })
);

/**
 * Outbound Links - Non-Loom URLs tracked from team responses
 * Links referenced in team messages, categorized and tracked
 */
export const outbound_links = sqliteTable(
  'outbound_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id')
      .notNull()
      .references(() => clients.channel_id),
    message_id: text('message_id').notNull(),
    url: text('url').notNull(),
    link_type: text('link_type'),
    is_internal: integer('is_internal').default(0),
    question_id: integer('question_id').references(() => questions.id),
    issue_id: integer('issue_id').references(() => top_issues.id),

    // Sender info
    sender_user_id: text('sender_user_id'),
    sender_username: text('sender_username'),

    // Context & Effectiveness
    context: text('context'),
    was_clicked: integer('was_clicked').default(0),
    client_response_after: text('client_response_after'),

    // Discord reference
    discord_msg_link: text('discord_msg_link'),

    // Audit trail
    extracted_at: integer('extracted_at').default(sql`(unixepoch())`).notNull(),
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    channel_id_idx: index('idx_outbound_channel').on(table.channel_id),
    question_id_idx: index('idx_outbound_question').on(table.question_id),
    issue_id_idx: index('idx_outbound_issue').on(table.issue_id),
    url_idx: index('idx_outbound_url').on(table.url),
    sender_idx: index('idx_outbound_sender').on(table.sender_user_id),
    timestamp_idx: index('idx_outbound_timestamp').on(table.extracted_at),
    channel_type_time_idx: index('links_channel_type_time_idx').on(table.channel_id, table.link_type, table.created_at),
  })
);

/**
 * Daily Analytics Summary - Aggregated metrics for dashboard
 * Rolled up daily for performance and historical tracking
 */
export const daily_analytics_summary = sqliteTable(
  'daily_analytics_summary',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    channel_id: text('channel_id').notNull().references(() => clients.channel_id),
    date: text('date').notNull(), // YYYY-MM-DD format

    // Message counts
    total_client_messages: integer('total_client_messages').default(0),
    total_team_messages: integer('total_team_messages').default(0),

    // Query metrics
    total_queries: integer('total_queries').default(0),
    queries_resolved: integer('queries_resolved').default(0),

    // Response time metrics
    avg_response_time_seconds: integer('avg_response_time_seconds'),
    min_response_time_seconds: integer('min_response_time_seconds'),
    max_response_time_seconds: integer('max_response_time_seconds'),
    avg_resolution_time_seconds: integer('avg_resolution_time_seconds'),

    // Quality metrics
    avg_usefulness_score: real('avg_usefulness_score'),
    avg_professionalism_score: real('avg_professionalism_score'),
    avg_clarity_score: real('avg_clarity_score'),
    avg_overall_quality: real('avg_overall_quality'),

    // Loom metrics
    looms_sent: integer('looms_sent').default(0),
    looms_effective: integer('looms_effective').default(0),

    // Sentiment distribution
    positive_messages: integer('positive_messages').default(0),
    neutral_messages: integer('neutral_messages').default(0),
    negative_messages: integer('negative_messages').default(0),
    frustrated_messages: integer('frustrated_messages').default(0),

    // Risk metrics
    churn_signals_count: integer('churn_signals_count').default(0),
    complaints_count: integer('complaints_count').default(0),
    engagement_score: real('engagement_score'),

    // Audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    date_idx: index('idx_daily_summary_date').on(table.date),
    channel_id_idx: index('summary_channel_id_idx').on(table.channel_id),
    channel_date_idx: index('idx_daily_summary_channel_date').on(table.channel_id, table.date),
    date_channel_idx: index('summary_date_channel_idx').on(table.date, table.channel_id),
    unique_channel_date: unique('unique_daily_summary_channel_date').on(table.channel_id, table.date),
  })
);

/**
 * Bug Reports - User submitted bug reports from frontend
 */
export const bug_reports = sqliteTable(
  'bug_reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clerk_id: text('clerk_id'),

    // Form data
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    bug_occurred_at: integer('bug_occurred_at'),
    timezone: text('timezone'),
    user_agent: text('user_agent'),
    has_screenshot: integer('has_screenshot').default(0),

    // Status tracking
    status: text('status').default('open'),
    severity: text('severity').default('medium'),

    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    status_idx: index('idx_bug_status').on(table.status),
    created_at_idx: index('idx_bug_created_at').on(table.created_at),
  })
);

/**
 * Bug Comments - Follow-up comments on bug reports
 */
export const bug_comments = sqliteTable(
  'bug_comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bug_report_id: integer('bug_report_id').notNull().references(() => bug_reports.id, { onDelete: 'cascade' }),
    clerk_id: text('clerk_id'),
    comment_text: text('comment_text').notNull(),
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    bug_report_id_idx: index('idx_bug_comment_report_id').on(table.bug_report_id),
  })
);

/**
 * Feature Requests - User submitted feature requests from frontend
 */
export const feature_requests = sqliteTable(
  'feature_requests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clerk_id: text('clerk_id'),

    // Form data
    title: text('title').notNull(),
    description: text('description').notNull(),
    use_case: text('use_case').notNull(),
    priority: text('priority').default('medium'),

    // Status tracking
    status: text('status').default('submitted'),

    // Voting
    upvotes: integer('upvotes').default(0),
    downvotes: integer('downvotes').default(0),

    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    status_idx: index('idx_feature_status').on(table.status),
    priority_idx: index('idx_feature_priority').on(table.priority),
    created_at_idx: index('idx_feature_created_at').on(table.created_at),
  })
);

// ============================================================================
// RELATIONS (for querying convenience)
// ============================================================================

export const clientsRelations = relations(clients, ({ many }) => ({
  questions: many(questions),
  sentiments: many(customer_sentiment),
  responses: many(csm_response_analytics),
  risks: many(risk_radar),
  looms: many(looms),
  outbound_links: many(outbound_links),
  summaries: many(daily_analytics_summary),
  kb_documents: many(kb_documents),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  client: one(clients, { fields: [questions.channel_id], references: [clients.channel_id] }),
  responses: many(csm_response_analytics),
  looms: many(looms),
  outbound_links: many(outbound_links),
  issue_instances: many(topissuescomparison_job),
}));

export const csmResponseRelations = relations(csm_response_analytics, ({ one }) => ({
  client: one(clients, { fields: [csm_response_analytics.channel_id], references: [clients.channel_id] }),
  question: one(questions, { fields: [csm_response_analytics.query_id], references: [questions.id] }),
  sentiment: one(customer_sentiment, { fields: [csm_response_analytics.sentiment_message_id], references: [customer_sentiment.id] }),
}));

export const customerSentimentRelations = relations(customer_sentiment, ({ one, many }) => ({
  client: one(clients, { fields: [customer_sentiment.channel_id], references: [clients.channel_id] }),
  responses: many(csm_response_analytics),
}));

export const riskRadarRelations = relations(risk_radar, ({ one }) => ({
  client: one(clients, { fields: [risk_radar.channel_id], references: [clients.channel_id] }),
}));

export const dailyAnalyticsSummaryRelations = relations(daily_analytics_summary, ({ one }) => ({
  client: one(clients, { fields: [daily_analytics_summary.channel_id], references: [clients.channel_id] }),
}));

export const topIssuesRelations = relations(top_issues, ({ many }) => ({
  instances: many(topissuescomparison_job),
  looms: many(looms),
  outbound_links: many(outbound_links),
}));

export const topIssuesComparisonRelations = relations(topissuescomparison_job, ({ one }) => ({
  issue: one(top_issues, { fields: [topissuescomparison_job.issue_id], references: [top_issues.id] }),
  client: one(clients, { fields: [topissuescomparison_job.channel_id], references: [clients.channel_id] }),
  question: one(questions, { fields: [topissuescomparison_job.question_id], references: [questions.id] }),
}));

export const loomRelations = relations(looms, ({ one }) => ({
  client: one(clients, { fields: [looms.channel_id], references: [clients.channel_id] }),
  question: one(questions, { fields: [looms.question_id], references: [questions.id] }),
  issue: one(top_issues, { fields: [looms.issue_id], references: [top_issues.id] }),
}));

export const outboundLinkRelations = relations(outbound_links, ({ one }) => ({
  client: one(clients, { fields: [outbound_links.channel_id], references: [clients.channel_id] }),
  question: one(questions, { fields: [outbound_links.question_id], references: [questions.id] }),
  issue: one(top_issues, { fields: [outbound_links.issue_id], references: [top_issues.id] }),
}));

export const kbDocumentRelations = relations(kb_documents, ({ one, many }) => ({
  client: one(clients, { fields: [kb_documents.channel_id], references: [clients.channel_id] }),
  chunks: many(kb_chunks),
}));

export const kbChunkRelations = relations(kb_chunks, ({ one }) => ({
  document: one(kb_documents, { fields: [kb_chunks.doc_id], references: [kb_documents.doc_id] }),
}));

export const supportTicketRelations = relations(support_tickets, ({ one, many }) => ({
  agent: one(support_agents, { fields: [support_tickets.assigned_agent_id], references: [support_agents.id] }),
  messages: many(support_messages),
}));

export const supportMessageRelations = relations(support_messages, ({ one }) => ({
  ticket: one(support_tickets, { fields: [support_messages.ticket_id], references: [support_tickets.id] }),
}));

/**
 * Whop Support Channels - Full metadata from Whop API
 * Stores complete channel information as returned from Whop
 */
export const whop_support_channels = sqliteTable(
  'whop_support_channels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    whop_channel_id: text('whop_channel_id').notNull().unique(),
    company_id: text('company_id'),

    // Customer info
    customer_user_id: text('customer_user_id').notNull(),
    customer_name: text('customer_name'),
    customer_username: text('customer_username'),

    // Channel metadata
    custom_name: text('custom_name'),
    status: text('status').default('open'), // open|resolved

    // Timestamps from Whop
    last_message_at: text('last_message_at'),
    resolved_at: text('resolved_at'),

    // Tracking
    message_count: integer('message_count').default(0),
    last_synced_at: integer('last_synced_at'),
    messages_synced: integer('messages_synced').default(0),

    // Raw Whop response (backup)
    raw_data: text('raw_data'), // JSON - full channel response from Whop

    // Local audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    whop_channel_id_idx: index('idx_whop_channel_id_unique').on(table.whop_channel_id),
    customer_user_id_idx: index('idx_whop_channel_customer').on(table.customer_user_id),
    status_idx: index('idx_whop_channel_status').on(table.status),
    last_synced_idx: index('idx_whop_last_synced').on(table.last_synced_at),
  })
);

/**
 * Whop Support Messages - Complete message data from Whop API
 * Stores all message fields as returned from Whop without modifications
 */
export const whop_support_messages = sqliteTable(
  'whop_support_messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    whop_message_id: text('whop_message_id').notNull().unique(),
    whop_channel_id: text('whop_channel_id').notNull(),

    // User info
    user_id: text('user_id').notNull(),
    user_name: text('user_name'),
    user_username: text('user_username'),
    user_profile_picture_url: text('user_profile_picture_url'),

    // Message content
    content: text('content').notNull(),
    rich_content: text('rich_content'),

    // Message metadata
    is_edited: integer('is_edited').default(0),
    is_pinned: integer('is_pinned').default(0),
    message_type: text('message_type').default('regular'), // regular|automated|system
    view_count: integer('view_count').default(0),

    // Relationships & mentions
    replying_to_message_id: text('replying_to_message_id'),
    is_everyone_mentioned: integer('is_everyone_mentioned').default(0),
    mentioned_user_ids: text('mentioned_user_ids'), // JSON array

    // Attachments
    attachments: text('attachments'), // JSON array [{id, contentType, sourceUrl}]

    // Reactions & polls
    reaction_counts: text('reaction_counts'), // JSON array [{emoji, count}]
    poll_data: text('poll_data'), // JSON {options: [...], votes: [...]}

    // Timestamps from Whop
    whop_created_at: text('whop_created_at'),
    whop_updated_at: text('whop_updated_at'),

    // Discord sync
    synced_to_discord: integer('synced_to_discord').default(0),
    discord_message_id: text('discord_message_id'),

    // Raw Whop response (backup)
    raw_data: text('raw_data'), // JSON - full message response from Whop

    // Local audit trail
    created_at: integer('created_at').default(sql`(unixepoch())`).notNull(),
    updated_at: integer('updated_at').default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    whop_channel_id_idx: index('idx_whop_channel_id').on(table.whop_channel_id),
    user_id_idx: index('idx_whop_user_id').on(table.user_id),
    whop_created_at_idx: index('idx_whop_created_at').on(table.whop_created_at),
    whop_message_id_idx: index('idx_whop_message_id').on(table.whop_message_id),
    synced_to_discord_idx: index('idx_whop_synced_discord').on(table.synced_to_discord),
    channel_created_idx: index('idx_whop_channel_created').on(table.whop_channel_id, table.whop_created_at),
  })
);

export const bugReportRelations = relations(bug_reports, ({ many }) => ({
  comments: many(bug_comments),
}));

export const bugCommentRelations = relations(bug_comments, ({ one }) => ({
  bugReport: one(bug_reports, { fields: [bug_comments.bug_report_id], references: [bug_reports.id] }),
}));

export const whopSupportMessageRelations = relations(whop_support_messages, ({ one }) => ({
  channel: one(whop_support_channels, { fields: [whop_support_messages.whop_channel_id], references: [whop_support_channels.whop_channel_id] }),
}));

export const whopSupportChannelRelations = relations(whop_support_channels, ({ many }) => ({
  messages: many(whop_support_messages),
}));

