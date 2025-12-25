/**
 * Database Storage Utilities for Knowledge Base
 * 
 * Handles storing chunks and embeddings in Turso database.
 * Includes conversion of embedding arrays to F32_BLOB format.
 */

const { createClient } = require('@libsql/client');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  BATCH_SIZE: 100, // Number of chunks to insert per transaction
};

// ============================================================================
// EMBEDDING CONVERSION
// ============================================================================

/**
 * Prepare embedding for storage using vector32() function
 * 
 * LibSQL/Turso recommends using vector32() function for vector storage.
 * This converts the embedding array to JSON string format for vector32().
 * 
 * @param {number[]} embedding - Array of floats (should be 1536 for text-embedding-3-small)
 * @returns {string} - JSON string representation of the embedding array
 */
function embeddingToVector32(embedding) {
  if (!Array.isArray(embedding)) {
    throw new Error('Embedding must be an array');
  }

  // Validate dimensions
  if (embedding.length === 0) {
    throw new Error('Embedding array cannot be empty');
  }

  // Convert to JSON string for vector32() function
  // vector32() expects JSON array format: "[1,2,3,...]"
  return JSON.stringify(embedding);
}

/**
 * Parse embedding from stored vector (for testing/verification)
 * 
 * Note: When reading from database, LibSQL may return the vector in different formats.
 * This function handles JSON string format.
 * 
 * @param {string|Buffer|number[]} storedVector - Stored vector (could be JSON string, buffer, or array)
 * @returns {number[]} - Array of floats
 */
function parseStoredEmbedding(storedVector) {
  if (Array.isArray(storedVector)) {
    return storedVector;
  }

  if (typeof storedVector === 'string') {
    try {
      return JSON.parse(storedVector);
    } catch (e) {
      throw new Error(`Failed to parse embedding string: ${e.message}`);
    }
  }

  if (Buffer.isBuffer(storedVector)) {
    // Fallback: handle buffer format if LibSQL returns raw bytes
    const float32Array = new Float32Array(storedVector.buffer, storedVector.byteOffset, storedVector.byteLength / 4);
    return Array.from(float32Array);
  }

  throw new Error('Unsupported embedding format');
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store a single chunk with embedding
 * 
 * @param {Object} tursoClient - Turso client instance
 * @param {Object} chunkData - Chunk data:
 *   - doc_id: number
 *   - channel_id: string
 *   - content: string
 *   - embedding: number[] (array of 1536 floats)
 *   - author_role: string ('client' or 'team')
 *   - topic_tag: string (optional)
 *   - message_timestamp: number (optional)
 * @returns {Promise<number>} - chunk_id of inserted chunk
 */
async function storeChunkWithEmbedding(tursoClient, chunkData) {
  const {
    doc_id,
    channel_id,
    content,
    embedding,
    author_role,
    topic_tag = null,
    message_timestamp = null,
  } = chunkData;

  // Validate required fields
  if (!doc_id || !channel_id || !content || !embedding) {
    throw new Error('Missing required fields: doc_id, channel_id, content, embedding');
  }

  // Convert embedding to JSON string for vector32() function
  const embeddingJson = embeddingToVector32(embedding);

  try {
    // Use vector32() function for proper vector storage (LibSQL best practice)
    const result = await tursoClient.execute({
      sql: `INSERT INTO kb_chunks 
            (doc_id, channel_id, content, embedding, author_role, topic_tag, message_timestamp)
            VALUES (?, ?, ?, vector32(?), ?, ?, ?)`,
      args: [
        doc_id,
        channel_id,
        content,
        embeddingJson,
        author_role || null,
        topic_tag,
        message_timestamp,
      ],
    });

    // Get the inserted chunk_id (SQLite last_insert_rowid())
    const lastInsertResult = await tursoClient.execute({
      sql: 'SELECT last_insert_rowid() as chunk_id',
    });

    const chunkId = lastInsertResult.rows[0]?.chunk_id;
    
    if (!chunkId) {
      throw new Error('Failed to retrieve inserted chunk_id');
    }

    return chunkId;
  } catch (error) {
    throw new Error(`Failed to store chunk: ${error.message}`);
  }
}

/**
 * Store multiple chunks with embeddings in a batch
 * More efficient than calling storeChunkWithEmbedding() multiple times
 * 
 * @param {Object} tursoClient - Turso client instance
 * @param {Array} chunksData - Array of chunk data objects (same format as storeChunkWithEmbedding)
 * @returns {Promise<number[]>} - Array of chunk_ids
 */
async function storeChunksBatch(tursoClient, chunksData) {
  if (!Array.isArray(chunksData) || chunksData.length === 0) {
    return [];
  }

  // Process in batches to avoid transaction size limits
  const batchSize = CONFIG.BATCH_SIZE;
  const allChunkIds = [];

  for (let i = 0; i < chunksData.length; i += batchSize) {
    const batch = chunksData.slice(i, i + batchSize);
    
    try {
      // Prepare args array
      const args = [];
      for (const chunk of batch) {
        const {
          doc_id,
          channel_id,
          content,
          embedding,
          author_role,
          topic_tag = null,
          message_timestamp = null,
        } = chunk;

        if (!doc_id || !channel_id || !content || !embedding) {
          throw new Error(`Invalid chunk data at index ${i}: missing required fields`);
        }

        const embeddingJson = embeddingToVector32(embedding);
        
        args.push(
          doc_id,
          channel_id,
          content,
          embeddingJson,
          author_role || null,
          topic_tag,
          message_timestamp
        );
      }

      // Prepare SQL with vector32() function for all embeddings
      const placeholders = batch.map(() => '(?, ?, ?, vector32(?), ?, ?, ?)').join(', ');
      const sql = `INSERT INTO kb_chunks 
                   (doc_id, channel_id, content, embedding, author_role, topic_tag, message_timestamp)
                   VALUES ${placeholders}`;

      // Execute batch insert
      await tursoClient.execute({ sql, args });

      // Get chunk_ids for this batch
      const chunkIdsResult = await tursoClient.execute({
        sql: `SELECT chunk_id FROM kb_chunks 
              ORDER BY chunk_id DESC 
              LIMIT ?`,
        args: [batch.length],
      });

      const batchChunkIds = chunkIdsResult.rows.map(row => row.chunk_id).reverse();
      allChunkIds.push(...batchChunkIds);

    } catch (error) {
      throw new Error(`Failed to store chunk batch starting at index ${i}: ${error.message}`);
    }
  }

  return allChunkIds;
}

/**
 * Create a document record in kb_documents table
 * 
 * @param {Object} tursoClient - Turso client instance
 * @param {Object} docData - Document data:
 *   - channel_id: string
 *   - source_type: string (default: 'discord_history')
 *   - date_range_start: number (Unix timestamp)
 *   - date_range_end: number (Unix timestamp)
 * @returns {Promise<number>} - doc_id of created document
 */
async function createDocumentRecord(tursoClient, docData) {
  const {
    channel_id,
    source_type = 'discord_history',
    date_range_start,
    date_range_end,
  } = docData;

  if (!channel_id || !date_range_start || !date_range_end) {
    throw new Error('Missing required fields: channel_id, date_range_start, date_range_end');
  }

  try {
    const result = await tursoClient.execute({
      sql: `INSERT INTO kb_documents 
            (channel_id, source_type, date_range_start, date_range_end, ingested_at)
            VALUES (?, ?, ?, ?, unixepoch())`,
      args: [channel_id, source_type, date_range_start, date_range_end],
    });

    // Get the inserted doc_id
    const lastInsertResult = await tursoClient.execute({
      sql: 'SELECT last_insert_rowid() as doc_id',
    });

    const docId = lastInsertResult.rows[0]?.doc_id;
    
    if (!docId) {
      throw new Error('Failed to retrieve inserted doc_id');
    }

    return docId;
  } catch (error) {
    throw new Error(`Failed to create document record: ${error.message}`);
  }
}

/**
 * Check if a document already exists for a channel and date range
 * Useful for resume capability
 * 
 * @param {Object} tursoClient - Turso client instance
 * @param {string} channel_id - Channel ID
 * @param {number} date_range_start - Start timestamp
 * @param {number} date_range_end - End timestamp
 * @returns {Promise<number|null>} - Existing doc_id or null if not found
 */
async function findExistingDocument(tursoClient, channel_id, date_range_start, date_range_end) {
  try {
    const result = await tursoClient.execute({
      sql: `SELECT doc_id FROM kb_documents 
            WHERE channel_id = ? 
            AND date_range_start = ? 
            AND date_range_end = ?`,
      args: [channel_id, date_range_start, date_range_end],
    });

    if (result.rows.length > 0) {
      return result.rows[0].doc_id;
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to check for existing document: ${error.message}`);
  }
}

module.exports = {
  embeddingToVector32,
  parseStoredEmbedding,
  storeChunkWithEmbedding,
  storeChunksBatch,
  createDocumentRecord,
  findExistingDocument,
};

