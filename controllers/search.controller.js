const { executeHybridQuery } = require('../models/search.model');
const { pipeline } = require('@huggingface/transformers');

// ============================================================================
// 1. ML Pipeline Singletons (BAAI Models)
// ============================================================================
let embeddingPipeline = null;
let rerankerPipeline = null;

const initModels = async () => {
  if (!embeddingPipeline) {
    console.log('[Search] Loading BAAI/bge-small-en-v1.5...');
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5');
  }
  if (!rerankerPipeline) {
    console.log('[Search] Loading BAAI/bge-reranker-base...');
    rerankerPipeline = await pipeline('text-classification', 'Xenova/bge-reranker-base');
  }
  return { encoder: embeddingPipeline, reranker: rerankerPipeline };
};

// ============================================================================
// 2. Dynamic Filter Builder Helper
// ============================================================================
const buildFilters = (filters, startingParamIndex) => {
  if (!filters || Object.keys(filters).length === 0) return { sql: '', values: [] };

  const sqlClauses = [];
  const values = [];
  let paramIndex = startingParamIndex;
  const rootColumns = ['registry_id', 'workspace_id', 'source_table', 'source_row_id'];

  for (const [field, ops] of Object.entries(filters)) {
    const cleanField = field.replace(/[^a-zA-Z0-9_]/g, '');
    const isRoot = rootColumns.includes(cleanField);
    const targetColumn = isRoot ? `"${cleanField}"` : `searchable_text->>'${cleanField}'`; // Targeting JSONB metadata

    // Handle basic equality { "status": "active" }
    if (typeof ops !== 'object' || Array.isArray(ops)) {
      sqlClauses.push(`${targetColumn} = $${paramIndex}`);
      values.push(String(ops));
      paramIndex++;
      continue;
    }

    // Handle advanced operators { "price": { "gte": 100 } }
    for (const [operator, value] of Object.entries(ops)) {
      switch (operator) {
        case 'eq':
          sqlClauses.push(`${targetColumn} = $${paramIndex}`);
          values.push(String(value));
          paramIndex++;
          break;
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
          const sqlOp = operator.replace('eq', '=').replace('gt', '>').replace('lt', '<');
          sqlClauses.push(isRoot ? `${targetColumn} ${sqlOp} $${paramIndex}` : `(${targetColumn})::numeric ${sqlOp} $${paramIndex}`);
          values.push(Number(value));
          paramIndex++;
          break;
        case 'in':
          if (!Array.isArray(value)) break;
          const placeholders = value.map((_, i) => `$${paramIndex + i}`).join(', ');
          sqlClauses.push(`${targetColumn} IN (${placeholders})`);
          value.forEach(v => values.push(String(v)));
          paramIndex += value.length;
          break;
        // Extend with 'between', 'contains', etc., as needed based on previous implementation
      }
    }
  }

  return {
    sql: sqlClauses.length > 0 ? ` AND ${sqlClauses.join(' AND ')}` : '',
    values
  };
};

// ============================================================================
// 3. Main Controller Logic
// ============================================================================
const globalSearch = async (req, res) => {
  const { query, workspaceId, filters, limit } = req.body;
  const clientLimit = parseInt(limit, 10) || 10;
  const candidateLimit = 50; // Max candidates per retrieval method before reranking

  if (!workspaceId || !query) {
    return res.status(400).json({ status: false, message: "workspaceId and query are required." });
  }

  try {
    const { encoder, reranker } = await initModels();

    // 1. Generate BAAI Embedding
    const cleanQuery = query.trim() || ' ';
    const embeddingOutput = await encoder(cleanQuery, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(embeddingOutput.data);

    // 2. Build parameterized filters (Starting at $4 because $1-$3 are used in the CTE query)
    const filterData = buildFilters(filters, 4);

    // 3. Fetch Database Candidates (Top 50 FTS + Vector + Fuzzy merged via RRF)
    const databaseCandidates = await executeHybridQuery({
      workspaceId,
      textQuery: query,
      vectorQueryString: JSON.stringify(queryVector),
      filterSql: filterData.sql,
      filterValues: filterData.values,
      candidateLimit
    });

    if (databaseCandidates.length === 0) {
      return res.status(200).json({ status: true, count: 0, results: [] });
    }

    // 4. Build Dynamic Context for Reranker
    // Loop through all keys in the metadata block dynamically instead of hardcoding 'name' or 'category'
    const rerankerInputs = databaseCandidates.map(row => {
      const meta = row.metadata || {};
      
      // Flatten the JSONB metadata object into a readable string for the ML model
      // Example output: "price: 100 | color: red | status: active"
      const dynamicMetaString = Object.entries(meta)
        .filter(([_, v]) => typeof v === 'string' || typeof v === 'number') // Ignore nested objects
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');

      const contextString = `Metadata: ${dynamicMetaString} | Document: ${row.searchable_text || ''}`;
      
      return { text: query, text_pair: contextString };
    });

    // 5. Execute Cross-Encoder Reranking using bge-reranker-base
    const rerankOutputs = await reranker(rerankerInputs);

    // 6. Calculate final scores and format response
    const rerankedCollection = databaseCandidates.map((row, idx) => {
      const crossEncoderScore = rerankOutputs[idx].score;
      const normalizedRrf = row.rrf_score / 0.05; // Base normalization factor

      // 70% BAAI Reranker Validation + 30% Postgres RRF baseline
      const finalScore = (0.3 * normalizedRrf) + (0.7 * crossEncoderScore);

      return {
        source_table: row.source_table,
        source_row_id: row.source_row_id,
        metadata: row.metadata,
        score: finalScore
      };
    });

    // Sort heavily by the final computed ML score and slice to user's limit
    const finalResults = rerankedCollection
      .sort((a, b) => b.score - a.score)
      .slice(0, clientLimit);

    return res.status(200).json({
      status: true,
      count: finalResults.length,
      results: finalResults
    });

  } catch (error) {
    console.error("[Search Error]:", error);
    return res.status(500).json({ status: false, message: "Internal server error processing hybrid search." });
  }
};

module.exports = { globalSearch,initModels };