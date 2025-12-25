/**
 * Drizzle ORM Database Client & Query Helpers
 * 
 * This module provides:
 * - Turso/libSQL client configured for Drizzle
 * - Type-safe query builders
 * - Audit trail support
 * - Migration management
 * 
 * Usage:
 * import { db, clients, questions } from './db';
 * const allClients = await db.select().from(clients);
 */

import { createClient } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

// ============================================================================
// DATABASE CLIENT INITIALIZATION
// ============================================================================

/**
 * Create Turso/libSQL client
 * Connects to remote Turso database or local SQLite
 */
function initializeTursoClient() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    throw new Error(
      'Missing required environment variables: TURSO_DATABASE_URL and/or TURSO_AUTH_TOKEN'
    );
  }

  return createClient({
    url: dbUrl,
    authToken: authToken,
  });
}

/**
 * Initialize Drizzle ORM with schema
 * Enables type-safe queries with full TypeScript support
 */
export const tursoClient = initializeTursoClient();
export const db: LibSQLDatabase<typeof schema> = drizzle(tursoClient, {
  schema,
  logger: process.env.DEBUG === 'true',
});

// ============================================================================
// EXPORT SCHEMA FOR TYPE SAFETY
// ============================================================================

export * from './schema';

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Get migration status
 * Useful for startup checks and deployment verification
 */
export async function getMigrationStatus() {
  try {
    // Check if migrations table exists
    const result = await tursoClient.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='__drizzle_migrations__'
    `);

    if (result.rows.length === 0) {
      return { status: 'not_initialized', applied: 0 };
    }

    // Count applied migrations
    const migrations = await tursoClient.execute(`
      SELECT COUNT(*) as count FROM __drizzle_migrations__
    `);

    return {
      status: 'initialized',
      applied: migrations.rows[0]?.count || 0,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify schema integrity
 * Checks that all expected tables exist
 */
export async function verifySchema() {
  const expectedTables = [
    'clients',
    'questions',
    'risk_radar',
    'customer_sentiment',
    'csm_response_analytics',
    'top_issues',
    'topissuescomparison-job',
    'looms',
    'outbound_links',
    'daily_analytics_summary',
    'bug_reports',
    'bug_comments',
    'feature_requests',
  ];

  try {
    const result = await tursoClient.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_%'
      ORDER BY name
    `);

    const existingTables = result.rows.map((row: any) => row.name);
    const missing = expectedTables.filter(t => !existingTables.includes(t));
    const extra = existingTables.filter(t => !expectedTables.includes(t));

    return {
      ok: missing.length === 0,
      total_expected: expectedTables.length,
      total_found: existingTables.length,
      missing,
      extra,
      tables: existingTables,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Close database connection gracefully
 */
export async function closeDb() {
  try {
    await tursoClient.close?.();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database:', error);
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR COMMON QUERIES
// ============================================================================

import { eq, desc, and, gte, lte, inArray } from 'drizzle-orm';

/**
 * Get active clients with health status
 */
export async function getActiveClientsWithHealth() {
  return db.query.clients.findMany({
    where: (clients, { eq }) => eq(clients.is_active, 1),
    with: {
      risks: {
        limit: 1,
        orderBy: (risks) => desc(risks.updated_at),
      },
    },
  });
}

/**
 * Get unresolved questions by urgency
 */
export async function getUnresolvedQuestionsByUrgency() {
  return db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.status, 'open'))
    .orderBy(desc(schema.questions.urgency), desc(schema.questions.created_at));
}

/**
 * Get high churn risk clients
 */
export async function getHighChurnRiskClients() {
  return db.query.clients.findMany({
    where: (clients, { inArray }) =>
      inArray(clients.churn_risk_level, ['medium', 'high']),
    with: {
      sentiments: {
        limit: 5,
        orderBy: (sentiment) => desc(sentiment.created_at),
      },
    },
  });
}

/**
 * Get top repeated issues
 */
export async function getTopRepeatedIssues(limit = 10) {
  return db
    .select()
    .from(schema.top_issues)
    .orderBy(desc(schema.top_issues.occurrence_count))
    .limit(limit);
}

/**
 * Get response metrics for time period
 */
export async function getResponseMetrics(
  channelId: string,
  fromDate: number,
  toDate: number
) {
  return db
    .select()
    .from(schema.csm_response_analytics)
    .where(
      and(
        eq(schema.csm_response_analytics.channel_id, channelId),
        gte(schema.csm_response_analytics.created_at, fromDate),
        lte(schema.csm_response_analytics.created_at, toDate)
      )
    )
    .orderBy(desc(schema.csm_response_analytics.created_at));
}

/**
 * Get sentiment trends for client
 */
export async function getSentimentTrends(
  channelId: string,
  limit = 30
) {
  return db
    .select()
    .from(schema.customer_sentiment)
    .where(eq(schema.customer_sentiment.channel_id, channelId))
    .orderBy(desc(schema.customer_sentiment.created_at))
    .limit(limit);
}

/**
 * Get all Loom links shared
 */
export async function getAllLoomLinks(channelId?: string) {
  let query = db.select().from(schema.looms);

  if (channelId) {
    query = query.where(eq(schema.looms.channel_id, channelId)) as any;
  }

  return query.orderBy(desc(schema.looms.created_at));
}

/**
 * Get all non-Loom outbound links
 */
export async function getAllOutboundLinks(channelId?: string, linkType?: string) {
  const filters: any[] = [];

  if (channelId) {
    filters.push(eq(schema.outbound_links.channel_id, channelId));
  }
  if (linkType) {
    filters.push(eq(schema.outbound_links.link_type, linkType));
  }

  if (filters.length === 0) {
    return db
      .select()
      .from(schema.outbound_links)
      .orderBy(desc(schema.outbound_links.created_at));
  }

  return db
    .select()
    .from(schema.outbound_links)
    .where(and(...(filters as any)))
    .orderBy(desc(schema.outbound_links.created_at));
}

// ============================================================================
// AUDIT TRAIL UTILITIES
// ============================================================================

/**
 * Get audit trail for a question
 * Shows all interactions, responses, and changes
 */
export async function getQuestionAuditTrail(questionId: number) {
  const question = await db.query.questions.findFirst({
    where: eq(schema.questions.id, questionId),
  });

  if (!question) {
    return null;
  }

  const responses = await db.query.csm_response_analytics.findMany({
    where: eq(schema.csm_response_analytics.query_id, questionId),
    orderBy: desc(schema.csm_response_analytics.created_at),
  });

  const looms = await db.query.looms.findMany({
    where: eq(schema.looms.question_id, questionId),
  });

  const links = await db.query.outbound_links.findMany({
    where: eq(schema.outbound_links.question_id, questionId),
  });

  return {
    question,
    responses,
    looms,
    links,
    timeline: [
      { type: 'question_created', timestamp: question.created_at, data: question },
      ...responses.map(r => ({ type: 'response', timestamp: r.created_at, data: r })),
      ...looms.map(l => ({ type: 'loom_shared', timestamp: l.created_at, data: l })),
      ...links.map(l => ({ type: 'link_shared', timestamp: l.created_at, data: l })),
    ].sort((a, b) => a.timestamp - b.timestamp),
  };
}

/**
 * Get client interaction history
 */
export async function getClientInteractionHistory(channelId: string, limit = 100) {
  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.channel_id, channelId))
    .orderBy(desc(schema.questions.created_at))
    .limit(limit);

  const sentiments = await db
    .select()
    .from(schema.customer_sentiment)
    .where(eq(schema.customer_sentiment.channel_id, channelId))
    .orderBy(desc(schema.customer_sentiment.created_at))
    .limit(limit);

  const responses = await db
    .select()
    .from(schema.csm_response_analytics)
    .where(eq(schema.csm_response_analytics.channel_id, channelId))
    .orderBy(desc(schema.csm_response_analytics.created_at))
    .limit(limit);

  return {
    channel_id: channelId,
    questions: questions.length,
    sentiments: sentiments.length,
    responses: responses.length,
    interactions: [
      ...questions.map(q => ({ type: 'question', timestamp: q.created_at, data: q })),
      ...sentiments.map(s => ({ type: 'sentiment', timestamp: s.created_at, data: s })),
      ...responses.map(r => ({ type: 'response', timestamp: r.created_at, data: r })),
    ].sort((a, b) => b.timestamp - a.timestamp),
  };
}

