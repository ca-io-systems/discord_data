/**
 * Semantic Chunking Implementation
 * 
 * Splits text into chunks based on semantic similarity rather than fixed character counts.
 * Uses cosine similarity between consecutive sentences to determine chunk boundaries.
 * 
 * Algorithm:
 * 1. Split messages into sentences
 * 2. Generate embeddings for all sentences
 * 3. Compare consecutive sentence embeddings using cosine similarity
 * 4. Create new chunk when similarity drops below threshold (default: 0.7)
 * 5. Merge sentences within same chunk
 */

const { generateEmbeddingsBatch } = require('./embeddings');
const { cosineSimilarityBatch } = require('./similarity');
const { splitIntoSentences, normalizeText } = require('./text-processing');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SIMILARITY_THRESHOLD: parseFloat(process.env.SEMANTIC_CHUNKING_THRESHOLD) || 0.7,
  MIN_CHUNK_LENGTH: 10, // Minimum characters per chunk (reduced to capture short messages)
  MAX_CHUNK_LENGTH: 2000, // Maximum characters per chunk (optional)
};

// ============================================================================
// SEMANTIC CHUNKING
// ============================================================================

/**
 * Chunk messages using semantic similarity
 * 
 * @param {Array} messages - Array of message objects with:
 *   - content: string
 *   - author: string or authorId
 *   - timestamp: number (Unix timestamp)
 *   - isTeam?: boolean (optional, for author_role)
 * @param {Object} options - Chunking options
 *   - threshold: number (similarity threshold, default: 0.7)
 *   - minChunkLength: number (optional)
 *   - maxChunkLength: number (optional)
 * @returns {Promise<Array>} - Array of chunk objects:
 *   - content: string (chunk text)
 *   - author_role: 'client' | 'team'
 *   - message_timestamp: number (first message timestamp in chunk)
 *   - metadata: object (additional metadata)
 */
async function semanticChunk(messages, options = {}) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const threshold = options.threshold || CONFIG.SIMILARITY_THRESHOLD;
  const minChunkLength = options.minChunkLength || CONFIG.MIN_CHUNK_LENGTH;
  const maxChunkLength = options.maxChunkLength || CONFIG.MAX_CHUNK_LENGTH;

  // Step 1: Prepare sentences with metadata
  const sentences = [];
  let sentenceIndex = 0;

  for (const message of messages) {
    const normalizedContent = normalizeText(message.content || '');
    if (normalizedContent.length === 0) {
      continue;
    }

    // Split message into sentences
    const messageSentences = splitIntoSentences(normalizedContent);
    
    for (const sentence of messageSentences) {
      if (sentence.trim().length > 0) {
        sentences.push({
          text: sentence.trim(),
          author_role: message.isTeam ? 'team' : 'client',
          message_timestamp: message.timestamp,
          message_index: sentenceIndex,
          original_message: message,
        });
        sentenceIndex++;
      }
    }
  }

  if (sentences.length === 0) {
    return [];
  }

  // Step 2: Generate embeddings for all sentences
  const sentenceTexts = sentences.map(s => s.text);
  let embeddings;
  
  try {
    embeddings = await generateEmbeddingsBatch(sentenceTexts);
  } catch (error) {
    throw new Error(`Failed to generate embeddings for semantic chunking: ${error.message}`);
  }

  if (embeddings.length !== sentences.length) {
    throw new Error(`Embedding count mismatch: ${embeddings.length} embeddings for ${sentences.length} sentences`);
  }

  // Step 3: Compare consecutive sentences and create chunks
  const chunks = [];
  let currentChunk = {
    sentences: [sentences[0]],
    embeddings: [embeddings[0]],
    startTimestamp: sentences[0].message_timestamp,
    author_role: sentences[0].author_role,
  };

  for (let i = 1; i < sentences.length; i++) {
    const prevEmbedding = embeddings[i - 1];
    const currEmbedding = embeddings[i];
    
    // Calculate similarity between previous and current sentence
    const similarity = cosineSimilarityBatch(prevEmbedding, [currEmbedding])[0];

    // Check if similarity is above threshold
    if (similarity >= threshold) {
      // Similar enough - add to current chunk
      currentChunk.sentences.push(sentences[i]);
      currentChunk.embeddings.push(currEmbedding);
      
      // Update author_role if it changes (prefer 'client' if mixed)
      if (sentences[i].author_role === 'client') {
        currentChunk.author_role = 'client';
      }
    } else {
      // Similarity dropped - finalize current chunk and start new one
      const finalizedChunk = finalizeChunk(currentChunk, minChunkLength, maxChunkLength);
      if (finalizedChunk) {
        chunks.push(finalizedChunk);
      }
      
      // Start new chunk
      currentChunk = {
        sentences: [sentences[i]],
        embeddings: [embeddings[i]],
        startTimestamp: sentences[i].message_timestamp,
        author_role: sentences[i].author_role,
      };
    }
  }

  // Finalize last chunk
  const finalizedChunk = finalizeChunk(currentChunk, minChunkLength, maxChunkLength);
  if (finalizedChunk) {
    chunks.push(finalizedChunk);
  }

  return chunks;
}

/**
 * Finalize a chunk by combining sentences and formatting
 * 
 * @param {Object} chunk - Chunk object with sentences and embeddings
 * @param {number} minLength - Minimum chunk length
 * @param {number} maxLength - Maximum chunk length
 * @returns {Object|null} - Finalized chunk object or null if too short
 */
function finalizeChunk(chunk, minLength, maxLength) {
  if (!chunk || !chunk.sentences || chunk.sentences.length === 0) {
    return null;
  }

  // Combine sentences into chunk text
  const content = chunk.sentences.map(s => s.text).join(' ');

  // Check minimum length
  if (content.length < minLength) {
    // Too short - could merge with previous chunk or skip
    // For now, skip very short chunks
    return null;
  }

  // Truncate if too long (shouldn't happen often with semantic chunking)
  const finalContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '...'
    : content;

  // Use first sentence's timestamp
  const message_timestamp = chunk.startTimestamp;

  // Determine author_role (prefer client if mixed)
  const hasClient = chunk.sentences.some(s => s.author_role === 'client');
  const author_role = hasClient ? 'client' : chunk.author_role;

  return {
    content: finalContent.trim(),
    author_role,
    message_timestamp,
    metadata: {
      sentence_count: chunk.sentences.length,
      original_length: content.length,
    },
  };
}

module.exports = {
  semanticChunk,
  CONFIG,
};

