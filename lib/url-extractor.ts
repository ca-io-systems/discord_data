/**
 * URL Extraction and Tracking Module
 * Extracts non-Loom URLs from messages and stores them for analytics
 * 
 * Tracks:
 * - Documentation links
 * - GitHub/Repository links
 * - Resource/Tool links
 * - Internal/External links
 */

// URL detection regex (comprehensive)
export const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]*[^\s<>"{}|\\^`\[\].,:;!?()\-\]]/gi;

// Loom URL regex (to exclude)
export const LOOM_URL_REGEX = /https?:\/\/(www\.)?(loom\.com\/share\/[a-zA-Z0-9]+|loom\.com\/embed\/[a-zA-Z0-9]+)/gi;

// Common URL patterns for categorization
const URL_PATTERNS = {
  github: /github\.com/i,
  gitlab: /gitlab\.com/i,
  documentation: /(docs?\.?|documentation|guide|tutorial|wiki).*\.(com|org|io|dev)/i,
  stackoverflow: /stackoverflow\.com/i,
  npm: /npmjs\.com|npm\.io/i,
  pypi: /pypi\.org|pypi\.python\.org/i,
  docker: /docker\.com|hub\.docker\.com/i,
  aws: /aws\.amazon\.com|console\.aws\.amazon\.com/i,
  gcp: /cloud\.google\.com|console\.cloud\.google\.com/i,
  azure: /azure\.microsoft\.com|portal\.azure\.com/i,
  figma: /figma\.com/i,
  notion: /notion\.so/i,
  slack: /slack\.com|app\.slack\.com/i,
  confluence: /confluence/i,
  jira: /jira/i,
  youtube: /youtube\.com|youtu\.be/i,
  video: /(video|stream|recording)/i,
  blog: /(blog|article|post)/i,
  course: /(course|learn|training|class)/i,
};

export class URLExtractor {
  private db: any;
  private config: any;

  constructor(tursoClient: any, config: any = {}) {
    this.db = tursoClient;
    this.config = {
      debug: config.debug || false,
      consoleOnly: config.consoleOnly || false,
      ...config
    };
  }

  log(level: string, message: string, data: any = null) {
    if (level === 'DEBUG' && !this.config.debug) return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [URL_EXTRACTOR] [${level}]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Extract all URLs from message content
   * @param {string} content - Message content
   * @returns {string[]} Array of URLs
   */
  extractURLs(content: string) {
    if (!content) return [];

    const allUrls = content.match(URL_REGEX) || [];

    // Filter out Loom URLs (handled separately)
    const nonLoomUrls = allUrls.filter((url: string) => !LOOM_URL_REGEX.test(url));

    return nonLoomUrls;
  }

  /**
   * Categorize a URL based on its domain/pattern
   * @param {string} url - URL to categorize
   * @returns {string} Category name
   */
  categorizeURL(url: string) {
    for (const [category, pattern] of Object.entries(URL_PATTERNS)) {
      if (pattern.test(url)) {
        return category;
      }
    }

    // Determine if internal or external based on domain
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Add more patterns if needed
      if (domain.includes('internal') || domain.includes('local')) {
        return 'internal';
      }
    } catch (e) {
      this.log('DEBUG', `Failed to parse URL: ${url}`);
    }

    return 'external';
  }

  /**
   * Extract domain from URL for tracking
   * @param {string} url - Full URL
   * @returns {string} Domain name
   */
  extractDomain(url: string) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || url;
    } catch (e) {
      return url;
    }
  }

  /**
   * Check if URL is internal company link
   * @param {string} url - URL to check
   * @returns {boolean} True if internal
   */
  isInternalURL(url: string) {
    const internalPatterns = [
      /localhost/i,
      /127\.0\.0\.1/i,
      /internal\./i,
      /(company|org)-domain/i, // Replace with actual internal domain
    ];

    return internalPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Store extracted URLs in database
   * @param {Object} message - Discord message object
   * @param {string} channelId - Channel ID
   * @param {number} questionId - Related question ID (optional)
   * @param {number} issueId - Related issue ID (optional)
   * @param {string} context - Message context/content
   */
  async trackURLs(message: any, channelId: string, questionId: number | null = null, issueId: number | null = null, context: string | null = null) {
    try {
      // Extract all URLs from message
      const urls = this.extractURLs(message.content);

      if (!urls || urls.length === 0) {
        return { tracked: 0, urls: [] };
      }

      const messageTimestamp = Math.floor(
        new Date(message.createdTimestamp || message.timestamp).getTime() / 1000
      );
      const messageLink = `https://discord.com/channels/${message.guild?.id || message.guildId}/${channelId}/${message.id}`;

      const senderId = message.author?.id || message.author_id;
      const senderUsername = message.author?.username || message.author_username;

      let trackedCount = 0;
      const trackedUrls = [];

      // Track each URL
      for (const url of urls) {
        try {
          const linkType = this.categorizeURL(url);
          const isInternal = this.isInternalURL(url) ? 1 : 0;

          if (this.config.consoleOnly) {
            this.log('INFO', `[CONSOLE-ONLY] Would track URL: ${url} (${linkType})`);
            trackedUrls.push({
              url,
              type: linkType,
              internal: isInternal === 1
            });
            trackedCount++;
            continue;
          }

          await this.db.execute({
            sql: `INSERT INTO outbound_links (
              channel_id, message_id, url, link_type, is_internal,
              question_id, issue_id, sender_user_id, sender_username,
              context, extracted_at, discord_msg_link
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(message_id, url) DO NOTHING`,
            args: [
              channelId,
              message.id,
              url,
              linkType,
              isInternal,
              questionId || null,
              issueId || null,
              senderId,
              senderUsername,
              context ? context.substring(0, 500) : null, // Limit context to 500 chars
              messageTimestamp,
              messageLink
            ]
          });

          trackedUrls.push({
            url,
            type: linkType,
            internal: isInternal === 1
          });

          trackedCount++;

        } catch (error: any) {
          // Skip duplicate or constraint errors, log others
          if (!error.message.includes('UNIQUE') && !error.message.includes('constraint')) {
            this.log('WARN', `Failed to track URL: ${url} - ${error.message}`);
          }
        }
      }

      if (trackedCount > 0) {
        this.log('INFO', `🔗 Tracked ${trackedCount} URLs from ${senderUsername}`);
      }

      return { tracked: trackedCount, urls: trackedUrls };

    } catch (error: any) {
      this.log('ERROR', `Failed to track URLs: ${error.message}`);
      return { tracked: 0, urls: [], error: error.message };
    }
  }

  /**
   * Get top shared URLs by category
   */
  async getTopURLsByCategory(limit = 10) {
    try {
      const result = await this.db.execute({
        sql: `SELECT 
          link_type, 
          url,
          COUNT(*) as share_count,
          COUNT(DISTINCT sender_user_id) as shared_by_count
        FROM outbound_links
        GROUP BY link_type, url
        ORDER BY share_count DESC, link_type
        LIMIT ?`,
        args: [limit]
      });

      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get top URLs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get URLs shared by specific team member
   */
  async getURLsBySender(senderId: string, limit = 20) {
    try {
      const result = await this.db.execute({
        sql: `SELECT 
          url,
          link_type,
          COUNT(*) as times_shared,
          COUNT(DISTINCT channel_id) as channels_shared_in
        FROM outbound_links
        WHERE sender_user_id = ?
        GROUP BY url
        ORDER BY times_shared DESC
        LIMIT ?`,
        args: [senderId, limit]
      });

      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get sender URLs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get URLs related to a specific question
   */
  async getURLsForQuestion(questionId: number) {
    try {
      const result = await this.db.execute({
        sql: `SELECT 
          url,
          link_type,
          sender_username,
          extracted_at,
          discord_msg_link
        FROM outbound_links
        WHERE question_id = ?
        ORDER BY extracted_at DESC`,
        args: [questionId]
      });

      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get question URLs: ${error.message}`);
      return [];
    }
  }

  /**
   * Get most shared resource types
   */
  async getResourceTypesDistribution() {
    try {
      const result = await this.db.execute({
        sql: `SELECT 
          link_type,
          COUNT(*) as count,
          COUNT(DISTINCT url) as unique_resources,
          COUNT(DISTINCT channel_id) as channels_shared_in
        FROM outbound_links
        GROUP BY link_type
        ORDER BY count DESC`
      });

      return result.rows;

    } catch (error: any) {
      this.log('ERROR', `Failed to get resource types: ${error.message}`);
      return [];
    }
  }
}

