/**
 * Embedding Generation Utilities
 * 
 * Handles OpenAI embedding generation for semantic chunking and vector search.
 * Uses text-embedding-3-small model (1536 dimensions).
 */

const OpenAI = require('openai');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536, // text-embedding-3-small produces 1536 dimensions
  MAX_BATCH_SIZE: 2048, // OpenAI API limit
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
};

if (!CONFIG.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openaiClient = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
  maxRetries: CONFIG.MAX_RETRIES,
});

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for a single text
 * @param {string} text - Text to generate embedding for
 * @returns {Promise<number[]>} - Array of 1536 floats
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string');
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
      input: text.trim(),
    });

    const embedding = response.data[0].embedding;

    if (!embedding || embedding.length !== CONFIG.EMBEDDING_DIMENSIONS) {
      throw new Error(`Unexpected embedding dimensions: ${embedding?.length || 0}, expected ${CONFIG.EMBEDDING_DIMENSIONS}`);
    }

    return embedding;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error instanceof OpenAI.RateLimitError) {
        throw new Error(`OpenAI rate limit exceeded: ${error.message}`);
      } else if (error instanceof OpenAI.APIConnectionError) {
        throw new Error(`OpenAI connection error: ${error.message}`);
      } else {
        throw new Error(`OpenAI API error: ${error.message} (status: ${error.status})`);
      }
    }
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in a single batch API call
 * More efficient than calling generateEmbedding() multiple times
 * 
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @returns {Promise<number[][]>} - Array of embeddings (each is 1536 floats)
 */
async function generateEmbeddingsBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }

  // Filter out empty texts
  const validTexts = texts
    .map((text, index) => ({ text: text?.trim(), index }))
    .filter(({ text }) => text && text.length > 0);

  if (validTexts.length === 0) {
    throw new Error('No valid texts provided');
  }

  // Check batch size limit
  if (validTexts.length > CONFIG.MAX_BATCH_SIZE) {
    throw new Error(`Batch size ${validTexts.length} exceeds maximum ${CONFIG.MAX_BATCH_SIZE}`);
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
      input: validTexts.map(({ text }) => text),
    });

    // Verify response
    if (!response.data || response.data.length !== validTexts.length) {
      throw new Error(`Unexpected response length: ${response.data?.length || 0}, expected ${validTexts.length}`);
    }

    // Extract embeddings and verify dimensions
    const embeddings = response.data.map((item, index) => {
      const embedding = item.embedding;
      if (!embedding || embedding.length !== CONFIG.EMBEDDING_DIMENSIONS) {
        throw new Error(`Unexpected embedding dimensions at index ${index}: ${embedding?.length || 0}, expected ${CONFIG.EMBEDDING_DIMENSIONS}`);
      }
      return embedding;
    });

    return embeddings;
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error instanceof OpenAI.RateLimitError) {
        throw new Error(`OpenAI rate limit exceeded: ${error.message}`);
      } else if (error instanceof OpenAI.APIConnectionError) {
        throw new Error(`OpenAI connection error: ${error.message}`);
      } else {
        throw new Error(`OpenAI API error: ${error.message} (status: ${error.status})`);
      }
    }
    throw error;
  }
}

/**
 * Generate embeddings for a large array of texts, automatically splitting into batches
 * 
 * @param {string[]} texts - Array of texts to generate embeddings for
 * @param {Function} onProgress - Optional progress callback: (processed, total) => void
 * @returns {Promise<number[][]>} - Array of embeddings (each is 1536 floats)
 */
async function generateEmbeddingsBatched(texts, onProgress = null) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }

  const results = [];
  const batchSize = CONFIG.MAX_BATCH_SIZE;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    try {
      const batchEmbeddings = await generateEmbeddingsBatch(batch);
      results.push(...batchEmbeddings);
      
      if (onProgress) {
        onProgress(i + batch.length, texts.length);
      }
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      throw new Error(`Failed to generate embeddings for batch starting at index ${i}: ${error.message}`);
    }
  }

  return results;
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateEmbeddingsBatched,
  EMBEDDING_DIMENSIONS: CONFIG.EMBEDDING_DIMENSIONS,
  MAX_BATCH_SIZE: CONFIG.MAX_BATCH_SIZE,
};

