/**
 * Text Processing Utilities
 * 
 * Functions for processing text before chunking and embedding.
 * Includes sentence splitting and text normalization.
 */

/**
 * Split text into sentences
 * 
 * Uses regex-based splitting that handles:
 * - Periods (.), exclamation marks (!), question marks (?)
 * - Abbreviations (e.g., "Dr.", "Mr.", "etc.")
 * - URLs and email addresses
 * - Decimal numbers
 * 
 * @param {string} text - Text to split
 * @returns {string[]} - Array of sentences
 */
function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Remove extra whitespace
  const normalized = text.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    return [];
  }

  // Regex pattern for sentence splitting
  // Matches: . ! ? followed by space or end of string
  // But excludes: abbreviations, decimals, URLs, emails
  const sentenceEndPattern = /([.!?])(\s+|$)/g;

  const sentences = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex
  sentenceEndPattern.lastIndex = 0;

  while ((match = sentenceEndPattern.exec(normalized)) !== null) {
    const endIndex = match.index + 1;
    const sentence = normalized.substring(lastIndex, endIndex).trim();

    // Skip if sentence is too short (likely false positive)
    if (sentence.length > 0 && sentence.length > 2) {
      // Basic check for abbreviations (heuristic - not perfect)
      const beforeChar = normalized[match.index - 1];
      const isAbbreviation = beforeChar && /[A-Za-z]/.test(beforeChar);
      
      // If it looks like an abbreviation (single letter before period), 
      // check if next char is capital (likely start of new sentence)
      if (isAbbreviation && match.index + 2 < normalized.length) {
        const afterSpace = normalized[match.index + 2];
        if (afterSpace && /[A-Z]/.test(afterSpace)) {
          // Likely sentence end
          sentences.push(sentence);
          lastIndex = match.index + match[0].length;
          continue;
        } else {
          // Likely abbreviation, continue
          continue;
        }
      } else {
        // Not an abbreviation, treat as sentence end
        sentences.push(sentence);
        lastIndex = match.index + match[0].length;
      }
    }
  }

  // Add remaining text
  if (lastIndex < normalized.length) {
    const remaining = normalized.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }
  }

  // If no sentences found (no punctuation), return whole text as single sentence
  if (sentences.length === 0) {
    return [normalized];
  }

  return sentences;
}

/**
 * Clean and normalize text for processing
 * 
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double newline
    .trim();
}

/**
 * Check if text is too short to be useful
 * 
 * @param {string} text - Text to check
 * @param {number} minLength - Minimum length (default: 10)
 * @returns {boolean} - True if text is too short
 */
function isTooShort(text, minLength = 10) {
  if (!text || typeof text !== 'string') {
    return true;
  }
  return text.trim().length < minLength;
}

/**
 * Truncate text to maximum length
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength, suffix = '...') {
  if (!text || typeof text !== 'string') {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

module.exports = {
  splitIntoSentences,
  normalizeText,
  isTooShort,
  truncateText,
};

