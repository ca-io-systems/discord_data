/**
 * Cosine Similarity Calculation
 * 
 * Calculates cosine similarity between two vectors.
 * Used in semantic chunking to determine when to split chunks.
 */

/**
 * Calculate the dot product of two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Dot product
 */
function dotProduct(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector length mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += vecA[i] * vecB[i];
  }
  return sum;
}

/**
 * Calculate the magnitude (L2 norm) of a vector
 * @param {number[]} vec - Vector
 * @returns {number} - Magnitude
 */
function magnitude(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * Formula: cos(θ) = (A · B) / (||A|| × ||B||)
 * 
 * Result range: -1 to 1
 * - 1: Vectors are identical (same direction)
 * - 0: Vectors are orthogonal (unrelated)
 * - -1: Vectors are opposite (opposite directions)
 * 
 * @param {number[]} vecA - First vector (e.g., embedding)
 * @param {number[]} vecB - Second vector (e.g., embedding)
 * @returns {number} - Cosine similarity (-1 to 1)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB) {
    throw new Error('Both vectors must be provided');
  }

  if (vecA.length !== vecB.length) {
    throw new Error(`Vector length mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  if (vecA.length === 0) {
    throw new Error('Vectors must not be empty');
  }

  const dot = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);

  if (magA === 0 || magB === 0) {
    // If either vector is zero, similarity is undefined
    // Return 0 as a neutral value
    return 0;
  }

  return dot / (magA * magB);
}

/**
 * Calculate cosine similarity for multiple vector pairs
 * More efficient than calling cosineSimilarity() multiple times
 * 
 * @param {number[]} baseVector - Base vector to compare against
 * @param {number[][]} vectors - Array of vectors to compare
 * @returns {number[]} - Array of similarity scores (same order as vectors)
 */
function cosineSimilarityBatch(baseVector, vectors) {
  if (!baseVector || !vectors || !Array.isArray(vectors)) {
    throw new Error('baseVector and vectors array must be provided');
  }

  const magA = magnitude(baseVector);
  
  return vectors.map(vecB => {
    if (!vecB || vecB.length !== baseVector.length) {
      throw new Error(`Vector length mismatch: ${baseVector.length} vs ${vecB?.length || 0}`);
    }
    
    const dot = dotProduct(baseVector, vecB);
    const magB = magnitude(vecB);
    
    if (magA === 0 || magB === 0) {
      return 0;
    }
    
    return dot / (magA * magB);
  });
}

module.exports = {
  cosineSimilarity,
  cosineSimilarityBatch,
  dotProduct,
  magnitude,
};

