const { hybridSearchRegistry } = require('../models/search.model');
const { pipeline } = require('@huggingface/transformers');

let searchPipelineInstance = null;

/**
 * Shared singleton helper guaranteeing the ML model layout loads into memory only once
 */
const getSearchPipeline = async () => {
  if (!searchPipelineInstance) {
    searchPipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return searchPipelineInstance;
};

const globalSearch = async (req, res) => {
  const { query, workspaceId, filters, limit } = req.body;

  // 1. Structural Validation Checks
  if (!workspaceId || !query) {
    return res.status(400).json({ 
      status: false, 
      message: "Missing required parameters: workspaceId and query string are mandatory." 
    });
  }

  try {
    // 2. Convert incoming plaintext query into an embedding vector locally
    const extractor = await getSearchPipeline();
    const cleanQuery = query.trim() || " ";
    const output = await extractor(cleanQuery, { pooling: 'mean', normalize: true });
    const embeddingVector = Array.from(output.data);

    // 3. Construct and execute the dynamic query with filters inside the model layer
    const results = await hybridSearchRegistry({
      workspaceId,
      textQuery: query,
      vectorQuery: embeddingVector,
      filters: filters || {}, // Fallback to empty object if no filtering arrays passed
      limit: parseInt(limit, 10) || 10
    });

    // 4. Return unified hybrid response
    return res.status(200).json({
      status: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error("Global Hybrid Search Processing Failure:", error);
    return res.status(500).json({ 
      status: false, 
      message: "Internal server error processing hybrid workspace queries." 
    });
  }
};

module.exports = { globalSearch };