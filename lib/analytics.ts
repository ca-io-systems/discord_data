/**
* Analytics Module for CAIO Discord Bot
* 
* Implements:
* - CSM Feedback Loop (response time, usefulness, professionalism, Loom effectiveness)
* - Customer Sentiment (issues, complaints, churn signals, engagement)
* - Repeated Requests Tracking (for training improvement)
* 
* @module analytics
*/

// ============================================================================
// IMPORTS
// ============================================================================

import OpenAI from 'openai';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const LOOM_URL_REGEX = /https?:\/\/(www\.)?(loom\.com\/share\/[a-zA-Z0-9]+|loom\.com\/embed\/[a-zA-Z0-9]+)/gi;

// ============================================================================
// AI CLASSIFICATION PROMPTS
// ============================================================================

/**
 * Prompt for analyzing customer sentiment and engagement signals
 * Context7 Best Practices Applied:
 * - Detailed role assignment for consistency
 * - Empathetic perspective (put yourself in customer's shoes)
 * - Clear confidence scoring criteria
 * - Actionable insights for CSM follow-up
 */
const SENTIMENT_ANALYSIS_PROMPT = `You are a Customer Success Manager analyzing customer sentiment and health signals.

Your role: Think like you're putting yourself in the customer's shoes. Are they happy? Frustrated? At risk?

READ THIS CUSTOMER MESSAGE AND ANALYZE THEIR TRUE SENTIMENT & SIGNALS:

1. SENTIMENT (How is the customer TRULY feeling?):
   - positive: Happy, satisfied, grateful, complimentary
   - neutral: Factual, informational, neither positive nor negative  
   - negative: Unhappy, dissatisfied, disappointed
   - frustrated: Showing annoyance, impatience, or exasperation
   - urgent: Time-sensitive crisis or critical concern

2. ISSUE SIGNALS (true/false - Do they mention problems?):
   - is_complaint: Direct complaint about your service/product
   - is_issue_report: Reporting a bug, error, or technical problem
   - is_feedback: Offering suggestions or improvements

3. CHURN RISK SIGNALS (true/false - Are they at risk of leaving?):
   - is_pause_request: Asking to pause, hold, or slow down service
   - is_payment_issue: Mentioning payment delays, billing concerns, budget constraints
   - is_cancellation_signal: Hints at stopping, leaving, or ending relationship

4. ENGAGEMENT SIGNALS (true/false - Are they losing interest?):
   - is_disengagement: Signs of dropping off, ghosting, losing interest
   - is_frustration: Expressing frustration with YOUR process or communication
   - is_confusion: Seems lost, unclear, or overwhelmed by complexity

5. ENGAGEMENT LEVEL (Overall):
   - high: Very active, responsive, engaged partner
   - medium: Normal healthy engagement
   - low: Minimal engagement, slower responses
   - disengaged: Not participating, radio silence

6. ACTION ASSESSMENT FOR CSM:
   - requires_immediate_action: true/false - Does this need urgent follow-up?
   - confidence_level: "low|mid|high" - How confident are you in this assessment?
   - suggested_action: What should the CSM do? (e.g., "Call within 24h", "Send resources", "Schedule check-in")

Respond with JSON only:
{
  "sentiment_type": "positive|neutral|negative|frustrated|urgent",
  "sentiment_score": -1.0 to 1.0,
  "is_complaint": true/false,
  "is_issue_report": true/false,
  "is_feedback": true/false,
  "is_pause_request": true/false,
  "is_payment_issue": true/false,
  "is_cancellation_signal": true/false,
  "is_disengagement": true/false,
  "is_frustration": true/false,
  "is_confusion": true/false,
  "engagement_level": "high|medium|low|disengaged",
  "requires_immediate_action": true/false,
  "confidence_level": "low|mid|high",
  "suggested_action": "specific action for CSM",
  "summary": "brief interpretation max 200 chars - How is customer really feeling?",
  "keywords": ["keyword1", "keyword2"]
}`;

/**
 * Prompt for analyzing team response quality
 * Context7 Best Practices Applied:
 * - Detailed instructions with specific evaluation criteria
 * - Customer-first language (empathy, 5-star service mindset)
 * - Confidence scoring for reliability assessment
 * - Role-based perspective (evaluator acting as customer advocate)
 */
const RESPONSE_QUALITY_PROMPT = `You are a Customer Experience Expert evaluating responses as if you were a 5-star hotel guest service specialist.

Your role: Evaluate whether the team member's response makes the customer feel valued, heard, and like a 5-star guest.

ANALYZE THE TEAM'S RESPONSE TO THIS CUSTOMER'S QUESTION:

1. EFFECTIVENESS & RELEVANCE TO CUSTOMER'S SPECIFIC QUESTION:
   Score HOW WELL the response directly addresses what the customer asked:
   - highly_relevant: Precisely answers the specific question with actionable next steps
   - relevant: Addresses the question adequately with clear guidance
   - somewhat_relevant: Touches on the question but misses some key points
   - not_relevant: Doesn't address what the customer asked

   Detail: Explain EXACTLY how the response solves the customer's specific problem.
   Include: What detail or information made it effective (or ineffective)?

2. CUSTOMER-FIRST COMMUNICATION (5-STAR SERVICE):
   Evaluate: Does the response feel personal and customer-centric?
   - Warm & Personal: Uses customer's name/context, says "you", shows understanding
   - Professional & Empathetic: Acknowledges their concern before solving
   - Transactional: Polite but generic, could be more personal
   - Cold: Doesn't acknowledge the customer perspective at all

   Ask yourself: Would this response make the customer feel like a 5-star guest?
   - Do they use "you" and "your"?
   - Do they acknowledge the customer's situation first?
   - Do they show they put themselves in the customer's shoes?

3. CLARITY & EASE OF UNDERSTANDING (0-10 scale):
   How easy is it for the customer to understand and act on this response?

4. CONFIDENCE STATEMENT & SCORE:
   Based on the response quality, provide:
   - confidence_statement: Your assessment of how confident the team member seems
   - confidence_level: "low" (uncertain), "mid" (somewhat confident), "high" (very confident)

5. OVERALL QUALITY SCORE (0-100):
   Composite considering all factors (effectiveness, customer-first approach, clarity, confidence)

6. LOOM EFFECTIVENESS (if Loom link present):
   - very_effective: Video perfectly explains complex topic, saves customer time
   - effective: Video helps communicate the solution well
   - somewhat_effective: Video present but could be more targeted
   - not_effective: Video feels unnecessary or off-topic

Respond with JSON only:
{
  "effectiveness_detail": "specific explanation of how this response solves the customer's question",
  "effectiveness_level": "highly_relevant|relevant|somewhat_relevant|not_relevant",
  "customer_first_language": "warm_personal|professional_empathetic|transactional|cold",
  "five_star_rating": "Does this feel like 5-star service? Explain.",
  "clarity_score": 0-10,
  "confidence_statement": "Assessment of team member's confidence in this response",
  "confidence_level": "low|mid|high",
  "overall_quality_score": 0-100,
  "loom_effectiveness": "very_effective|effective|somewhat_effective|not_effective|null",
  "strengths": ["what went well"],
  "improvements": ["how to make it more customer-centric and effective"],
  "summary": "Brief holistic assessment"
}`;

/**
 * Prompt for categorizing questions for repeated request tracking
 */
const QUESTION_CATEGORIZATION_PROMPT = `You are an expert at categorizing customer support questions for a B2B SaaS company.

Analyze the customer's question and categorize it for training improvement tracking.

Categories to consider:
- onboarding: Account setup, getting started, initial configuration
- billing: Payments, invoices, pricing, subscriptions
- technical: Technical issues, bugs, integrations, API
- feature_request: Requesting new features or changes
- how_to: How to use specific features
- account_management: Account settings, users, permissions
- reporting: Analytics, reports, data export
- content: Content creation, templates, assets
- strategy: Business strategy, best practices, consulting
- scheduling: Appointments, calendar, availability
- communication: Email, messaging, notifications
- other: Doesn't fit other categories

Respond with JSON only:
{
  "topic_category": "category from list above",
  "topic_keywords": ["keyword1", "keyword2", "keyword3"],
  "canonical_question": "standardized version of the question",
  "training_recommendation": "what training material would help",
  "priority": "critical|high|medium|low",
  "is_common_question": true/false
}`;

// ============================================================================
// ANALYTICS CLASS
// ============================================================================

export class Analytics {
  private db: any;
  private openai: OpenAI;
  private config: any;

  constructor(tursoClient: any, openaiClient: OpenAI, config: any = {}) {
    this.db = tursoClient;
    this.openai = openaiClient;
    this.config = {
      openaiModel: config.openaiModel || 'o3-mini',
      debug: config.debug || false,
      consoleOnly: config.consoleOnly || false,
      ...config
    };
  }

  log(level: string, message: string, data: any = null) {
    if (level === 'DEBUG' && !this.config.debug) return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [ANALYTICS] [${level}]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  // ==========================================================================
  // SENTIMENT ANALYSIS
  // ==========================================================================

  /**
   * Analyze customer message sentiment and engagement signals
   * Using o3-mini for superior reasoning capabilities and consistent evaluation
   */
  async analyzeSentiment(message: any, channelId: string) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.openaiModel,
        messages: [
          { role: 'system', content: SENTIMENT_ANALYSIS_PROMPT },
          { role: 'user', content: `Analyze this customer message:\n\n"${message.content}"` }
        ],
        max_completion_tokens: 1500,
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();
      if (!responseContent) {
        this.log('ERROR', 'OpenAI returned an empty response for sentiment analysis', { completion });
        throw new Error('No response from OpenAI');
      }

      let jsonStr = responseContent;
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const analysis = JSON.parse(jsonStr);

      // Store in database
      await this.storeSentimentAnalysis(message, channelId, analysis);

      // Update client churn risk if needed
      await this.updateClientChurnRisk(channelId, analysis);

      return analysis;

    } catch (error: any) {
      this.log('ERROR', `Sentiment analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Store sentiment analysis in database
   */
  async storeSentimentAnalysis(message: any, channelId: string, analysis: any) {
    try {
      const messageLink = `https://discord.com/channels/${message.guild?.id || message.guildId}/${channelId}/${message.id}`;
      const messageTimestamp = Math.floor(new Date(message.createdTimestamp || message.timestamp).getTime() / 1000);

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would store sentiment for message ${message.id}: ${analysis.sentiment_type}`);
        return;
      }

      await this.db.execute({
        sql: `INSERT INTO customer_sentiment (
          channel_id, message_id, sentiment_type, sentiment_score,
          is_complaint, is_issue_report, is_feedback,
          is_pause_request, is_payment_issue, is_cancellation_signal,
          is_disengagement, is_frustration, is_confusion,
          engagement_level, message_content, ai_summary, keywords,
          requires_immediate_action, suggested_action,
          ai_analysis_raw, author_id, author_username, message_timestamp, discord_msg_link,
          confidence_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_id) DO UPDATE SET
          sentiment_type = excluded.sentiment_type,
          sentiment_score = excluded.sentiment_score,
          confidence_level = excluded.confidence_level`,
        args: [
          channelId,
          message.id,
          analysis.sentiment_type,
          analysis.sentiment_score,
          analysis.is_complaint ? 1 : 0,
          analysis.is_issue_report ? 1 : 0,
          analysis.is_feedback ? 1 : 0,
          analysis.is_pause_request ? 1 : 0,
          analysis.is_payment_issue ? 1 : 0,
          analysis.is_cancellation_signal ? 1 : 0,
          analysis.is_disengagement ? 1 : 0,
          analysis.is_frustration ? 1 : 0,
          analysis.is_confusion ? 1 : 0,
          analysis.engagement_level,
          message.content,
          analysis.summary,
          JSON.stringify(analysis.keywords || []),
          analysis.requires_immediate_action ? 1 : 0,
          analysis.suggested_action || null,
          JSON.stringify(analysis),
          message.author?.id || message.author_id,
          message.author?.username || message.author_username,
          messageTimestamp,
          messageLink,
          // Context7 Best Practices field
          analysis.confidence_level || 'mid'
        ]
      });

      this.log('DEBUG', `Stored sentiment for message ${message.id}: ${analysis.sentiment_type}`);

    } catch (error: any) {
      this.log('ERROR', `Failed to store sentiment: ${error.message}`);
    }
  }

  /**
   * Update client churn risk and sentiment metrics for frontend display
   */
  async updateClientChurnRisk(channelId: string, analysis: any) {
    try {
      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would update churn risk for ${channelId}`);
        return;
      }

      let riskLevel = 'low';

      if (analysis.is_cancellation_signal) {
        riskLevel = 'critical';
      } else if (analysis.is_pause_request || analysis.is_payment_issue) {
        riskLevel = 'high';
      } else if (analysis.is_frustration || analysis.sentiment_type === 'frustrated') {
        riskLevel = 'medium';
      } else if (analysis.engagement_level === 'disengaged') {
        riskLevel = 'medium';
      }

      // Determine engagement trend based on engagement level
      let engagementTrend = 'stable';
      if (analysis.engagement_level === 'high') {
        engagementTrend = 'improving';
      } else if (analysis.engagement_level === 'low' || analysis.engagement_level === 'disengaged') {
        engagementTrend = 'declining';
      }

      // Calculate rolling average sentiment score for this client
      const avgResult = await this.db.execute({
        sql: `SELECT AVG(sentiment_score) as avg_score 
              FROM customer_sentiment 
              WHERE channel_id = ? 
              AND message_timestamp >= unixepoch() - 2592000`, // Last 30 days
        args: [channelId]
      });

      const avgSentimentScore = avgResult.rows[0]?.avg_score || analysis.sentiment_score;

      // Always update sentiment tracking for frontend display
      await this.db.execute({
        sql: `UPDATE clients SET 
          churn_risk_level = ?,
          last_sentiment = ?,
          avg_sentiment_score = ?,
          engagement_trend = ?,
          updated_at = unixepoch()
        WHERE channel_id = ?`,
        args: [riskLevel, analysis.sentiment_type, avgSentimentScore, engagementTrend, channelId]
      });

      if (riskLevel !== 'low') {
        this.log('WARN', `⚠️ Churn risk updated for ${channelId}: ${riskLevel} (sentiment: ${analysis.sentiment_type})`);
      } else {
        this.log('DEBUG', `Client ${channelId} sentiment updated: ${analysis.sentiment_type}`);
      }

    } catch (error: any) {
      this.log('ERROR', `Failed to update churn risk: ${error.message}`);
    }
  }

  // ==========================================================================
  // RESPONSE QUALITY ANALYSIS
  // ==========================================================================

  /**
   * Analyze team member response quality with full conversation context
   * Using o3-mini for superior reasoning about customer service effectiveness
   * Fetches last 5 client messages to understand what the team is responding to
   */
  async analyzeResponseQuality(responseMessage: any, originalQuery: string, channelId: string) {
    try {
      // Validate inputs
      if (!responseMessage || !responseMessage.content) {
        throw new Error('Invalid response message: missing content');
      }
      if (!originalQuery || typeof originalQuery !== 'string') {
        throw new Error('Invalid original query: must be a non-empty string');
      }

      const hasLoom = LOOM_URL_REGEX.test(responseMessage.content);
      const loomUrls = responseMessage.content.match(LOOM_URL_REGEX) || [];

      // Fetch the last 5 client messages from this channel for conversation context
      let conversationContext = '';
      try {
        const clientMessages = await this.db.execute({
          sql: `SELECT message_content, message_timestamp, author_username
                FROM customer_sentiment
                WHERE channel_id = ?
                ORDER BY message_timestamp DESC
                LIMIT 5`,
          args: [channelId]
        });

        if (clientMessages.rows && clientMessages.rows.length > 0) {
          conversationContext = '\nCONVERSATION CONTEXT (Last 5 Client Messages):\n' +
            clientMessages.rows
              .reverse() // Reverse to show chronological order (oldest to newest)
              .map((msg: any, idx: number) => {
                const timestamp = new Date(msg.message_timestamp * 1000).toLocaleString();
                return `${idx + 1}. [${timestamp}] ${msg.author_username}: "${msg.message_content}"`;
              })
              .join('\n');
        }
      } catch (err) {
        this.log('DEBUG', `Could not fetch conversation context: ${err}`);
        conversationContext = '';
      }

      const completion = await this.openai.chat.completions.create({
        model: this.config.openaiModel,
        messages: [
          { role: 'system', content: RESPONSE_QUALITY_PROMPT },
          {
            role: 'user',
            content: `Original customer query:\n"${originalQuery}"${conversationContext}\n\nTeam response:\n"${responseMessage.content}"\n\nContains Loom link: ${hasLoom}\n\nEvaluate how well this team response addresses the customer's needs based on the conversation context.`
          }
        ],
        max_completion_tokens: 1500,
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();
      if (!responseContent) {
        this.log('ERROR', 'OpenAI returned an empty response for response quality analysis', { completion });
        throw new Error('No response from OpenAI');
      }

      let jsonStr = responseContent;
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const analysis = JSON.parse(jsonStr);
      analysis.contains_loom = hasLoom;
      analysis.loom_urls = loomUrls;

      return analysis;

    } catch (error: any) {
      this.log('ERROR', `Response quality analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Track CSM response metrics for frontend dashboard display
   * Stores: response time, quality scores, team member info, Loom usage
   */
  async trackCSMResponse(queryId: number, queryTimestamp: number, responseMessage: any, channelId: string, qualityAnalysis: any = null) {
    try {
      // Handle different timestamp formats (unix seconds or JS timestamp)
      const responseTimestamp = Math.floor(
        new Date(responseMessage.createdTimestamp || responseMessage.timestamp).getTime() / 1000
      );

      // Ensure queryTimestamp is in seconds (handle if passed as JS milliseconds)
      const normalizedQueryTimestamp = queryTimestamp > 9999999999
        ? Math.floor(queryTimestamp / 1000)
        : queryTimestamp;

      const responseTimeSeconds = Math.max(0, responseTimestamp - normalizedQueryTimestamp);

      const hasLoom = LOOM_URL_REGEX.test(responseMessage.content);
      const loomUrls = responseMessage.content.match(LOOM_URL_REGEX) || [];

      // Get responder info for frontend display
      const responderId = responseMessage.author?.id || responseMessage.author_id;
      const responderUsername = responseMessage.author?.username || responseMessage.author_username;

      // Find related sentiment message (customer message that prompted this response)
      // Look for sentiment from the same channel around the query timestamp
      const relatedSentiment = await this.db.execute({
        sql: `SELECT id FROM customer_sentiment 
              WHERE channel_id = ? AND message_timestamp >= ? AND message_timestamp <= ? + 3600
              ORDER BY ABS(message_timestamp - ?) ASC LIMIT 1`,
        args: [channelId, normalizedQueryTimestamp - 3600, normalizedQueryTimestamp, normalizedQueryTimestamp]
      });

      const sentimentMessageId = relatedSentiment.rows[0]?.id || null;

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would track CSM response for query ${queryId}`);
        return {
          responseTimeSeconds,
          quality: qualityAnalysis
        };
      }

      // Map AI values to DB metrics format
      const usefulnessMap: Record<string, string> = {
        'highly_relevant': 'highly_useful',
        'relevant': 'useful',
        'somewhat_relevant': 'somewhat_useful',
        'not_relevant': 'not_useful'
      };

      const professionalismMap: Record<string, string> = {
        'warm_personal': 'excellent',
        'professional_empathetic': 'good',
        'transactional': 'average',
        'cold': 'poor'
      };

      const mappedUsefulness = usefulnessMap[qualityAnalysis?.effectiveness_level] || 'useful';
      const mappedProfessionalism = professionalismMap[qualityAnalysis?.customer_first_language] || 'average';

      await this.db.execute({
        sql: `INSERT INTO csm_response_analytics (
          channel_id, query_id, sentiment_message_id, query_timestamp, response_timestamp,
          response_time_seconds, resolution_time_seconds, responder_user_id, responder_username,
          response_usefulness, response_professionalism, response_clarity,
          contains_loom_link, loom_url, loom_effectiveness,
          overall_quality_score, ai_assessment_raw,
          effectiveness_detail, effectiveness_level, customer_first_language,
          five_star_rating, confidence_statement, confidence_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          channelId,
          queryId,
          sentimentMessageId,
          normalizedQueryTimestamp,
          responseTimestamp,
          responseTimeSeconds,
          null, // resolution_time_seconds - updated when query is resolved
          responderId,
          responderUsername,
          mappedUsefulness, // Mapped value
          mappedProfessionalism, // Mapped value
          qualityAnalysis?.clarity_score || null,
          hasLoom ? 1 : 0,
          loomUrls[0] || null,
          qualityAnalysis?.loom_effectiveness || null,
          qualityAnalysis?.overall_quality_score || null,
          qualityAnalysis ? JSON.stringify(qualityAnalysis) : null,
          // Context7 Best Practices fields
          qualityAnalysis?.effectiveness_detail || null,
          qualityAnalysis?.effectiveness_level || 'relevant',
          qualityAnalysis?.customer_first_language || 'transactional',
          qualityAnalysis?.five_star_rating || null,
          qualityAnalysis?.confidence_statement || null,
          qualityAnalysis?.confidence_level || 'mid'
        ]
      });

      // Update questions with first response metrics (for frontend)
      if (queryId) {
        await this.db.execute({
          sql: `UPDATE questions SET 
            response_time_seconds = COALESCE(response_time_seconds, ?),
            first_response_at = COALESCE(first_response_at, ?),
            response_quality_score = COALESCE(response_quality_score, ?),
            updated_at = unixepoch()
          WHERE id = ?`,
          args: [responseTimeSeconds, responseTimestamp, qualityAnalysis?.overall_quality_score || null, queryId]
        });
      }

      // Update daily summary metrics
      await this.incrementDailyMetric(channelId, 'total_team_messages', 1);
      if (hasLoom) {
        await this.incrementDailyMetric(channelId, 'looms_sent', 1);
      }

      this.log('INFO', `📊 CSM Response: ${responderUsername} | ${responseTimeSeconds}s | Quality: ${qualityAnalysis?.overall_quality_score?.toFixed(2) || 'N/A'} | Sentiment Link: ${sentimentMessageId ? '✓' : '✗'} | Loom: ${hasLoom ? '✓' : '✗'}`);

      return { responseTimeSeconds, qualityAnalysis, responderId, responderUsername, sentimentMessageId };

    } catch (error: any) {
      this.log('ERROR', `Failed to track CSM response: ${error.message}`);
      return null;
    }
  }

  /**
   * Increment a specific metric in the daily summary
   */
  async incrementDailyMetric(channelId: string, metricName: string, value = 1) {
    try {
      const targetDate = new Date().toISOString().split('T')[0];

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would increment daily metric ${metricName} by ${value} for ${channelId}`);
        return;
      }

      // Ensure row exists
      await this.db.execute({
        sql: `INSERT INTO daily_analytics_summary (channel_id, date, created_at, updated_at)
              VALUES (?, ?, unixepoch(), unixepoch())
              ON CONFLICT(channel_id, date) DO NOTHING`,
        args: [channelId, targetDate]
      });

      // Increment metric
      await this.db.execute({
        sql: `UPDATE daily_analytics_summary SET 
                ${metricName} = ${metricName} + ?,
                updated_at = unixepoch()
              WHERE channel_id = ? AND date = ?`,
        args: [value, channelId, targetDate]
      });
    } catch (error: any) {
      this.log('ERROR', `Failed to increment daily metric ${metricName}: ${error.message}`);
    }
  }

  // ==========================================================================
  // RISK RADAR
  // ==========================================================================

  /**
   * Update client risk radar based on recent activity
   */
  async calculateRiskRadar(channelId: string) {
    try {
      // Get last client message with sentiment data (using Drizzle)
      const lastClientMsg = await this.db.execute({
        sql: `SELECT message_timestamp, is_complaint, is_frustration, is_confusion, is_cancellation_signal, is_pause_request, is_payment_issue
              FROM customer_sentiment 
              WHERE channel_id = ? ORDER BY message_timestamp DESC LIMIT 1`,
        args: [channelId]
      });

      // Get last team reply
      const lastTeamReply = await this.db.execute({
        sql: `SELECT response_timestamp FROM csm_response_analytics 
              WHERE channel_id = ? ORDER BY response_timestamp DESC LIMIT 1`,
        args: [channelId]
      });

      // Get recent churn signals (last 30 days)
      const recentChurnSignals = await this.db.execute({
        sql: `SELECT 
                SUM(is_complaint) as complaint_count,
                SUM(is_frustration) as frustration_count,
                SUM(is_confusion) as confusion_count,
                SUM(is_cancellation_signal) as cancellation_count,
                SUM(is_pause_request) as pause_count,
                SUM(is_payment_issue) as payment_count
              FROM customer_sentiment
              WHERE channel_id = ? AND message_timestamp > unixepoch() - 2592000`,
        args: [channelId]
      });

      const lastClientAt = lastClientMsg.rows[0]?.message_timestamp || null;
      const lastTeamAt = lastTeamReply.rows[0]?.response_timestamp || null;
      const churnData = recentChurnSignals.rows[0];

      let inactivityDays = 0;
      if (lastClientAt) {
        inactivityDays = Math.floor((Date.now() / 1000 - lastClientAt) / 86400);
      }

      // Determine risk status based on BOTH inactivity AND sentiment signals
      let riskStatus = 'HEALTHY';
      let riskReason = '';

      // Sentiment-based risk escalation
      if (churnData?.cancellation_count > 0) {
        riskStatus = 'CRITICAL';
        riskReason = 'cancellation_signal';
      } else if (churnData?.payment_count > 0 || churnData?.pause_count > 0) {
        riskStatus = riskStatus === 'CRITICAL' ? 'CRITICAL' : 'AT_RISK';
        riskReason = riskReason || 'payment_or_pause_signal';
      } else if (churnData?.frustration_count > 2 || churnData?.complaint_count > 1) {
        riskStatus = riskStatus === 'CRITICAL' ? 'CRITICAL' : 'AT_RISK';
        riskReason = riskReason || 'high_frustration_or_complaints';
      }

      // Inactivity-based risk escalation
      if (inactivityDays > 14) {
        riskStatus = 'CRITICAL';
        riskReason = riskReason ? `${riskReason}+inactivity` : 'inactivity_critical';
      } else if (inactivityDays > 7) {
        if (riskStatus !== 'CRITICAL') {
          riskStatus = 'AT_RISK';
          riskReason = riskReason ? `${riskReason}+inactivity` : 'inactivity_at_risk';
        }
      }

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would store risk radar for ${channelId}: ${riskStatus}`);
        return;
      }

      // Store risk calculation
      await this.db.execute({
        sql: `INSERT INTO risk_radar (
                channel_id, last_client_msg_at, last_team_reply_at, inactivity_days, 
                risk_status, updated_at
              )
              VALUES (?, ?, ?, ?, ?, unixepoch())
              ON CONFLICT(channel_id) DO UPDATE SET
                last_client_msg_at = excluded.last_client_msg_at,
                last_team_reply_at = excluded.last_team_reply_at,
                inactivity_days = excluded.inactivity_days,
                risk_status = excluded.risk_status,
                updated_at = unixepoch()`,
        args: [channelId, lastClientAt, lastTeamAt, inactivityDays, riskStatus]
      });

      this.log('INFO', `⚠️ Risk radar calculated for ${channelId}: ${riskStatus} (${inactivityDays}d inactivity, reason: ${riskReason}, signals: ${JSON.stringify({
        complaints: churnData?.complaint_count || 0,
        frustrations: churnData?.frustration_count || 0,
        cancellations: churnData?.cancellation_count || 0
      })})`);

    } catch (error: any) {
      this.log('ERROR', `Failed to calculate risk radar: ${error.message}`);
    }
  }

  // ==========================================================================
  // LOOM TRACKING
  // ==========================================================================

  /**
   * Track Loom video link sent by team member
   */
  async trackLoomLink(message: any, channelId: string, relatedQueryId: number | null = null, queryContext: string | null = null) {
    try {
      const loomUrls = message.content.match(LOOM_URL_REGEX) || [];
      if (loomUrls.length === 0) return null;

      const loomUrl = loomUrls[0];
      const loomIdMatch = loomUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      const loomId = loomIdMatch ? loomIdMatch[1] : null;

      const messageTimestamp = Math.floor(new Date(message.createdTimestamp || message.timestamp).getTime() / 1000);
      const messageLink = `https://discord.com/channels/${message.guild?.id || message.guildId}/${channelId}/${message.id}`;

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would track Loom link: ${loomUrl}`);
        return {
          loomUrl,
          channelId,
          sender: message.author?.username
        };
      }

      await this.db.execute({
        sql: `INSERT INTO looms (
          channel_id, question_id, issue_id, loom_url, title, description,
          loom_effectiveness, viewer_count, sender_user_id, sender_username,
          discord_msg_link, message_timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
        ON CONFLICT(discord_msg_link) DO NOTHING`,
        args: [
          channelId,
          relatedQueryId || null,
          null, // issue_id - not tracking in this context
          loomUrl,
          null, // title - can be extracted later
          queryContext, // use query_context as description
          null, // loom_effectiveness - to be analyzed later
          0, // viewer_count
          message.author?.id || message.author_id,
          message.author?.username || message.author_username,
          messageLink,
          messageTimestamp
        ]
      });

      this.log('INFO', `Tracked Loom link: ${loomUrl}`);
      return { loomUrl, loomId };

    } catch (error: any) {
      this.log('ERROR', `Failed to track Loom link: ${error.message}`);
      return null;
    }
  }

  // ==========================================================================
  // REPEATED REQUESTS TRACKING
  // ==========================================================================

  /**
   * Categorize and track repeated questions
   * Categorize customer questions for training and routing
   * Using o3-mini for consistent and accurate question classification
   */
  async trackRepeatedRequest(message: any, channelId: string, classification: any, questionId: number | null = null) {
    try {
      // Only track questions and bugs
      if (!['Question', 'Bug'].includes(classification.type)) {
        return null;
      }

      const completion = await this.openai.chat.completions.create({
        model: this.config.openaiModel,
        messages: [
          { role: 'system', content: QUESTION_CATEGORIZATION_PROMPT },
          { role: 'user', content: `Categorize this customer question:\n\n"${message.content}"` }
        ],
        max_completion_tokens: 1000,
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();
      if (!responseContent) {
        this.log('ERROR', 'OpenAI returned an empty response for question categorization', { completion });
        throw new Error('No response from OpenAI');
      }

      let jsonStr = responseContent;
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const categorization = JSON.parse(jsonStr);

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would track repeated request: ${categorization.topic_category}`);
        return categorization;
      }

      // Find or create repeated request topic
      const existingTopic = await this.findSimilarTopic(categorization);

      if (existingTopic) {
        // Update existing topic
        await this.updateRepeatedRequest(existingTopic.id, message, channelId, categorization, questionId);
      } else {
        // Create new topic
        await this.createRepeatedRequest(message, channelId, categorization, questionId);
      }

      return categorization;

    } catch (error: any) {
      this.log('ERROR', `Failed to track repeated request: ${error.message}`);
      return null;
    }
  }

  /**
   * Find similar existing topic in top_issues
   */
  async findSimilarTopic(categorization: any) {
    try {
      const result = await this.db.execute({
        sql: `SELECT id, topic_category, canonical_question, occurrence_count 
              FROM top_issues 
              WHERE topic_category = ? 
              ORDER BY occurrence_count DESC 
              LIMIT 1`,
        args: [categorization.topic_category]
      });

      return result.rows.length > 0 ? result.rows[0] : null;

    } catch (error: any) {
      this.log('ERROR', `Failed to find similar topic: ${error.message}`);
      return null;
    }
  }

  /**
   * Create new top_issue topic
   */
  async createRepeatedRequest(message: any, channelId: string, categorization: any, questionId: number | null = null) {
    try {
      const messageTimestamp = Math.floor(new Date(message.createdTimestamp || message.timestamp).getTime() / 1000);
      const messageLink = `https://discord.com/channels/${message.guild?.id || message.guildId}/${channelId}/${message.id}`;

      // Generate embedding for the canonical question
      let topicEmbedding = null;
      try {
        const embeddingResponse = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: categorization.canonical_question,
        });
        topicEmbedding = embeddingResponse.data[0].embedding;
      } catch (e: any) {
        this.log('WARN', `Failed to generate embedding for top issue: ${e.message}`);
      }

      const result = await this.db.execute({
        sql: `INSERT INTO top_issues (
          topic_category, topic_keywords, canonical_question,
          sample_questions, affected_channels, training_recommendation, priority,
          topic_embedding, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
        args: [
          categorization.topic_category,
          JSON.stringify(categorization.topic_keywords),
          categorization.canonical_question,
          JSON.stringify([message.content]),
          JSON.stringify([channelId]),
          categorization.training_recommendation,
          categorization.priority,
          topicEmbedding ? JSON.stringify(topicEmbedding) : null
        ]
      });

      // Store instance in topissuescomparison-job
      await this.db.execute({
        sql: `INSERT INTO \`topissuescomparison-job\` (
          issue_id, channel_id, message_id, message_content,
          message_timestamp, discord_msg_link, question_id, similarity_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          result.lastInsertRowid,
          channelId,
          message.id,
          message.content,
          messageTimestamp,
          messageLink,
          questionId,
          1.0 // Default similarity score for exact match via classification
        ]
      });

      this.log('INFO', `Created new top issue: ${categorization.topic_category}`);

    } catch (error: any) {
      this.log('ERROR', `Failed to create top issue: ${error.message}`);
    }
  }

  /**
   * Update existing top_issue topic
   */
  async updateRepeatedRequest(topicId: number, message: any, channelId: string, categorization: any, questionId: number | null = null) {
    try {
      const messageTimestamp = Math.floor(new Date(message.createdTimestamp || message.timestamp).getTime() / 1000);
      const messageLink = `https://discord.com/channels/${message.guild?.id || message.guildId}/${channelId}/${message.id}`;

      // Update topic count
      await this.db.execute({
        sql: `UPDATE top_issues SET 
          occurrence_count = occurrence_count + 1,
          last_seen_at = unixepoch(),
          affected_channels = json_insert(affected_channels, '$[#]', ?),
          updated_at = unixepoch()
        WHERE id = ?`,
        args: [channelId, topicId]
      });

      // Store instance in topissuescomparison-job
      await this.db.execute({
        sql: `INSERT INTO \`topissuescomparison-job\` (
          issue_id, channel_id, message_id, message_content,
          message_timestamp, discord_msg_link, question_id, similarity_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          topicId,
          channelId,
          message.id,
          message.content,
          messageTimestamp,
          messageLink,
          questionId,
          1.0 // Default similarity score for exact match via classification
        ]
      });

      this.log('INFO', `Updated top issue ${topicId}: +1 occurrence`);

    } catch (error: any) {
      this.log('ERROR', `Failed to update top issue: ${error.message}`);
    }
  }

  // ==========================================================================
  // DAILY SUMMARY
  // ==========================================================================

  /**
   * Calculate and store daily analytics summary
   * Comprehensive update of all metrics for a specific day
   */
  async calculateDailySummary(channelId: string, date: string | null = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const startOfDay = Math.floor(new Date(targetDate).getTime() / 1000);
      const endOfDay = startOfDay + 86400;

      // 1. Message Counts
      const messageStats = await this.db.execute({
        sql: `SELECT 
          (SELECT COUNT(*) FROM customer_sentiment WHERE channel_id = ? AND message_timestamp >= ? AND message_timestamp < ?) as client_msgs,
          (SELECT COUNT(*) FROM csm_response_analytics WHERE channel_id = ? AND response_timestamp >= ? AND response_timestamp < ?) as team_msgs`,
        args: [channelId, startOfDay, endOfDay, channelId, startOfDay, endOfDay]
      });

      // 2. Query Metrics
      const queryStats = await this.db.execute({
        sql: `SELECT 
          COUNT(*) as total_queries,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_queries,
          AVG(resolution_time_seconds) as avg_resolution_time
        FROM questions 
        WHERE channel_id = ? AND created_at >= ? AND created_at < ?`,
        args: [channelId, startOfDay, endOfDay]
      });

      // 3. Sentiment distribution
      const sentimentStats = await this.db.execute({
        sql: `SELECT 
          SUM(CASE WHEN sentiment_type = 'positive' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN sentiment_type = 'neutral' THEN 1 ELSE 0 END) as neutral,
          SUM(CASE WHEN sentiment_type = 'negative' THEN 1 ELSE 0 END) as negative,
          SUM(CASE WHEN sentiment_type = 'frustrated' THEN 1 ELSE 0 END) as frustrated,
          AVG(sentiment_score) as avg_score
        FROM customer_sentiment 
        WHERE channel_id = ? AND message_timestamp >= ? AND message_timestamp < ?`,
        args: [channelId, startOfDay, endOfDay]
      });

      // 4. Response metrics
      const responseStats = await this.db.execute({
        sql: `SELECT 
          AVG(response_time_seconds) as avg_response_time,
          MIN(response_time_seconds) as min_response_time,
          MAX(response_time_seconds) as max_response_time,
          AVG(overall_quality_score) as avg_quality,
          SUM(contains_loom_link) as looms_sent,
          AVG(response_clarity) as avg_clarity
        FROM csm_response_analytics 
        WHERE channel_id = ? AND query_timestamp >= ? AND query_timestamp < ?`,
        args: [channelId, startOfDay, endOfDay]
      });

      // 5. Churn & Complaints (with detailed sentiment signals)
      const riskStats = await this.db.execute({
        sql: `SELECT 
          SUM(CASE WHEN is_complaint = 1 THEN 1 ELSE 0 END) as complaints,
          SUM(CASE WHEN is_frustration = 1 THEN 1 ELSE 0 END) as frustrations,
          SUM(CASE WHEN is_confusion = 1 THEN 1 ELSE 0 END) as confusions,
          SUM(CASE WHEN is_pause_request = 1 THEN 1 ELSE 0 END) as pause_requests,
          SUM(CASE WHEN is_payment_issue = 1 THEN 1 ELSE 0 END) as payment_issues,
          SUM(CASE WHEN is_cancellation_signal = 1 THEN 1 ELSE 0 END) as cancellations,
          SUM(CASE WHEN is_disengagement = 1 THEN 1 ELSE 0 END) as disengagements,
          SUM(CASE WHEN is_pause_request = 1 OR is_payment_issue = 1 OR is_cancellation_signal = 1 THEN 1 ELSE 0 END) as total_churn_signals
        FROM customer_sentiment 
        WHERE channel_id = ? AND message_timestamp >= ? AND message_timestamp < ?`,
        args: [channelId, startOfDay, endOfDay]
      });

      // 6. Sentiment trend (compare with yesterday if available)
      const yesterdayStart = startOfDay - 86400;
      const yesterdayEnd = startOfDay;
      const yesterdaySentiment = await this.db.execute({
        sql: `SELECT 
          AVG(sentiment_score) as avg_score
        FROM customer_sentiment 
        WHERE channel_id = ? AND message_timestamp >= ? AND message_timestamp < ?`,
        args: [channelId, yesterdayStart, yesterdayEnd]
      });

      // 7. Engagement Score (calculation: messages + sentiment + resolved ratio)
      const clientMsgs = messageStats.rows[0]?.client_msgs || 0;
      const teamMsgs = messageStats.rows[0]?.team_msgs || 0;
      const totalQueries = queryStats.rows[0]?.total_queries || 0;
      const resolvedQueries = queryStats.rows[0]?.resolved_queries || 0;
      const avgSentiment = sentimentStats.rows[0]?.avg_score || 0;
      const resolutionRate = totalQueries > 0 ? (resolvedQueries / totalQueries) : 0;
      const engagementScore = Math.min(100, (clientMsgs * 5) + (teamMsgs * 3) + (resolutionRate * 30) + (avgSentiment * 50) + 20);

      if (this.config.consoleOnly) {
        this.log('INFO', `[CONSOLE-ONLY] Would store daily summary for ${channelId} on ${targetDate}`);
        return;
      }

      // 8. Store summary with enhanced sentiment data
      await this.db.execute({
        sql: `INSERT INTO daily_analytics_summary (
          channel_id, date, 
          total_client_messages, total_team_messages,
          total_queries, queries_resolved,
          avg_response_time_seconds, min_response_time_seconds, max_response_time_seconds,
          avg_resolution_time_seconds,
          avg_overall_quality, avg_clarity_score, looms_sent,
          positive_messages, neutral_messages, negative_messages, frustrated_messages,
          churn_signals_count, complaints_count,
          engagement_score,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
        ON CONFLICT(channel_id, date) DO UPDATE SET
          total_client_messages = excluded.total_client_messages,
          total_team_messages = excluded.total_team_messages,
          total_queries = excluded.total_queries,
          queries_resolved = excluded.queries_resolved,
          avg_response_time_seconds = excluded.avg_response_time_seconds,
          min_response_time_seconds = excluded.min_response_time_seconds,
          max_response_time_seconds = excluded.max_response_time_seconds,
          avg_resolution_time_seconds = excluded.avg_resolution_time_seconds,
          avg_overall_quality = excluded.avg_overall_quality,
          avg_clarity_score = excluded.avg_clarity_score,
          looms_sent = excluded.looms_sent,
          positive_messages = excluded.positive_messages,
          neutral_messages = excluded.neutral_messages,
          negative_messages = excluded.negative_messages,
          frustrated_messages = excluded.frustrated_messages,
          churn_signals_count = excluded.churn_signals_count,
          complaints_count = excluded.complaints_count,
          engagement_score = excluded.engagement_score,
          updated_at = unixepoch()`,
        args: [
          channelId,
          targetDate,
          clientMsgs,
          teamMsgs,
          totalQueries,
          resolvedQueries,
          responseStats.rows[0]?.avg_response_time || null,
          responseStats.rows[0]?.min_response_time || null,
          responseStats.rows[0]?.max_response_time || null,
          queryStats.rows[0]?.avg_resolution_time || null,
          responseStats.rows[0]?.avg_quality || null,
          responseStats.rows[0]?.avg_clarity || null,
          responseStats.rows[0]?.looms_sent || 0,
          sentimentStats.rows[0]?.positive || 0,
          sentimentStats.rows[0]?.neutral || 0,
          sentimentStats.rows[0]?.negative || 0,
          sentimentStats.rows[0]?.frustrated || 0,
          riskStats.rows[0]?.total_churn_signals || 0,
          riskStats.rows[0]?.complaints || 0,
          engagementScore
        ]
      });

      // 9. Log detailed sentiment summary with trend analysis
      const yesterdayAvg = yesterdaySentiment.rows[0]?.avg_score || 0;
      const sentimentTrend = avgSentiment > yesterdayAvg ? '📈 improving' : avgSentiment < yesterdayAvg ? '📉 declining' : '➡️ stable';

      this.log('INFO', `📈 Daily summary calculated for ${channelId} on ${targetDate}:\n${JSON.stringify({
        messages: { clients: clientMsgs, team: teamMsgs },
        queries: { total: totalQueries, resolved: resolvedQueries, rate: `${(resolutionRate * 100).toFixed(1)}%` },
        sentiment: {
          avg_score: avgSentiment.toFixed(2),
          trend: sentimentTrend,
          distribution: {
            positive: sentimentStats.rows[0]?.positive || 0,
            neutral: sentimentStats.rows[0]?.neutral || 0,
            negative: sentimentStats.rows[0]?.negative || 0,
            frustrated: sentimentStats.rows[0]?.frustrated || 0
          }
        },
        churn_signals: {
          total: riskStats.rows[0]?.total_churn_signals || 0,
          complaints: riskStats.rows[0]?.complaints || 0,
          frustrations: riskStats.rows[0]?.frustrations || 0,
          confusions: riskStats.rows[0]?.confusions || 0,
          pause_requests: riskStats.rows[0]?.pause_requests || 0,
          payment_issues: riskStats.rows[0]?.payment_issues || 0,
          cancellations: riskStats.rows[0]?.cancellations || 0
        },
        quality: {
          avg_response_time: responseStats.rows[0]?.avg_response_time ? `${Math.round(responseStats.rows[0]?.avg_response_time)}s` : 'N/A',
          avg_quality_score: responseStats.rows[0]?.avg_quality ? responseStats.rows[0]?.avg_quality.toFixed(1) : 'N/A',
          looms_sent: responseStats.rows[0]?.looms_sent || 0
        },
        engagement_score: `${Math.round(engagementScore)}/100`
      }, null, 2)}`);

    } catch (error: any) {
      this.log('ERROR', `Failed to calculate daily summary: ${error.message}`);
    }
  }

  // ==========================================================================
  // REPORTING HELPERS
  // ==========================================================================

  /**
   * Get top issues for training prioritization
   */
  async getTopRepeatedRequests(limit = 10) {
    try {
      const result = await this.db.execute({
        sql: `SELECT * FROM top_issues 
              WHERE is_addressed = 0 
              ORDER BY occurrence_count DESC, priority ASC
              LIMIT ?`,
        args: [limit]
      });

      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get top issues: ${error.message}`);
      return [];
    }
  }

  /**
   * Get clients with high churn risk
   */
  async getHighChurnRiskClients() {
    try {
      const result = await this.db.execute({
        sql: `SELECT c.*, rr.risk_status, rr.inactivity_days
              FROM clients c
              LEFT JOIN risk_radar rr ON c.channel_id = rr.channel_id
              WHERE c.churn_risk_level IN ('high', 'critical')
              OR rr.risk_status IN ('AT_RISK', 'CRITICAL')
              ORDER BY 
                CASE c.churn_risk_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                rr.inactivity_days DESC`,
        args: []
      });

      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get high churn risk clients: ${error.message}`);
      return [];
    }
  }

  /**
   * Get CSM performance metrics
   */
  async getCSMPerformanceMetrics(userId = null, days = 30) {
    try {
      const since = Math.floor(Date.now() / 1000) - (days * 86400);

      let sql = `SELECT 
        responder_user_id,
        responder_username,
        COUNT(*) as total_responses,
        AVG(response_time_seconds) as avg_response_time,
        AVG(overall_quality_score) as avg_quality,
        SUM(contains_loom_link) as looms_sent,
        SUM(CASE WHEN response_usefulness = 'highly_useful' THEN 1 ELSE 0 END) as highly_useful_count,
        SUM(CASE WHEN response_professionalism = 'excellent' THEN 1 ELSE 0 END) as excellent_professionalism
      FROM csm_response_analytics 
      WHERE query_timestamp >= ?`;

      const args = [since];

      if (userId) {
        sql += ` AND responder_user_id = ?`;
        args.push(userId);
      }

      sql += ` GROUP BY responder_user_id ORDER BY avg_quality DESC`;

      const result = await this.db.execute({ sql, args });
      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get CSM metrics: ${error.message}`);
      return [];
    }
  }
}

