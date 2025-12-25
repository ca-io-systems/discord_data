/**
 * CAIO Client Intelligence Platform - Discord Bot (LIVE LISTENER)
 * 
 * Listens for incoming messages in Discord channels in real-time and stores data in Turso database.
 * Processes messages as they arrive instead of fetching historical data.
 * 
 * TABLES ENRICHED:
 * - clients: Channel metadata (name, client name, active status)
 * - questions: Client questions/bugs requiring team action
 * - csm_response_analytics: Team response quality and effectiveness metrics
 * - looms: Loom video link tracking and effectiveness
 * - outbound_links: Non-Loom resource links extracted from messages
 * - topissuescomparison_job: Current message-to-issue pattern matching
 * - customer_sentiment: Real-time sentiment analysis and churn signal detection
 * - risk_radar: Live inactivity tracking, churn risk scoring
 * - daily_analytics_summary: Real-time daily metrics aggregation
 * 
 * TABLES NOT ENRICHED (Historical backfill via index-historical-fetcher.ts):
 * - top_issues: Batch-processed repeated issue analysis (run as separate job)
 * 
 * Implements all requirements from the PRD:
 * - FR-01: Channel filtering (gca-, gci-, and gcp- only)
 * - FR-02: Noise filtering (bots, self, short messages)
 * - FR-03: AI triage (Question/Bug/General Chat, High/Normal urgency)
 * - FR-04: Deep linking (Discord message URLs)
 * - FR-05: Inactivity tracking
 * - FR-06: Risk scoring
 * 
 * Configuration:
 * - DEBUG: Enable debug logging (default: false)
 * - CONSOLE_ONLY: Safe testing mode without database writes (default: false)
 * - TEAM_MEMBER_IDS: Comma-separated list of Discord user IDs for team members
 * 
 * HOW TO RUN:
 * 
 * 1. PRODUCTION MODE (with database writes):
 *    $ npm start
 *    or
 *    $ npx tsx index-live-listener.ts
 *    Listens for Discord messages and stores all data to database
 * 
 * 2. TESTING MODE (console only, no database writes):
 *    Enable CONSOLE_ONLY mode by editing CONFIG.CONSOLE_ONLY = true
 *    Shows all actions that would happen without modifying the database
 *    Perfect for testing before going live
 * 
 * 3. DEBUG MODE (verbose logging):
 *    $ DEBUG=true npx tsx index-live-listener.ts
 *    Enables detailed logging of all AI analysis and database operations
 * 
 * 4. CUSTOM TEAM MEMBERS:
 *    $ TEAM_MEMBER_IDS="12345,67890,11111" npx tsx index-live-listener.ts
 *    Sets which Discord users are recognized as team members
 * 
 * Environment Variables:
 * - DISCORD_BOT_TOKEN: Discord bot token (required)
 * - OPENAI_API_KEY: OpenAI API key for o3-mini (required)
 * - DEBUG: Enable debug logging (default: false)
 * - TEAM_MEMBER_IDS: Comma-separated Discord user IDs of team members
 * - TURSO_DATABASE_URL: Turso database URL (required)
 * - TURSO_AUTH_TOKEN: Turso authentication token (required)
 * 
 * WORKFLOW:
 * 1. Run index-historical-fetcher.ts ONCE to backfill database (2+ months of history)
 * 2. Run index-live-listener.ts to monitor new messages in real-time
 * 3. Both scripts enrich database with AI analysis (sentiment, quality, risk)
 * 4. Frontend queries database to display dashboards and metrics
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Message, TextChannel } from 'discord.js';
import { LibsqlError } from '@libsql/client';
import OpenAI from 'openai';
import { eq, and, gte, like, sql, desc } from 'drizzle-orm';

// Drizzle DB and Schema
import { db, tursoClient } from './db';
import { clients, questions } from './db/schema';

// Analytics module for CSM feedback, sentiment, and repeated requests
import { Analytics } from './lib/analytics';

// URL extraction module for tracking non-Loom links
import { URLExtractor } from './lib/url-extractor';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'o3-mini',
    MIN_MESSAGE_LENGTH: parseInt(process.env.MIN_MESSAGE_LENGTH || '5'),
    DEBUG: process.env.DEBUG === 'true',
    CONSOLE_ONLY: false, // Toggle for safe testing
    // Team member Discord user IDs (comma-separated) - used to detect team replies
    TEAM_MEMBER_IDS: process.env.TEAM_MEMBER_IDS ? process.env.TEAM_MEMBER_IDS.split(',').map(id => id.trim()) : [],
};

// Validate required environment variables
const requiredVars = ['DISCORD_BOT_TOKEN', 'OPENAI_API_KEY'] as const;
for (const varName of requiredVars) {
    if (!CONFIG[varName]) {
        console.error(`❌ Missing required environment variable: ${varName}`);
        process.exit(1);
    }
}

// ============================================================================
// INITIALIZE CLIENTS
// ============================================================================

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const openaiClient = new OpenAI({
    apiKey: CONFIG.OPENAI_API_KEY,
    maxRetries: 2, // Default retry count for rate limits and connection errors
});

// Initialize Analytics module
const analytics = new Analytics(tursoClient, openaiClient, {
    openaiModel: CONFIG.OPENAI_MODEL,
    debug: CONFIG.DEBUG,
    consoleOnly: CONFIG.CONSOLE_ONLY
});

// Initialize URL Extractor module
const urlExtractor = new URLExtractor(tursoClient, {
    debug: CONFIG.DEBUG,
    consoleOnly: CONFIG.CONSOLE_ONLY
});

// Track processed messages to avoid duplicates
const processedMessageIds = new Set<string>();

// ============================================================================
// LOGGING
// ============================================================================

function log(level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARN', message: string, data: any = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    if (data && (CONFIG.DEBUG || level === 'ERROR')) {
        console.log(logMessage, JSON.stringify(data, null, 2));
    } else {
        console.log(logMessage);
    }
}

// ============================================================================
// DATABASE FUNCTIONS (DRIZZLE VERSION)
// ============================================================================

/**
 * Upsert client in database (FR-01)
 */
async function upsertClient(channelId: string, channelName: string, clientName: string) {
    if (CONFIG.CONSOLE_ONLY) {
        log('INFO', `[CONSOLE-ONLY] Would upsert client: ${clientName} (#${channelName})`);
        return;
    }

    try {
        await db.insert(clients).values({
            channel_id: channelId,
            channel_name: channelName,
            client_name: clientName,
            is_active: 1,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000),
        }).onConflictDoUpdate({
            target: clients.channel_id,
            set: {
                channel_name: channelName,
                client_name: clientName,
                updated_at: Math.floor(Date.now() / 1000),
            }
        });
    } catch (error: any) {
        log('ERROR', `Failed to upsert client: ${error.message}`);
    }
}

/**
 * Check if message already exists in database
 */
async function messageExistsInDatabase(messageId: string, channelId: string, content: string) {
    if (CONFIG.CONSOLE_ONLY) return false;

    try {
        const now = Math.floor(Date.now() / 1000);

        // 1. Check by message ID in link
        const byId = await db.select({ id: questions.id })
            .from(questions)
            .where(and(
                like(questions.discord_msg_link, `%/${messageId}`),
                eq(questions.channel_id, channelId)
            ))
            .limit(1);
        if (byId.length > 0) return true;

        // 2. Check by content in last hour (prevent double-posts)
        const byContent = await db.select({ id: questions.id })
            .from(questions)
            .where(and(
                eq(questions.channel_id, channelId),
                eq(questions.content, content),
                gte(questions.created_at, now - 3600)
            ))
            .limit(1);
        if (byContent.length > 0) return true;

        return false;
    } catch (error: any) {
        log('ERROR', `Failed to check message existence: ${error.message}`);
        return false;
    }
}

/**
 * Get all unresolved questions for a channel
 */
async function getUnresolvedQueries(channelId: string) {
    try {
        const results = await db.select()
            .from(questions)
            .where(and(
                eq(questions.channel_id, channelId),
                sql`${questions.status} IN ('open', 'pending')`
            ))
            .orderBy(desc(questions.created_at));

        return results.map(row => ({
            id: row.id,
            content: row.content,
            summary: row.ai_summary,
            type: row.type,
            urgency: row.urgency,
            createdAt: row.created_at,
            link: row.discord_msg_link,
        }));
    } catch (error: any) {
        log('ERROR', `Failed to get unresolved questions: ${error.message}`);
        return [];
    }
}

/**
 * Get recent message history from a Discord channel for context
 */
async function getRecentChannelMessages(channel: TextChannel, limit = 20) {
    try {
        const messages = await channel.messages.fetch({ limit });

        const messageHistory = [];
        for (const [id, msg] of messages) {
            if (msg.author.bot || msg.content.length < 3) continue;

            const authorType = isTeamMember(msg.author.id) ? '[TEAM]' : '[CLIENT]';
            messageHistory.push({
                author: `${authorType} ${msg.author.username}`,
                content: msg.content.substring(0, 300),
                timestamp: msg.createdAt.toISOString(),
            });

            if (messageHistory.length >= 15) break;
        }

        return messageHistory.reverse();
    } catch (error: any) {
        if (error.code === 50001) { // Missing Access
            log('WARN', 'Bot lacks permission to read message history');
        } else if (error.code === 50013) { // Missing Permissions
            log('WARN', 'Bot lacks required permissions for this channel');
        } else {
            log('WARN', `Failed to fetch channel message history: ${error.message}`);
        }
        return [];
    }
}

/**
 * Use AI to match team member reply to queries they are tending to
 * Returns array of query IDs that the team member is addressing (can be multiple)
 */
async function matchReplyToQuery(teamReply: string, queries: any[], channel: TextChannel | null = null) {
    if (queries.length === 0) return [];
    if (queries.length === 1) return [queries[0].id];

    const generalKeywords = ['all', 'everything', 'all of them', 'all issues', 'all queries',
        "i'll sort it all", "i'll handle everything", "all sorted",
        "all done", "all fixed", "all taken care of"];
    const replyLower = teamReply.toLowerCase();
    const isGeneralResponse = generalKeywords.some(keyword => replyLower.includes(keyword));

    if (isGeneralResponse) {
        log('DEBUG', 'General response detected - matching all queries');
        return queries.map(q => q.id);
    }

    try {
        let messageHistoryContext = '';
        if (channel) {
            const recentMessages = await getRecentChannelMessages(channel, 20);
            if (recentMessages.length > 0) {
                const historyText = recentMessages.map((msg, idx) =>
                    `${idx + 1}. ${msg.author}: ${msg.content}`
                ).join('\n');
                messageHistoryContext = `\n\nRecent Conversation History:\n${historyText}\n`;
            }
        }

        const queriesList = queries.map((q, idx) =>
            `Query ${idx + 1} (ID: ${q.id}): ${q.summary || q.content.substring(0, 100)}`
        ).join('\n');

        const completion = await openaiClient.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You are a query matching assistant. Determine which queries a team member's reply is tending to. 
                    
IMPORTANT: Be lenient. If a team member is tending to, addressing, or catering to a query (even loosely), mark it as matched.
If the reply is GENERAL or addresses ALL queries (e.g., "Yes I'll sort it all out", "All sorted", "Done"), return ALL query IDs.

Return ONLY a JSON array of matched query IDs.`,
                },
                {
                    role: 'user',
                    content: `Team member's reply: "${teamReply}"${messageHistoryContext}\n\nOpen queries:\n${queriesList}`,
                },
            ],
            max_completion_tokens: 500,
        });

        try {
            const content = completion.choices[0].message.content || '[]';
            const matchedIds = JSON.parse(content.replace(/```json|```/g, '').trim());
            return matchedIds;
        } catch (e) {
            return queries.map(q => q.id);
        }
    } catch (error: any) {
        log('ERROR', `Failed to match reply: ${error.message}`);
        return queries.map(q => q.id);
    }
}

function isTeamMember(userId: string) {
    return CONFIG.TEAM_MEMBER_IDS.includes(userId);
}

/**
 * Insert question in database
 */
async function insertQuestion(channelId: string, message: Message, aiTriage: any) {
    const timestamp = Math.floor(Date.now() / 1000);
    const discordLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;

    const questionData = {
        channel_id: channelId,
        content: message.content,
        type: aiTriage.type,
        urgency: aiTriage.urgency,
        priority: aiTriage.priority || (aiTriage.urgency === 'High' ? 'High' : 'Medium'),
        ai_summary: aiTriage.summary,
        discord_msg_link: discordLink,
        status: 'open',
        created_at: timestamp,
        updated_at: timestamp,
    };

    if (CONFIG.CONSOLE_ONLY) {
        log('INFO', `[CONSOLE-ONLY] Would insert question into questions table:\n${JSON.stringify(questionData, null, 2)}`);
        log('INFO', `📋 QUESTION BOARD UPDATE:\n{
  "action": "insert_question",
  "table": "questions",
  "data": ${JSON.stringify(questionData, null, 2)},
  "discord_link": "${discordLink}",
  "client": "${message.author.username}",
  "channel": "${channelId}"
}`);
        return null;
    }

    try {
        const result = await db.insert(questions).values(questionData).returning({ id: questions.id });

        if (result[0]?.id) {
            log('INFO', `📋 QUESTION BOARD UPDATE:\n{
  "action": "insert_question",
  "table": "questions",
  "question_id": ${result[0].id},
  "data": ${JSON.stringify(questionData, null, 2)},
  "discord_link": "${discordLink}",
  "client": "${message.author.username}",
  "channel": "${channelId}"
}`);
        }

        return result[0]?.id;
    } catch (error: any) {
        log('ERROR', `Failed to insert question: ${error.message}`);
        return null;
    }
}

/**
 * Mark queries as resolved
 */
async function resolveQueries(queryIds: number[], resolverId: string, resolverName: string) {
    const timestamp = Math.floor(Date.now() / 1000);

    const updateData = {
        status: 'resolved',
        resolved_by_id: resolverId,
        resolved_at: timestamp,
        updated_at: timestamp,
    };

    if (CONFIG.CONSOLE_ONLY) {
        log('INFO', `[CONSOLE-ONLY] Would resolve ${queryIds.length} queries:\n{
  "action": "resolve_questions",
  "table": "questions",
  "query_ids": [${queryIds.join(', ')}],
  "update_data": ${JSON.stringify(updateData, null, 2)},
  "resolved_by": "${resolverName}" (${resolverId})
}`);
        return;
    }

    try {
        await db.update(questions)
            .set(updateData)
            .where(sql`${questions.id} IN (${queryIds.join(',')})`);

        log('INFO', `✅ QUESTION BOARD RESOLUTION:\n{
  "action": "resolve_questions",
  "table": "questions",
  "query_ids": [${queryIds.join(', ')}],
  "update_data": ${JSON.stringify(updateData, null, 2)},
  "resolved_by": "${resolverName}" (${resolverId})
}`);
    } catch (error: any) {
        log('ERROR', `Failed to resolve queries: ${error.message}`);
    }
}

/**
 * Process a message with AI triage
 */
async function processMessageWithAI(message: Message, channel: TextChannel) {
    try {
        const recentMessages = await getRecentChannelMessages(channel, 5);
        let contextStr = '';
        if (recentMessages.length > 0) {
            contextStr = `\nRecent context:\n${recentMessages.map(m => `${m.author}: ${m.content}`).join('\n')}`;
        }

        const completion = await openaiClient.chat.completions.create({
            model: CONFIG.OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Classify messages into Question, Bug, or General. Rate urgency as High or Normal. Rate priority as Critical, High, Medium, or Low. Respond with JSON: {"type":"Question|Bug|General", "urgency":"High|Normal", "priority":"Critical|High|Medium|Low", "summary":"..."}`,
                },
                {
                    role: 'user',
                    content: `Classify: "${message.content}"${contextStr}`,
                },
            ],
            max_completion_tokens: 500,
        });

        try {
            return JSON.parse(completion.choices[0].message.content || '{}');
        } catch (e) {
            return { type: 'General', urgency: 'Normal', priority: 'Low', summary: message.content.substring(0, 100) };
        }
    } catch (error: any) {
        log('ERROR', `AI processing failed: ${error.message}`);
        return { type: 'General', urgency: 'Normal', priority: 'Low', summary: message.content.substring(0, 100) };
    }
}

/**
 * Show what would happen when team member matches unresolved queries in PRODUCTION MODE
 * This is a simulation for Console Only Mode to demonstrate query board updates
 */
function showQueryResolutionSimulation(matchedQueries: any[], teamMemberId: string, teamMemberName: string) {
    if (matchedQueries.length === 0) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const matchedQueryIds = matchedQueries.map(q => q.id);

    log('INFO', `\n${'='.repeat(80)}`);
    log('INFO', `📊 [PRODUCTION MODE SIMULATION] QUERY BOARD RESOLUTION`);
    log('INFO', `${'='.repeat(80)}`);
    log('INFO', `🔄 BEFORE: Queries in "open" status`);
    log('INFO', `${JSON.stringify(matchedQueries.map(q => ({
        id: q.id,
        ai_summary: q.summary || q.content.substring(0, 80),
        type: q.type,
        urgency: q.urgency,
        status: 'open',
        created_at: q.createdAt
    })), null, 2)}`);

    log('INFO', `\n✅ AFTER: Queries updated to "resolved" status`);
    log('INFO', `${JSON.stringify(matchedQueries.map(q => ({
        id: q.id,
        ai_summary: q.summary || q.content.substring(0, 80),
        type: q.type,
        urgency: q.urgency,
        status: 'resolved',
        resolved_by_id: teamMemberId,
        resolved_by_name: teamMemberName,
        resolved_at: timestamp,
        created_at: q.createdAt,
        updated_at: timestamp
    })), null, 2)}`);

    log('INFO', `\n📋 TABLE UPDATE: questions`);
    log('INFO', `UPDATE questions SET status='resolved', resolved_by_id='${teamMemberId}', resolved_at=${timestamp}, updated_at=${timestamp} WHERE id IN (${matchedQueryIds.join(', ')})`);
    log('INFO', `${'='.repeat(80)}\n`);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

discordClient.once(Events.ClientReady, readyClient => {
    log('INFO', `\n${'='.repeat(80)}`);
    log('INFO', `✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
    log('INFO', `🎧 Listening for messages in real-time...`);
    if (CONFIG.CONSOLE_ONLY) {
        log('INFO', `🚫 DATABASE SAVING IS DISABLED (Console Only Mode)`);
    } else {
        log('INFO', `💾 DATABASE SAVING IS ENABLED (Production Mode)`);
    }
    log('INFO', `📝 Watching servers: ClientAcquisition.io`);
    log('INFO', `📝 Channels: gca-*, gci-*, gcp-*`);
    log('INFO', `${'='.repeat(80)}\n`);
});

discordClient.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const allowedServers = ["ClientAcquisition.io"];
    if (!allowedServers.includes(message.guild.name)) return;

    const channelName = (message.channel as TextChannel).name.toLowerCase();
    if (!['gca-', 'gci-', 'gcp-'].some(p => channelName.startsWith(p))) return;

    if (message.content.length < CONFIG.MIN_MESSAGE_LENGTH) return;
    if (processedMessageIds.has(message.id)) return;
    processedMessageIds.add(message.id);

    try {
        const channelId = message.channelId;
        const clientName = channelName.split('-')[1] || 'unknown';

        log('INFO', `📬 New message from ${message.author.username} in #${channelName}`);

        // 1. Handle Team Member Replies
        if (isTeamMember(message.author.id)) {
            log('INFO', `👥 Team member reply detected from ${message.author.username}`);
            log('INFO', `💬 Response content: "${message.content.substring(0, 150)}${message.content.length > 150 ? '...' : ''}"`);

            const unresolved = await getUnresolvedQueries(channelId);

            if (unresolved.length > 0) {
                log('INFO', `📋 Found ${unresolved.length} unresolved queries in ${channelName}:\n${JSON.stringify(unresolved.map(q => ({
                    id: q.id,
                    summary: q.summary || q.content.substring(0, 80),
                    type: q.type,
                    urgency: q.urgency,
                    status: 'open'
                })), null, 2)}`);
            } else {
                log('INFO', `📋 Found ${unresolved.length} unresolved queries in ${channelName}`);
            }

            // ALWAYS analyze response quality for training purposes
            const contextMessage = unresolved.length > 0 ? unresolved[0].content : `Previous discussion in #${channelName}`;
            const quality = await analytics.analyzeResponseQuality(message, contextMessage, channelId);

            if (quality) {
                log('INFO', `📊 RESPONSE QUALITY ANALYSIS:\n${JSON.stringify(quality, null, 2)}`);
            } else {
                log('WARN', `⚠️ Response quality analysis returned null for team member response in #${channelName}`);
            }

            if (unresolved.length > 0) {
                const matchedQueryIds = await matchReplyToQuery(message.content, unresolved, message.channel as TextChannel);

                if (matchedQueryIds.length > 0) {
                    log('INFO', `✅ Matched ${matchedQueryIds.length} queries`);

                    // Show details of matched queries
                    const matchedQueries = unresolved.filter(q => matchedQueryIds.includes(q.id));
                    log('INFO', `📋 MATCHED QUESTIONS:\n${JSON.stringify(matchedQueries.map(q => ({
                        id: q.id,
                        summary: q.summary || q.content.substring(0, 80),
                        status: 'open',
                        will_become: 'resolved'
                    })), null, 2)}`);

                    // Track response metrics for matched queries
                    const firstQuery = unresolved.find(q => q.id === matchedQueryIds[0]);
                    if (firstQuery) {
                        const responseMetrics = await analytics.trackCSMResponse(matchedQueryIds[0], firstQuery.createdAt, message, channelId, quality);

                        if (responseMetrics) {
                            log('INFO', `📊 CSM RESPONSE METRICS:\n${JSON.stringify(responseMetrics, null, 2)}`);
                        }
                    }

                    // Show simulation of query board updates (especially useful in Console Only Mode)
                    if (CONFIG.CONSOLE_ONLY) {
                        showQueryResolutionSimulation(matchedQueries, message.author.id, message.author.username);
                    }

                    // Resolve queries in DB
                    await resolveQueries(matchedQueryIds, message.author.id, message.author.username);
                } else {
                    log('WARN', `⚠️ No matching queries found - may be resolving general discussion`);
                }
            } else {
                log('WARN', `⚠️ No unresolved queries in this channel - team member is likely continuing conversation or helping with general discussion`);
            }

            // Track Loom links if present
            const loomResult = await analytics.trackLoomLink(message, channelId);
            if (loomResult) {
                log('INFO', `🎬 LOOM LINK TRACKED:\n${JSON.stringify(loomResult, null, 2)}`);
            }

            // Track other outbound links
            const urlResult = await urlExtractor.trackURLs(message, channelId);
            if (urlResult && urlResult.tracked > 0) {
                log('INFO', `🔗 URLS TRACKED:\n${JSON.stringify(urlResult, null, 2)}`);
            }

            return;
        }

        // 2. Handle Client Messages
        const exists = await messageExistsInDatabase(message.id, channelId, message.content);
        if (exists) return;

        await upsertClient(channelId, channelName, clientName);

        // Analyze sentiment (Context7 Best Practice)
        log('INFO', `🤖 Analyzing sentiment...`);
        const sentiment = await analytics.analyzeSentiment(message, channelId);
        if (sentiment) {
            log('INFO', `💭 SENTIMENT ANALYSIS:\n${JSON.stringify({
                type: sentiment.sentiment_type,
                score: sentiment.sentiment_score,
                engagement: sentiment.engagement_level,
                churn_signals: {
                    is_complaint: sentiment.is_complaint,
                    is_pause_request: sentiment.is_pause_request,
                    is_payment_issue: sentiment.is_payment_issue,
                    is_cancellation_signal: sentiment.is_cancellation_signal
                },
                confidence: sentiment.confidence_level
            }, null, 2)}`);
        }

        // Run AI triage
        log('INFO', `🤖 Running AI triage...`);
        const aiTriage = await processMessageWithAI(message, message.channel as TextChannel);
        log('INFO', `📝 AI TRIAGE RESULT:\n${JSON.stringify(aiTriage, null, 2)}`);

        // Insert question if it's a Question or Bug
        if (['Question', 'Bug'].includes(aiTriage.type)) {
            const questionId = await insertQuestion(channelId, message, aiTriage);

            // Track as repeated request
            const repeatedRequest = await analytics.trackRepeatedRequest(message, channelId, aiTriage, questionId);
            if (repeatedRequest) {
                log('INFO', `🔄 REPEATED REQUEST TRACKED:\n${JSON.stringify(repeatedRequest, null, 2)}`);
            }

            // Increment daily query count
            await analytics.incrementDailyMetric(channelId, 'total_queries', 1);
            log('INFO', `📊 Daily metric updated: +1 total_queries`);
        }

        // Increment daily message count
        await analytics.incrementDailyMetric(channelId, 'total_client_messages', 1);
        log('INFO', `📊 Daily metric updated: +1 total_client_messages`);

        // Update risk radar and daily summary
        await analytics.calculateRiskRadar(channelId);
        log('INFO', `⚠️ Risk radar calculated for ${channelId}`);

        await analytics.calculateDailySummary(channelId);
        log('INFO', `📈 Daily summary calculated for ${channelId}`);

    } catch (error: any) {
        log('ERROR', `Failed to process message: ${error.message}`);
    }
});

discordClient.on('error', error => log('ERROR', `Discord client error: ${error.message}`));

async function startup() {
    try {
        log('INFO', 'Testing database connection...');
        await db.run(sql`SELECT 1`);
        log('INFO', '✅ Database connection successful');
        await discordClient.login(CONFIG.DISCORD_BOT_TOKEN);
    } catch (error: any) {
        log('ERROR', `Startup failed: ${error.message}`);
        process.exit(1);
    }
}

startup();

process.on('SIGINT', async () => {
    log('INFO', '\n⏹️  Shutting down gracefully...');
    await discordClient.destroy();
    process.exit(0);
});
