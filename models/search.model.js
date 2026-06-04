const db = require('../config/db');

/**
 * Executes a high-performance Hybrid Search using CTEs to leverage both GIN and HNSW indexes.
 */
const hybridSearchRegistry = async ({ workspaceId, textQuery, vectorQuery, filters, limit = 10 }) => {
  const targetTable = `global_registry_${workspaceId}`;
  const formattedVector = JSON.stringify(vectorQuery);
  
  // Base parameters for the search
  const queryParams = [textQuery, formattedVector];
  let paramIndex = 3; // $1 is textQuery, $2 is vectorQuery
  const filterClauses = [];

  // Dynamically parse filters if provided
  if (filters && Object.keys(filters).length > 0) {
    for (const [key, value] of Object.entries(filters)) {
      // Sanitize the key property defensively to prevent SQL injection on identifiers
      const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      
      if (cleanKey === 'source_table') {
        filterClauses.push(`source_table = $${paramIndex}`);
      } else {
        // Automatically treats any custom filters as metadata JSONB property lookups
        filterClauses.push(`metadata->>'${cleanKey}' = $${paramIndex}`);
      }
      queryParams.push(value);
      paramIndex++;
    }
  }

  // Combine filter statements together if they exist
  const filterSql = filterClauses.length > 0 ? ` AND ${filterClauses.join(' AND ')}` : '';
  
  // We append the limit value to the very end of our parameters array
  queryParams.push(limit);
  const limitParamIndex = `$${paramIndex}`;

  // The Hybrid Query Strategy: Fuses Full-Text Search Rank and Vector Similarity Cosine Score
  const sql = `
    WITH fts_search AS (
        SELECT registry_id, ts_rank(searchable_tsv, plainto_tsquery('english', $1)) as rank
        FROM "${targetTable}"
        WHERE searchable_tsv @@ plainto_tsquery('english', $1) ${filterSql}
        ORDER BY rank DESC
        LIMIT 50
    ),
    vector_search AS (
        SELECT registry_id, (1 - (embedding <=> $2)) as similarity
        FROM "${targetTable}"
        WHERE embedding_status = 'completed' ${filterSql}
        ORDER BY embedding <=> $2
        LIMIT 50
    )
    SELECT 
      r.source_table, 
      r.source_row_id, 
      r.metadata,
      coalesce(f.rank, 0) as fts_score,
      coalesce(v.similarity, 0) as vector_score,
      -- Hybrid Weights: 40% text match relevance + 60% semantic vector relevance
      (coalesce(f.rank, 0) * 0.4 + coalesce(v.similarity, 0) * 0.6) as combined_score
    FROM "${targetTable}" r
    LEFT JOIN fts_search f ON r.registry_id = f.registry_id
    LEFT JOIN vector_search v ON r.registry_id = v.registry_id
    WHERE f.registry_id IS NOT NULL OR v.registry_id IS NOT NULL
    ORDER BY combined_score DESC
    LIMIT ${limitParamIndex};
  `;

  const { rows } = await db.query(sql, queryParams);
  return rows;
};

module.exports = { hybridSearchRegistry };